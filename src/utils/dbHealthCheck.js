import pool from '../db/index.js';
import logger from '../config/logger.js';
import { captureException } from '../config/sentry.js';

/**
 * Database Health Check Utility
 * 
 * Provides advanced database health monitoring and connection pool statistics
 * for production observability and K8s readiness probes.
 */

/**
 * Check database connectivity with timeout
 * @param {number} timeoutMs - Query timeout in milliseconds (default: 5000)
 * @returns {Promise<{healthy: boolean, latency: number, error?: string}>}
 */
export async function checkDatabaseHealth(timeoutMs = 5000) {
  const startTime = Date.now();
  
  try {
    // Use a simple query with timeout
    const result = await pool.query(
      'SELECT 1 as health_check, NOW() as server_time',
      [],
      { timeout: timeoutMs }
    );
    
    const latency = Date.now() - startTime;
    
    return {
      healthy: result.rows.length > 0,
      latency,
      serverTime: result.rows[0]?.server_time
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    logger.error('Database health check failed:', error);
    captureException(error, { tags: { component: 'database-health' } });
    
    return {
      healthy: false,
      latency,
      error: error.message
    };
  }
}

/**
 * Get detailed database pool statistics
 * @returns {Promise<object>} Pool statistics
 */
export async function getPoolStats() {
  try {
    return {
      totalCount: pool.totalCount,     // Total clients in pool
      idleCount: pool.idleCount,       // Idle clients available
      waitingCount: pool.waitingCount, // Clients waiting for connection
      activeCount: pool.totalCount - pool.idleCount, // Active queries
      maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '20', 10)
    };
  } catch (error) {
    logger.error('Failed to get pool stats:', error);
    return {
      totalCount: 0,
      idleCount: 0,
      waitingCount: 0,
      activeCount: 0,
      maxConnections: 0,
      error: error.message
    };
  }
}

/**
 * Check if database pool is healthy
 * Considers pool healthy if:
 * - Has available idle connections OR
 * - Active connections < max connections
 * @returns {Promise<{healthy: boolean, stats: object, warnings: string[]}>}
 */
export async function checkPoolHealth() {
  const stats = await getPoolStats();
  const warnings = [];
  
  // Check for warning conditions
  if (stats.waitingCount > 0) {
    warnings.push(`${stats.waitingCount} queries waiting for connections`);
  }
  
  if (stats.activeCount >= stats.maxConnections * 0.8) {
    warnings.push(`Pool usage at ${Math.round((stats.activeCount / stats.maxConnections) * 100)}%`);
  }
  
  if (stats.idleCount === 0 && stats.activeCount === stats.maxConnections) {
    warnings.push('Pool exhausted - all connections in use');
  }
  
  const healthy = stats.idleCount > 0 || stats.activeCount < stats.maxConnections;
  
  return {
    healthy,
    stats,
    warnings
  };
}

/**
 * Comprehensive database health check
 * Combines connectivity check and pool health
 * @returns {Promise<{healthy: boolean, connectivity: object, pool: object}>}
 */
export async function comprehensiveHealthCheck() {
  const [connectivity, poolHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkPoolHealth()
  ]);
  
  return {
    healthy: connectivity.healthy && poolHealth.healthy,
    connectivity,
    pool: poolHealth
  };
}

/**
 * Monitor database pool and update Prometheus metrics
 * Call this periodically (e.g., every 30 seconds) or on-demand
 */
export async function updateDatabaseMetrics() {
  try {
    const stats = await getPoolStats();
    
    // Update Prometheus metrics if available
    try {
      const { updateDbPoolMetrics } = await import('../middleware/prometheus.js');
      updateDbPoolMetrics(stats);
    } catch (error) {
      // Prometheus middleware might not be loaded yet
      logger.debug('Prometheus metrics not available:', error.message);
    }
    
    // Log warning if pool is unhealthy
    const poolHealth = await checkPoolHealth();
    if (!poolHealth.healthy || poolHealth.warnings.length > 0) {
      logger.warn('Database pool health issues:', {
        healthy: poolHealth.healthy,
        warnings: poolHealth.warnings,
        stats: poolHealth.stats
      });
    }
    
    return stats;
  } catch (error) {
    logger.error('Failed to update database metrics:', error);
    captureException(error, { tags: { component: 'database-metrics' } });
    return null;
  }
}

/**
 * Start periodic database health monitoring
 * @param {number} intervalMs - Monitoring interval in milliseconds (default: 30000)
 * @returns {NodeJS.Timeout} Interval handle (use clearInterval to stop)
 */
export function startDatabaseMonitoring(intervalMs = 30000) {
  logger.info(`Starting database health monitoring (interval: ${intervalMs}ms)`);
  
  // Initial update
  updateDatabaseMetrics();
  
  // Periodic updates
  const interval = setInterval(() => {
    updateDatabaseMetrics();
  }, intervalMs);
  
  return interval;
}

/**
 * Test database connection with detailed diagnostics
 * Useful for debugging connection issues
 * @returns {Promise<object>} Detailed connection info
 */
export async function diagnosticCheck() {
  const results = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    databaseUrl: process.env.DATABASE_URL ? '✓ Set' : '✗ Not set',
    checks: {}
  };
  
  // Check 1: Database connectivity
  const connectivity = await checkDatabaseHealth();
  results.checks.connectivity = {
    ...connectivity,
    status: connectivity.healthy ? '✓ Healthy' : '✗ Failed'
  };
  
  // Check 2: Pool statistics
  const stats = await getPoolStats();
  results.checks.pool = {
    ...stats,
    utilization: `${stats.activeCount}/${stats.maxConnections}`,
    status: stats.idleCount > 0 ? '✓ Available' : '⚠ Saturated'
  };
  
  // Check 3: Pool health
  const poolHealth = await checkPoolHealth();
  results.checks.poolHealth = {
    healthy: poolHealth.healthy,
    warnings: poolHealth.warnings,
    status: poolHealth.healthy ? '✓ Healthy' : '✗ Unhealthy'
  };
  
  // Check 4: Query performance test
  try {
    const start = Date.now();
    await pool.query('SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = \'public\'');
    const queryTime = Date.now() - start;
    
    results.checks.queryPerformance = {
      latency: queryTime,
      status: queryTime < 100 ? '✓ Fast' : queryTime < 500 ? '⚠ Slow' : '✗ Very Slow'
    };
  } catch (error) {
    results.checks.queryPerformance = {
      error: error.message,
      status: '✗ Failed'
    };
  }
  
  // Overall health
  results.overallHealth = 
    connectivity.healthy && 
    poolHealth.healthy && 
    (!results.checks.queryPerformance.error);
  
  return results;
}

export default {
  checkDatabaseHealth,
  getPoolStats,
  checkPoolHealth,
  comprehensiveHealthCheck,
  updateDatabaseMetrics,
  startDatabaseMonitoring,
  diagnosticCheck
};
