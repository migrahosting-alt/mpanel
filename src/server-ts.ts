/**
 * NEW TypeScript Server Entry Point
 * Integrates new TS modules (auth, products, orders) with existing infrastructure
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

// Legacy routes
import routes from './routes/index.js';
import stripeWebhookRoutes from './routes/stripeWebhookRoutes.js';
import provisioningStripeRouter from './routes/provisioningStripe.js';
import ordersPublicRouter from './routes/ordersPublic.js';
import adminCustomersRouter from './routes/adminCustomers.js';
import adminSubscriptionsRouter from './routes/adminSubscriptions.js';
import adminServersRouter from './routes/adminServers.js';
import workerRouter from './routes/workerRoutes.js';

// NEW TypeScript API routes
import apiRouter from './routes/api.js';

import { cache } from './services/cache.js';
import { i18n, i18nMiddleware } from './services/i18n.js';
import queueService from './services/queueService.js';
import cronService from './services/cronService.js';
import websocketService from './services/websocketService.js';
import { createServer } from 'http';
import { initializeGraphQL } from './graphql/server.js';
import path from 'path';
import { fileURLToPath } from 'url';

// NEW: Provisioning worker
import { startProvisioningWorker, stopProvisioningWorker } from './jobs/workers/provisioning.worker.js';
import { startGuardianSecurityWorker, stopGuardianSecurityWorker } from './jobs/workers/guardianSecurity.worker.js';
import shieldMiddleware from './middleware/shield.js';

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

// 10. Standard Express security
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// 11. CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// 12. Compression
app.use(compression());

// 13. Cache control
app.use(cacheControlMiddleware);

// 14. Body parsers - IMPORTANT: Raw body for Stripe webhooks
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health middleware
app.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// i18n middleware
app.use(i18nMiddleware);

// Rate limiting
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

// Shield trust boundary for /api/v1 traffic
app.use('/api/v1', shieldMiddleware);

// ==============================================================
// NEW TypeScript API Routes (Auth, Products, Orders)
// ==============================================================
app.use('/api', apiRouter);
logger.info('Mounted NEW TypeScript API routes: /api/auth, /api/products, /api/orders');

// ==============================================================
// Legacy Routes (keeping for backward compatibility)
// ==============================================================

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
import cloudPodsRouter from './routes/cloudPods.js';
import cloudPodsEnterpriseRouter from './routes/cloudPodsEnterpriseRoutes.js';
app.use('/api/internal/cloudpods', cloudPodsRouter);
app.use('/api/internal/cloudpods', cloudPodsEnterpriseRouter);

// Legacy API routes
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
    version: process.env.API_VERSION || 'v2',
    description: 'Multi-tenant Billing and Hosting Management Platform - TypeScript Edition',
    documentation: '/api/docs',
    health: '/api/health',
    metrics: '/api/metrics',
    features: {
      auth: '/api/auth',
      products: '/api/products',
      orders: '/api/orders'
    }
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
  console.error(reason as any);
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
app.use((err: any, req: any, res: any, next: any) => {
  logger.error('Unhandled error:', err, { requestId: req.id });
  
  const statusCode = err.statusCode || err.status || 500;
  const errorResponse: any = {
    error: err.name || 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
    requestId: req.id,
    timestamp: new Date().toISOString()
  };
  
  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }
  
  res.status(statusCode).json(errorResponse);
});

const HOST = process.env.HOST || '0.0.0.0';
const server = httpServer.listen(PORT, HOST, async () => {
  logger.info(`MPanel API server running on ${HOST}:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`API Version: ${process.env.API_VERSION || 'v2'}`);
  logger.info(`WebSocket path: ws://${HOST}:${PORT}/ws`);
  logger.info(`GraphQL endpoint: http://${HOST}:${PORT}/graphql`);
  logger.info(`Prometheus metrics: http://${HOST}:${PORT}/metrics`);
  console.log(`✓ Server listening on http://${HOST}:${PORT}`);
  console.log(`✓ WebSocket ready at ws://${HOST}:${PORT}/ws`);
  console.log(`✓ GraphQL API at http://${HOST}:${PORT}/graphql`);
  console.log(`✓ Prometheus metrics at http://${HOST}:${PORT}/metrics`);
  console.log(`✓ Health checks: /api/health, /api/ready, /api/live`);
  console.log(`✓ NEW TypeScript APIs: /api/auth, /api/products, /api/orders`);
  
  // ==============================================================
  // START PROVISIONING WORKER
  // ==============================================================
  try {
    await startProvisioningWorker();
    logger.info('✓ Provisioning worker started successfully');
    console.log('✓ Provisioning worker processing jobs...');
    await startGuardianSecurityWorker();
    logger.info('✓ Guardian security worker started successfully');
    console.log('✓ Guardian security worker processing jobs...');
  } catch (error) {
    logger.error('Failed to start provisioning worker', { error: error instanceof Error ? error.message : 'Unknown' });
    console.error('✗ Provisioning worker failed to start:', error);
  }
  
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
  
  // Stop provisioning worker
  await stopProvisioningWorker();
  logger.info('Provisioning worker stopped');
  await stopGuardianSecurityWorker();
  logger.info('Guardian security worker stopped');
  
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
