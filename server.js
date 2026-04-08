require('dotenv').config();
const express = require('express');
const webhookRoutes = require('./src/routes/webhook.routes');
const statsRoutes = require('./src/routes/stats.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware: Standard JSON parser for webhook payloads
app.use(express.json());

// Main Application Routes
app.use('/', webhookRoutes);     // Webhook endpoint: POST /webhook
app.use('/queue', statsRoutes);  // Monitoring endpoint: GET /queue/stats

// Global 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Global Error Interceptor
app.use((err, req, res, next) => {
  console.error(`[Server] Unhandled Exception: ${err.stack}`);
  res.status(500).json({ error: 'An internal error occurred' });
});

// Bootstrap the HTTP Server
app.listen(PORT, () => {
  console.log('🚀 =========================================');
  console.log(`📡 WEBHOOK GATEWAY ONLINE [PORT: ${PORT}]`);
  console.log(`🔋 REDIS ENDPOINT: ${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`);
  console.log('🚀 =========================================');
});
