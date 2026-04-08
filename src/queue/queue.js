const Bull = require('bull');
require('dotenv').config();

/**
 * Bull Queue instance for processing delivery events.
 * This queue manages the asynchronous flow of webhook data to human-readable worker processing.
 * 
 * Payload structure:
 * {
 *   deliveryId: string,
 *   status: string,
 *   timestamp: string,
 *   courierId: string
 * }
 */
const deliveryQueue = new Bull('delivery-events', {
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
  },
});

// Event listener to confirm connectivity
deliveryQueue.on('ready', () => {
  console.log('[Queue] delivery-events queue connected to Redis');
});

// Handle errors at the queue level
deliveryQueue.on('error', (error) => {
  console.error('[Queue] Error in Bull queue:', error);
});

module.exports = deliveryQueue;
