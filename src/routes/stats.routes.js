const express = require('express');
const router = express.Router();
const deliveryQueue = require('../queue/queue');

/**
 * GET /queue/stats
 * 
 * Diagnostic endpoint to monitor queue health and job distribution.
 * Useful for dashboards and system monitoring.
 * 
 * @param {express.Request} req
 * @param {express.Response} res
 */
router.get('/stats', async (req, res) => {
  try {
    // Fetch all counts in parallel for optimal performance
    const [waiting, active, completed, failed] = await Promise.all([
      deliveryQueue.getWaitingCount(),
      deliveryQueue.getActiveCount(),
      deliveryQueue.getCompletedCount(),
      deliveryQueue.getFailedCount()
    ]);

    return res.json({
      waiting,
      active,
      completed,
      failed,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[Stats] Error fetching statistics: ${error.message}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
