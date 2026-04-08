require('dotenv').config();
const Redis = require('ioredis');
const deliveryQueue = require('./src/queue/queue');

/**
 * Worker Process
 * 
 * Responsibility: Consumes delivery events from the Bull queue, 
 * performs deduplication, and simulates business logic.
 * Runs as a decoupled process from the HTTP server.
 */

// Dedicated Redis client for custom operations (Deduplication)
const redisClient = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
});

console.log('👷 [Worker] Delivery event worker ready. Listening for jobs...');

/**
 * Implements Distributed Deduplication using Redis.
 * Uses 'SET NX EX' strategy:
 * - NX: Set if Not eXists
 * - EX: EXpiration in seconds
 * 
 * If the key already exists, Redis returns null, indicating a duplicate.
 * 
 * @param {string} deliveryId 
 * @param {Redis} client 
 * @returns {Promise<boolean>} - True if duplicate, False if new
 */
const isDuplicate = async (deliveryId, client) => {
  const key = `dedup:delivery:${deliveryId}`;
  // Returns 'OK' on success, null on failure (key exists)
  const result = await client.set(key, '1', 'NX', 'EX', 60);
  return result === null;
};

/**
 * Simulates a Database write operation with random failure.
 * @param {Object} payload 
 */
const simulateDbUpdate = async (payload) => {
  if (Math.random() < 0.15) throw new Error('Simulated DB connection failure');
  
  console.log(`   └─ [DB] Syncing delivery ${payload.deliveryId} (${payload.status})`);
  return new Promise(resolve => setTimeout(resolve, Math.random() * 30));
};

/**
 * Simulates an external API call for push notifications.
 * @param {Object} payload 
 */
const simulateNotification = async (payload) => {
  if (Math.random() < 0.15) throw new Error('Simulated Notification Service failure');
  
  console.log(`   └─ [PUSH] Notification dispatched for ${payload.deliveryId}`);
  return new Promise(resolve => setTimeout(resolve, Math.random() * 20));
};

// --- Job Processor ---
deliveryQueue.process(async (job) => {
  const { deliveryId } = job.data;
  const attempt = job.attemptsMade + 1;

  console.log(`📦 [Worker] Received Job ${job.id} | Delivery: ${deliveryId} (Attempt ${attempt}/3)`);

  // 1. Check for duplicates in a 60-second window
  if (await isDuplicate(deliveryId, redisClient)) {
    console.log(`   ⚠️ [Worker] Duplicate detected. Skipping: ${deliveryId}`);
    return { skipped: true, reason: 'duplicate' };
  }

  // 2. Execute Business Modules
  // Note: Errors here will trigger Bull's retry logic automatically
  await simulateDbUpdate(job.data);
  await simulateNotification(job.data);

  console.log(`   ✅ [Worker] Job ${job.id} fully processed.`);
  
  return { 
    processed: true, 
    deliveryId, 
    completedAt: new Date().toISOString() 
  };
});

// --- Lifecycle Event Listeners ---
deliveryQueue.on('failed', (job, err) => {
  console.error(`❌ [Worker] Job ${job.id} failure (${job.attemptsMade}/3): ${err.message}`);
});

deliveryQueue.on('completed', (job, result) => {
  // result is the object returned from the processor
  if (result.skipped) {
    console.log(`📫 [Worker] Job ${job.id} was handled (skipped duplicate)`);
  } else {
    console.log(`📫 [Worker] Job ${job.id} finalized successfully`);
  }
});

deliveryQueue.on('stalled', (job) => {
  console.warn(`⏳ [Worker] Job ${job.id} stalled. Redis connection might be slow.`);
});

// --- Graceful Shutdown Management ---
const handleShutdown = async (signal) => {
  console.log(`\n🛑 [Worker] ${signal} received. Cleaning up...`);
  try {
    await deliveryQueue.close();
    await redisClient.quit();
    console.log('✅ [Worker] Cleanup complete. Goodbye!');
    process.exit(0);
  } catch (err) {
    console.error('❌ [Worker] Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
