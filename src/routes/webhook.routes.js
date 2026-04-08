const express = require('express');
const router = express.Router();
const deliveryQueue = require('../queue/queue');

// Constants for payload validation
const REQUIRED_FIELDS = ['deliveryId', 'status', 'timestamp', 'courierId'];

/**
 * POST /webhook
 * 
 * Industry Standard Webhook Entry Point:
 * Fast acknowledgement (202 Accepted) by offloading actual work to a background queue.
 * 
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 */
router.post('/webhook', async (req, res) => {
  const startTime = Date.now();
  const payload = req.body;

  // 1. Validate payload presence and mandatory fields
  const missingFields = REQUIRED_FIELDS.filter(field => !payload[field]);
  
  if (missingFields.length > 0) {
    return res.status(400).json({
      error: 'Missing required fields',
      missing: missingFields
    });
  }

  try {
    // 2. Add job to the worker queue
    // Strategy: 3 attempts with exponential backoff (1s initial, then 2s, 4s...)
    await deliveryQueue.add(payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      }
    });

    const duration = Date.now() - startTime;
    console.log(`[Webhook] Job queued in ${duration}ms for deliveryId: ${payload.deliveryId}`);

    // 3. Respond immediately to the courier partner
    return res.status(202).json({
      status: 'accepted',
      deliveryId: payload.deliveryId,
      queuedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[Webhook] Critical Error: ${error.message}`);
    return res.status(500).json({ error: 'Failed to queue message' });
  }
});

module.exports = router;
