/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * When implementing TODOs or new endpoints, follow those module responsibilities,
 * names, and flows (Users, Tenants, Subscriptions, CloudPods, Provisioning, etc.).
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import dotenv from 'dotenv';

import logger from './config/logger.js';
import { initSentry, sentryErrorHandler } from './config/sentry.js';
import { metricsMiddleware } from './middleware/metrics.js';
import { requestIdMiddleware, requestLoggingMiddleware } from './middleware/requestId.js';
import { 
  metricsMiddleware as prometheusMiddleware,
  metricsHandler,
  healthCheckHandler,
  readinessHandler,
  livenessHandler 
} from './middleware/prometheus.js';
import { initializeGracefulShutdown, onShutdown, shutdownMiddleware } from './utils/gracefulShutdown.js';
import { startDatabaseMonitoring } from './utils/dbHealthCheck.js';
import { 
  securityHeadersMiddleware,
  cacheControlMiddleware,
  requestTimeoutMiddleware,
  slowResponseLogger,
  ipAuditMiddleware,
  responseTimeMiddleware
} from './middleware/productionOptimizations.js';
import { nPlusOneDetectionMiddleware } from './utils/nPlusOneDetector.js';
import memoryLeakDetector from './utils/memoryLeakDetector.js';
import workerPool from './utils/workerPool.js';
import apm, { apmMiddleware } from './utils/apm.js';
import routes from './routes/index.js';
import stripeWebhookRoutes from './routes/stripeWebhookRoutes.js';
import provisioningStripeRouter from './routes/provisioningStripe.js';
import ordersPublicRouter from './routes/ordersPublic.js';
import adminCustomersRouter from './routes/adminCustomers.js';
import adminSubscriptionsRouter from './routes/adminSubscriptions.js';
import adminServersRouter from './routes/adminServers.js';
import workerRouter from './routes/workerRoutes.js';
import cloudPodsRouter from './routes/cloudPods.js';
import BillingService from './services/BillingService.js';
import { cache } from './services/cache.js';
import { i18n, i18nMiddleware } from './services/i18n.js';
import queueService from './services/queueService.js';
import cronService from './services/cronService.js';
import websocketService from './services/websocketService.js';
import { createServer } from 'http';
import { initializeGraphQL } from './graphql/server.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Initialize Redis cache
await cache.initialize();

// Initialize i18n service
await i18n.initialize();

const app = express();

// Trust proxy - required when behind Nginx/reverse proxy
app.set('trust proxy', 1);

// Initialize Sentry FIRST (before any other middleware)
initSentry(app);

const PORT = process.env.PORT || 2271;

// Middleware - ORDER MATTERS!
// 1. Request ID tracking (must be early for logging)
app.use(requestIdMiddleware);
app.use(requestLoggingMiddleware);

// 2. N+1 Query Detection (development only)
app.use(nPlusOneDetectionMiddleware);

// 3. APM Transaction Tracking (production)
app.use(apmMiddleware());

// 4. Response time tracking
app.use(responseTimeMiddleware);

// 5. IP audit logging
app.use(ipAuditMiddleware);

// 6. Shutdown middleware (503 during graceful shutdown)
app.use(shutdownMiddleware);

// 7. Request timeout (30 seconds)
app.use(requestTimeoutMiddleware(30000));

// 8. Slow response logger (warn if > 1 second)
app.use(slowResponseLogger(1000));

// 9. Additional security headers
app.use(securityHeadersMiddleware);

// 10. Cache control
app.use(cacheControlMiddleware);

// 11. Security headers (helmet)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// 10. CORS configuration
const defaultCorsOrigins = [
  'http://localhost:2272',
  'http://127.0.0.1:2272',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

const allowedCorsOrigins = (process.env.CORS_ORIGIN || defaultCorsOrigins.join(','))
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedCorsOrigins.includes(origin)) {
      return callback(null, true);
    }

    logger.warn('Blocked CORS origin', { origin });
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  exposedHeaders: ['X-Request-ID', 'X-API-Version']
}));

// 11. Response compression (gzip/brotli)
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 1024, // Only compress responses > 1KB
  level: 6 // Compression level (0-9, 6 is balanced)
}));

// 6. Stripe webhook (must be before body parsers to preserve raw body)
app.use('/api/webhooks', stripeWebhookRoutes);

// 7. Body parsing with size limits (prevent DoS)
app.use(express.json({ 
  limit: '10mb', // Max JSON body size
  verify: (req, res, buf) => {
    req.rawBody = buf; // Store raw body for webhook verification if needed
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' // Max URL-encoded body size
}));

// 8. API versioning headers
app.use((req, res, next) => {
  res.setHeader('X-API-Version', process.env.API_VERSION || 'v1');
  res.setHeader('X-Powered-By', 'mPanel');
  next();
});

// 9. i18n middleware
app.use(i18nMiddleware);

// 10. Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api', limiter);

// Prometheus metrics collection (BEFORE routes)
app.use(prometheusMiddleware);

// Legacy metrics (keeping for backward compatibility)
app.use(metricsMiddleware);

// Health check endpoints (K8s probes)
app.get('/metrics', metricsHandler);
app.get('/api/health', healthCheckHandler);
app.get('/api/ready', readinessHandler);
app.get('/api/live', livenessHandler);

// Provisioning routes (Stripe → mPanel integration)
app.use('/api/provisioning', provisioningStripeRouter);

// Public orders endpoint (marketing site → mPanel)
app.use('/api/public/orders', ordersPublicRouter);

// Admin API routes
app.use('/api/admin/customers', adminCustomersRouter);
app.use('/api/admin/subscriptions', adminSubscriptionsRouter);
app.use('/api/admin/servers', adminServersRouter);

// Worker API routes (for provisioning workers on srv1)
app.use('/api/worker', workerRouter);

// CloudPods internal API routes
app.use('/api/internal/cloudpods', cloudPodsRouter);

// API routes
app.use('/api', routes);

// Static file cache-busting middleware (prevent old file caching)
app.use((req, res, next) => {
  // For static assets (JS, CSS, images), set aggressive no-cache headers
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico)$/)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
  // For API responses, also prevent caching
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

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

// Serve import HTML page
app.get('/import.html', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'import.html'));
});

// Scheduled tasks
cronService.initialize();

// Initialize enhanced plan access cron jobs (trials, overages, dunning, etc.)
if (process.env.NODE_ENV === 'production') {
  import('./services/enhancedPlanCronJobs.js').then(module => {
    module.startAllCronJobs();
    logger.info('Enhanced plan access automation enabled', {
      jobs: ['trials', 'overages', 'dunning', 'loyalty', 'ai-recommendations', 'success-metrics']
    });
  });
}

// Global error handlers
import { captureException } from './config/sentry.js';

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  captureException(reason, { tags: { type: 'unhandledRejection' } });
  console.error('!!!! UNHANDLED REJECTION !!!!');
  console.error(reason);
  console.error(reason.stack);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  captureException(error, { tags: { type: 'uncaughtException' }, level: 'fatal' });
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

// 404 handler - MUST be after GraphQL initialization
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Sentry error handler - MUST be after routes, BEFORE other error handlers
app.use(sentryErrorHandler);

// Error handler - MUST be last
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err, { requestId: req.id });
  
  const statusCode = err.statusCode || err.status || 500;
  const errorResponse = {
    error: err.name || 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
    requestId: req.id, // Include request ID for debugging
    timestamp: new Date().toISOString()
  };
  
  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }
  
  res.status(statusCode).json(errorResponse);
});

const HOST = process.env.HOST || '0.0.0.0';
const server = httpServer.listen(PORT, HOST, () => {
  logger.info(`MPanel API server running on ${HOST}:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`API Version: ${process.env.API_VERSION || 'v1'}`);
  logger.info(`WebSocket path: ws://${HOST}:${PORT}/ws`);
  logger.info(`GraphQL endpoint: http://${HOST}:${PORT}/graphql`);
  logger.info(`Prometheus metrics: http://${HOST}:${PORT}/metrics`);
  console.log(`✓ Server listening on http://${HOST}:${PORT}`);
  console.log(`✓ WebSocket ready at ws://${HOST}:${PORT}/ws`);
  console.log(`✓ GraphQL API at http://${HOST}:${PORT}/graphql`);
  console.log(`✓ Prometheus metrics at http://${HOST}:${PORT}/metrics`);
  console.log(`✓ Health checks: /api/health, /api/ready, /api/live`);
  
  // Start database health monitoring (every 30 seconds)
  const dbMonitoringInterval = startDatabaseMonitoring(30000);
  
  // Start memory leak detection (every 30 seconds)
  memoryLeakDetector.start(30000);
  
  // Initialize worker pool
  workerPool.initialize().then(() => {
    logger.info('Worker pool initialized', workerPool.getStats());
  }).catch(error => {
    logger.error('Failed to initialize worker pool', { error: error.message });
  });
  
  // Store interval for cleanup on shutdown
  onShutdown(async () => {
    clearInterval(dbMonitoringInterval);
  });
  
  // Keep process alive
  setInterval(() => {}, 1000);
});

// Initialize graceful shutdown
initializeGracefulShutdown(httpServer);

// Register cleanup handlers
onShutdown(async () => {
  logger.info('Shutting down gracefully...');
  
  // Stop memory leak detection
  memoryLeakDetector.stop();
  
  // Shutdown worker pool
  await workerPool.shutdown();
  
  // Stop accepting new jobs
  await queueService.shutdown();
  
  // Stop cron jobs
  cronService.stop();
  
  // Close WebSocket connections
  await websocketService.shutdown();
  
  // Close database pool
  const pool = (await import('./db/index.js')).default;
  await pool.end();
  
  // Close Redis connection
  await cache.shutdown();
  
  logger.info('All services shut down successfully');
});

server.on('error', (error) => {
  logger.error('Server error:', error);
  console.error('Server error:', error);
  process.exit(1);
});

export default app;
