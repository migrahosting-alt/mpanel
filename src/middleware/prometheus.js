/**
 * Enhanced Prometheus Metrics Endpoint
 * Production-grade metrics collection and exposition
 */

import promClient from 'prom-client';
import logger from '../config/logger.js';
import os from 'os';

// Create a Registry
const register = new promClient.Registry();

// Add default metrics (CPU, memory, event loop, GC)
promClient.collectDefaultMetrics({ 
  register,
  prefix: 'mpanel_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
});

// Custom Metrics

// HTTP Request Duration
export const httpRequestDuration = new promClient.Histogram({
  name: 'mpanel_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
});
register.registerMetric(httpRequestDuration);

// HTTP Request Counter
export const httpRequestCounter = new promClient.Counter({
  name: 'mpanel_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});
register.registerMetric(httpRequestCounter);

// Active Connections
export const activeConnections = new promClient.Gauge({
  name: 'mpanel_active_connections',
  help: 'Number of active connections'
});
register.registerMetric(activeConnections);

// Database Connection Pool
export const dbPoolSize = new promClient.Gauge({
  name: 'mpanel_db_pool_size',
  help: 'Database connection pool size',
  labelNames: ['state'] // 'total', 'idle', 'active'
});
register.registerMetric(dbPoolSize);

// Queue Size
export const queueSize = new promClient.Gauge({
  name: 'mpanel_queue_size',
  help: 'Number of jobs in queue',
  labelNames: ['queue_name', 'status'] // 'pending', 'processing', 'failed'
});
register.registerMetric(queueSize);

// Business Metrics

// User Signups
export const userSignups = new promClient.Counter({
  name: 'mpanel_user_signups_total',
  help: 'Total number of user signups',
  labelNames: ['plan']
});
register.registerMetric(userSignups);

// Revenue
export const revenue = new promClient.Counter({
  name: 'mpanel_revenue_total',
  help: 'Total revenue in cents',
  labelNames: ['currency', 'product_type']
});
register.registerMetric(revenue);

// Invoice Status
export const invoiceStatus = new promClient.Counter({
  name: 'mpanel_invoices_total',
  help: 'Total number of invoices by status',
  labelNames: ['status'] // 'paid', 'pending', 'overdue', 'cancelled'
});
register.registerMetric(invoiceStatus);

// Service Provisioning
export const serviceProvisioning = new promClient.Histogram({
  name: 'mpanel_service_provisioning_duration_seconds',
  help: 'Time taken to provision services',
  labelNames: ['service_type'],
  buckets: [1, 5, 10, 30, 60, 120, 300]
});
register.registerMetric(serviceProvisioning);

// Email Queue
export const emailsSent = new promClient.Counter({
  name: 'mpanel_emails_sent_total',
  help: 'Total number of emails sent',
  labelNames: ['template', 'status'] // 'success', 'failed'
});
register.registerMetric(emailsSent);

// SMS Queue
export const smsSent = new promClient.Counter({
  name: 'mpanel_sms_sent_total',
  help: 'Total number of SMS messages sent',
  labelNames: ['purpose', 'status'] // 'success', 'failed'
});
register.registerMetric(smsSent);

// API Rate Limiting
export const rateLimitHits = new promClient.Counter({
  name: 'mpanel_rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['endpoint']
});
register.registerMetric(rateLimitHits);

// Authentication Failures
export const authFailures = new promClient.Counter({
  name: 'mpanel_auth_failures_total',
  help: 'Total number of authentication failures',
  labelNames: ['reason'] // 'invalid_credentials', 'expired_token', 'missing_token'
});
register.registerMetric(authFailures);

// Webhook Deliveries
export const webhookDeliveries = new promClient.Counter({
  name: 'mpanel_webhook_deliveries_total',
  help: 'Total number of webhook deliveries',
  labelNames: ['event_type', 'status'] // 'success', 'failed'
});
register.registerMetric(webhookDeliveries);

/**
 * Metrics middleware
 * Records HTTP request metrics
 */
export function metricsMiddleware(req, res, next) {
  const start = Date.now();
  
  // Track active connections
  activeConnections.inc();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000; // Convert to seconds
    const route = req.route?.path || req.path || 'unknown';
    const method = req.method;
    const statusCode = res.statusCode;
    
    // Record metrics
    httpRequestDuration.labels(method, route, statusCode).observe(duration);
    httpRequestCounter.labels(method, route, statusCode).inc();
    activeConnections.dec();
  });
  
  next();
}

/**
 * Update database pool metrics
 */
export function updateDbPoolMetrics(poolStats) {
  dbPoolSize.labels('total').set(poolStats.total || 0);
  dbPoolSize.labels('idle').set(poolStats.idle || 0);
  dbPoolSize.labels('active').set(poolStats.active || 0);
}

/**
 * Update queue metrics
 */
export function updateQueueMetrics(queueName, stats) {
  queueSize.labels(queueName, 'pending').set(stats.pending || 0);
  queueSize.labels(queueName, 'processing').set(stats.processing || 0);
  queueSize.labels(queueName, 'failed').set(stats.failed || 0);
}

/**
 * Metrics endpoint handler
 */
export async function metricsHandler(req, res) {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    logger.error('Error generating metrics:', error);
    res.status(500).end('Error generating metrics');
  }
}

/**
 * Health check endpoint with detailed status
 */
export function healthCheckHandler(req, res) {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || 'v1',
    uptime: Math.floor(uptime),
    uptimeHuman: formatUptime(uptime),
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
      unit: 'MB'
    },
    cpu: {
      user: Math.round(cpuUsage.user / 1000),
      system: Math.round(cpuUsage.system / 1000),
      unit: 'ms'
    },
    system: {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      hostname: os.hostname(),
      cpus: os.cpus().length,
      totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024),
      freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024),
      unit: 'GB'
    },
    features: [
      'billing',
      'hosting',
      'dns',
      'email',
      'databases',
      'sms',
      'webhooks',
      'ai',
      'graphql',
      'websockets',
      'white-label',
      'rbac'
    ]
  };
  
  res.json(health);
}

/**
 * Readiness check (for Kubernetes)
 * Returns 200 only if app is ready to serve traffic
 */
export async function readinessHandler(req, res) {
  try {
    // Check critical dependencies
    const pool = (await import('../db/index.js')).default;
    await pool.query('SELECT 1'); // Database check
    
    res.status(200).json({ 
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({ 
      status: 'not ready',
      error: error.message 
    });
  }
}

/**
 * Liveness check (for Kubernetes)
 * Returns 200 if app is alive (even if not ready)
 */
export function livenessHandler(req, res) {
  res.status(200).json({ 
    status: 'alive',
    timestamp: new Date().toISOString()
  });
}

/**
 * Format uptime into human-readable string
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  
  return parts.join(' ');
}

export default {
  register,
  metricsMiddleware,
  metricsHandler,
  healthCheckHandler,
  readinessHandler,
  livenessHandler,
  updateDbPoolMetrics,
  updateQueueMetrics,
  // Export individual metrics for use in other services
  httpRequestDuration,
  httpRequestCounter,
  activeConnections,
  userSignups,
  revenue,
  invoiceStatus,
  serviceProvisioning,
  emailsSent,
  smsSent,
  rateLimitHits,
  authFailures,
  webhookDeliveries
};
