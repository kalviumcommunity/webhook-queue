# RTCROS Prompts — Simple Task Solution
## Async Queue and Webhook Processing (3-Prompt Sequence)

Paste each prompt one at a time. Each builds on the output of the previous step. Do not skip or combine prompts.

---

## Prompt 1 — Project Scaffold, Bull Queue Setup, and Webhook Handler

**Role:**
You are a senior Node.js backend engineer building a production-grade asynchronous webhook processing system. You write clean, modular JavaScript with strict separation of concerns: the HTTP layer never contains processing logic, and the queue setup is isolated in its own module. Every file is well-commented and uses a consistent 2-space indentation style.

**Task:**
Scaffold the complete project, initialise the Bull queue with Redis, and build the fast webhook handler that acknowledges receipt in under 50ms.

**Context:**
The core architectural shift is this: the POST /webhook handler must respond immediately without doing any real work. It validates the payload, pushes a job onto a Bull queue, and returns `{ status: "accepted" }`. All actual processing — DB updates, notification dispatch, deduplication — happens in a separate worker process. This separation is what keeps the handler fast under any load.

**Requirements:**

1. Create the following project structure:
   ```
   webhook-queue/
   ├── src/
   │   ├── routes/
   │   │   ├── webhook.routes.js
   │   │   └── stats.routes.js
   │   └── queue/
   │       └── queue.js
   ├── server.js
   ├── worker.js  (empty placeholder for Prompt 2)
   ├── package.json
   ├── .env.example
   └── README.md  (placeholder)
   ```

2. In `package.json`, include: `express`, `bull`, `ioredis`, `dotenv`. Set `"type": "commonjs"`.

3. In `.env.example`:
   ```
   REDIS_HOST=127.0.0.1
   REDIS_PORT=6379
   PORT=3000
   ```

4. In `src/queue/queue.js`:
   - Import `Bull` and `dotenv`
   - Create and export a single Bull queue instance named `"delivery-events"` using Redis connection options read from environment variables (`REDIS_HOST`, `REDIS_PORT`)
   - Export the queue as the default export
   - Add a JSDoc comment describing what the queue carries
   - Log `"[Queue] delivery-events queue connected to Redis"` on successful connection using the queue's `ready` event

5. In `src/routes/webhook.routes.js`:
   - Import `express.Router` and the queue from `queue.js`
   - Implement `POST /webhook`:
     - Validate that `req.body` contains `deliveryId`, `status`, `timestamp`, and `courierId`. If any field is missing, return `400` with `{ error: "Missing required fields", missing: [...fieldNames] }`
     - Add the job to the queue with `queue.add(payload, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } })`
     - Record the time before and after the queue add with `Date.now()` and log it: `"[Webhook] Job queued in {N}ms for deliveryId: {deliveryId}"`
     - Return `{ status: "accepted", deliveryId: payload.deliveryId, queuedAt: new Date().toISOString() }` with status 202
     - The entire handler must complete in under 50ms under normal conditions

6. In `src/routes/stats.routes.js`:
   - Import the queue
   - Implement `GET /queue/stats`:
     - Call `Promise.all([queue.getWaitingCount(), queue.getActiveCount(), queue.getCompletedCount(), queue.getFailedCount()])` to get all counts simultaneously
     - Return `{ waiting, active, completed, failed, timestamp: new Date().toISOString() }`

7. In `server.js`:
   - Initialise dotenv
   - Mount webhook routes at `/` and stats routes at `/queue`
   - Add JSON body parser middleware
   - Add a global error handler
   - Start on `process.env.PORT || 3000`
   - Print a startup banner showing the port and Redis connection info

**Output:**
Complete content of every file listed. Label all code blocks with their file path. Every exported function must have a JSDoc comment.

**Style:**
No business logic in routes. No Redis calls in the webhook handler. Every console log must be prefixed with the module name in brackets (e.g., `[Webhook]`, `[Queue]`). No magic strings — use named constants for field names.

---

## Prompt 2 — Worker Process with Deduplication and Retry Logic

**Role:**
You are continuing work on the webhook processing system. The Bull queue and HTTP server are complete. You are now building the worker process — the separate Node.js process that consumes jobs from the queue, handles deduplication, and processes delivery events.

**Task:**
Implement `worker.js` — the complete consumer process with Redis-based deduplication and correct retry behaviour.

**Context:**
The worker runs as a completely separate process from the HTTP server (`node worker.js` in a separate terminal). It shares access to the same Redis instance and the same Bull queue. When a job arrives, the worker must first check whether this `deliveryId` has been processed in the last 60 seconds using a Redis `SET NX EX` command. If the deduplication check passes, it processes the event. If it fails all 3 retries, Bull automatically moves it to the failed set — the worker does not need to handle this manually.

**Requirements:**

1. In `worker.js`, implement the complete worker:

   **Setup:**
   - Import `Bull`, `ioredis`, and `dotenv`
   - Create a new `ioredis` client for deduplication key management (separate from Bull's internal Redis client)
   - Import the queue from `src/queue/queue.js`
   - Print a startup banner: `"[Worker] Delivery event worker started. Waiting for jobs..."`

   **Deduplication function `isDuplicate(deliveryId, redisClient)`:**
   - Construct a deduplication key: `dedup:delivery:{deliveryId}`
   - Use `redisClient.set(key, '1', 'NX', 'EX', 60)` — this sets the key only if it does not exist (`NX`), with a 60-second TTL (`EX 60`)
   - If the command returns `null`, the key already existed — this is a duplicate. Return `true`.
   - If the command returns `"OK"`, this is the first time we've seen this event. Return `false`.
   - Add a JSDoc comment explaining the NX/EX trick

   **Simulated processing functions:**
   - `simulateDbUpdate(payload)` — log `"[Worker] DB updated for deliveryId: {deliveryId}, status: {status}"` and return a resolved promise after `Math.random() * 30` ms
   - `simulateNotification(payload)` — log `"[Worker] Push notification sent for deliveryId: {deliveryId}"` and return a resolved promise after `Math.random() * 20` ms
   - Both functions should occasionally throw to simulate real failures — use `Math.random() < 0.15` to throw `new Error("Simulated processing failure")` with a 15% chance

   **Job processor `queue.process(async (job) => {...})`:**
   - Log job receipt: `"[Worker] Processing job {job.id} — deliveryId: {job.data.deliveryId} (attempt {job.attemptsMade + 1}/3)"`
   - Call `isDuplicate(job.data.deliveryId, redisClient)`
   - If duplicate: log `"[Worker] Duplicate skipped — deliveryId: {deliveryId}"` and return `{ skipped: true, reason: 'duplicate' }`
   - If not duplicate: call `simulateDbUpdate` then `simulateNotification` sequentially
   - On success, log `"[Worker] Job {job.id} completed successfully"`
   - Return `{ processed: true, deliveryId: job.data.deliveryId, completedAt: new Date().toISOString() }`
   - If an error is thrown, do NOT catch it — let it propagate so Bull handles the retry logic automatically

   **Queue event listeners** (add after the processor):
   - `queue.on('failed', (job, err) => ...)` — log `"[Worker] Job {job.id} FAILED after {job.attemptsMade} attempts: {err.message}"`
   - `queue.on('completed', (job, result) => ...)` — log `"[Worker] Job {job.id} completed: ${JSON.stringify(result)}"`
   - `queue.on('stalled', (job) => ...)` — log `"[Worker] Job {job.id} stalled — will be requeued"`

2. Add graceful shutdown:
   - On `process.on('SIGTERM')` and `process.on('SIGINT')`: call `queue.close()` then `redisClient.quit()`, log `"[Worker] Graceful shutdown complete"`, and exit with code 0

**Output:**
Complete content of `worker.js`. Label the code block.

**Style:**
The worker must run as a standalone process. Never import Express or HTTP modules here. All Redis operations must use the ioredis client directly — never use Bull's internal client for custom Redis commands. Errors thrown inside the processor must propagate uncaught so Bull's retry mechanism fires.

---

## Prompt 3 — README, Architecture Diagram, and Final Integration Check

**Role:**
You are doing the final pass on the async webhook processing system. The queue, HTTP server, and worker are all complete. You are now writing the README and doing a final integration check across the codebase.

**Task:**
Write the complete README with the ASCII architecture diagram, add startup scripts to `package.json`, and perform a consistency check across all files.

**Context:**
The project has: `server.js`, `worker.js`, `src/routes/webhook.routes.js`, `src/routes/stats.routes.js`, `src/queue/queue.js`, `package.json`, `.env.example`. The README must be good enough that someone unfamiliar with the project can clone it and reproduce both the deduplication behaviour and the retry behaviour within 5 minutes.

**Requirements:**

1. Add to `package.json` scripts:
   ```json
   "scripts": {
     "start": "node server.js",
     "worker": "node worker.js",
     "dev:server": "nodemon server.js",
     "dev:worker": "nodemon worker.js"
   }
   ```
   Add `nodemon` as a dev dependency.

2. Write the complete `README.md` with these sections:

   **Overview** — two sentences describing the system

   **Architecture**
   Include this ASCII diagram (expand with actual system labels):
   ```
   Courier Partner
        │
        ▼
   POST /webhook (Express)
        │  responds 202 in <50ms
        ▼
   Bull Queue (Redis)
        │
        ▼
   Worker Process
        ├── isDuplicate? ──yes──► skip (log + return)
        │         no
        ▼
   simulateDbUpdate()
        │
        ▼
   simulateNotification()
        │
     success? ──no──► Bull retries (max 3, exponential backoff)
        │                    │
        │              all failed? ──► Bull failed set
        ▼
   job.completed
   ```

   **Prerequisites** — Node.js 18+, Redis running locally on port 6379

   **Setup**
   ```bash
   git clone <repo-url>
   cd webhook-queue
   npm install
   cp .env.example .env
   ```

   **Running the system** — explain that the server and worker must run in separate terminals:
   ```bash
   # Terminal 1
   npm start

   # Terminal 2
   npm run worker
   ```

   **Testing POST /webhook** — provide a curl command with a sample payload

   **Simulating a duplicate** — explain: send the same `deliveryId` twice within 60 seconds. The second event should log "Duplicate skipped" in the worker.

   **Simulating a retry** — explain: the `simulateDbUpdate` and `simulateNotification` functions have a 15% random failure rate. Send 20 events and watch the worker logs for retry attempts. Or temporarily change the failure threshold to 100% to force failures every time.

   **GET /queue/stats** — sample curl and sample response

   **Environment variables** — table with `REDIS_HOST`, `REDIS_PORT`, `PORT` and their defaults

3. Consistency check — fix any of the following if found:
   - Any Redis call inside the webhook route handler
   - Any reference to a queue named something other than `"delivery-events"`
   - Any missing `dotenv.config()` call in a file that reads from `process.env`
   - Any uncaught error inside the job processor function (errors must propagate for Bull retry to work)

**Output:**
Complete `README.md` and the updated `package.json`. List any consistency fixes as named items before the README. If none are needed, state that explicitly.

**Style:**
The README must let someone reproduce the full deduplication and retry demo in under 5 minutes. The ASCII diagram must clearly show where the 50ms boundary is and where retries happen.