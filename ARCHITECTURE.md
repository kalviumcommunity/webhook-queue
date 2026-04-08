# 🏛️ Architecture & Knowledge Item

## 🎯 The Problem
Standard HTTP handlers often perform blocking operations (DB writes, API calls, complicated logic). When a webhook provider sends 1000 requests/sec, the server becomes a bottleneck, causing timeouts and lost data.

## 💡 The Solution: Asynchronous Processing
We use an **Indirection Layer** (The Queue).

### 1. The Gateway (The Fast Responder)
- **Role**: Validates and Queues.
- **Constraint**: Must return a response within 50ms.
- **Implementation**: Uses `Bull` (built on Redis) to push the payload into a list and immediately responds with `202 Accepted`.

### 2. Bull Queue (The Single Source of Truth)
- **Role**: Persists jobs even if the server crashes.
- **Features**:
  - **Retry Logic**: If a worker fails, the job isn't lost. It's retried based on our exponential backoff strategy.
  - **Concurrency Control**: We can run multiple workers to empty the queue faster.

### 3. The Worker (The Heavy Lifter)
- **Role**: Processes the data.
- **Deduplication**: Webhook providers often send the same event twice. We use a Redis `SET NX EX` pattern to ensure we only process an ID once every 60 seconds.
- **Fail-Safe**: If the DB is down, the worker throws an error. Bull catches this and schedules a retry.

## 🛠️ Tech Stack Decisions
- **Express**: Industry standard for Node.js APIs.
- **Redis**: Chosen for its speed (RAM-based) and atomic operations (required for deduplication).
- **Bull**: The most robust queue library for Node.js, providing built-in retry, priority, and monitoring.

## 🎓 Learning Points (For Students)
1. **Never block the Event Loop**: Heavy logic belongs in workers.
2. **Idempotency**: Always assume an external service will send you the same data twice. Handle it gracefully.
3. **Graceful Shutdown**: Always close your DB and Redis connections when the process stops to avoid "hanging" clients.
