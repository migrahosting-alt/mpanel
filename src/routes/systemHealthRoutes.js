/**
 * System Health & Diagnostics Routes
 * Enterprise-grade health monitoring for production readiness
 */

import express from 'express';
import { pool } from '../config/database.js';
import logger from '../config/logger.js';

const router = express.Router();

/**
 * GET /api/system/health
 * Comprehensive health check
 * Public endpoint - no auth required
 */
router.get('/health', async (req, res) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || 'v1',
    uptime: process.uptime(),
    checks: {
      api: { status: 'ok' },
      database: { status: 'unknown' },
      memory: { status: 'unknown' },
      cpu: { status: 'unknown' }
    }
  };

  try {
    // Database check
    const dbStart = Date.now();
    const dbResult = await pool.query('SELECT NOW() as now, COUNT(*) as product_count FROM products');
    const dbLatency = Date.now() - dbStart;
    
    healthCheck.checks.database = {
      status: 'ok',
      latency: `${dbLatency}ms`,
      products: dbResult.rows[0]?.product_count || 0,
      serverTime: dbResult.rows[0]?.now
    };
  } catch (error) {
    healthCheck.status = 'degraded';
    healthCheck.checks.database = {
      status: 'error',
      error: error.message
    };
    logger.error('Database health check failed', { error: error.message });
  }

  // Memory check
  const memUsage = process.memoryUsage();
  const memoryMB = {
    rss: Math.round(memUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024)
  };

  healthCheck.checks.memory = {
    status: memoryMB.heapUsed < 1024 ? 'ok' : 'warning',
    ...memoryMB,
    unit: 'MB'
  };

  // CPU check
  const cpuUsage = process.cpuUsage();
  healthCheck.checks.cpu = {
    status: 'ok',
    user: cpuUsage.user,
    system: cpuUsage.system,
    unit: 'microseconds'
  };

  // Overall status
  const hasErrors = Object.values(healthCheck.checks).some(check => check.status === 'error');
  const hasWarnings = Object.values(healthCheck.checks).some(check => check.status === 'warning');
  
  if (hasErrors) {
    healthCheck.status = 'unhealthy';
  } else if (hasWarnings) {
    healthCheck.status = 'degraded';
  }

  const statusCode = healthCheck.status === 'healthy' ? 200 : 
                     healthCheck.status === 'degraded' ? 200 : 503;

  res.status(statusCode).json(healthCheck);
});

/**
 * GET /api/system/ready
 * Kubernetes readiness probe
 */
router.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ready: true, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ 
      ready: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/system/live
 * Kubernetes liveness probe
 */
router.get('/live', (req, res) => {
  res.json({ 
    alive: true, 
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/system/metrics
 * Basic metrics for monitoring
 * Public endpoint - no auth required
 */
router.get('/metrics', async (req, res) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    platform: {
      node: process.version,
      platform: process.platform,
      arch: process.arch
    }
  };

  try {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM products WHERE "isActive" = true) as active_products,
        (SELECT COUNT(*) FROM customers) as total_customers,
        (SELECT COUNT(*) FROM orders WHERE status = 'completed') as completed_orders
    `);
    
    metrics.business = stats.rows[0];
  } catch (error) {
    logger.error('Metrics query failed', { error: error.message });
    metrics.business = { error: error.message };
  }

  res.json(metrics);
});

export default router;
