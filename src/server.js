import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';

import logger from './config/logger.js';
import { metricsMiddleware } from './middleware/metrics.js';
import routes from './routes/index.js';
import BillingService from './services/BillingService.js';
import StripeService from './services/StripeService.js';
import { cache } from './services/cache.js';
import { i18n, i18nMiddleware } from './services/i18n.js';
import queueService from './services/queueService.js';
import cronService from './services/cronService.js';
import websocketService from './services/websocketService.js';
import { createServer } from 'http';
import { initializeGraphQL } from './graphql/server.js';

// Load environment variables
dotenv.config();

// Initialize Redis cache
await cache.initialize();

// Initialize i18n service
await i18n.initialize();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.post('/webhooks/stripe', bodyParser.raw({ type: 'application/json' }), (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    const event = StripeService.verifyWebhookSignature(req.body, signature);
    logger.info(`[webhook] ${event.type}`);
    res.json({ received: true });
  } catch (error) {
    logger.error('Stripe webhook error', error);
    res.status(400).send('Webhook Error');
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// i18n middleware
app.use(i18nMiddleware);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api', limiter);

// Metrics collection
app.use(metricsMiddleware);

// API routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'MPanel API',
    version: process.env.API_VERSION || 'v1',
    description: 'Multi-tenant Billing and Hosting Management Platform',
    documentation: '/api/docs',
    health: '/api/health',
    metrics: '/api/metrics'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Scheduled tasks
cronService.initialize();

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  console.error('!!!! UNHANDLED REJECTION !!!!');
  console.error(reason);
  console.error(reason.stack);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  console.error('!!!! UNCAUGHT EXCEPTION !!!!');
  console.error(error);
  console.error(error.stack);
  process.exit(1);
});

// Start server with WebSocket support
const httpServer = createServer(app);

// Initialize WebSocket service
await websocketService.initialize(httpServer);

// Initialize GraphQL server
await initializeGraphQL(app);

const server = httpServer.listen(PORT, '127.0.0.1', () => {
  logger.info(`MPanel API server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`API Version: ${process.env.API_VERSION || 'v1'}`);
  logger.info(`WebSocket path: ws://127.0.0.1:${PORT}/ws`);
  logger.info(`GraphQL endpoint: http://127.0.0.1:${PORT}/graphql`);
  console.log(`✓ Server listening on http://127.0.0.1:${PORT}`);
  console.log(`✓ WebSocket ready at ws://127.0.0.1:${PORT}/ws`);
  console.log(`✓ GraphQL API at http://127.0.0.1:${PORT}/graphql`);
  
  // Keep process alive
  setInterval(() => {}, 1000);
});

server.on('error', (error) => {
  logger.error('Server error:', error);
  console.error('Server error:', error);
  process.exit(1);
});

export default app;
