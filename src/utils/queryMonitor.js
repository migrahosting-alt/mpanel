import logger from '../config/logger.js';
import { captureException } from '../config/sentry.js';
import { trackQueryForNPlusOne } from './nPlusOneDetector.js';
import { trackDatabaseQuery } from './apm.js';

/**
 * Database Query Performance Monitoring
 * 
 * Logs slow queries and provides query performance insights for optimization.
 */

// Configuration
const SLOW_QUERY_THRESHOLD_MS = parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '1000', 10); // 1 second default
const VERY_SLOW_QUERY_THRESHOLD_MS = parseInt(process.env.VERY_SLOW_QUERY_THRESHOLD_MS || '5000', 10); // 5 seconds
const ENABLE_QUERY_LOGGING = process.env.ENABLE_QUERY_LOGGING === 'true' || process.env.NODE_ENV === 'development';

// Query statistics
const queryStats = {
  totalQueries: 0,
  slowQueries: 0,
  verySlowQueries: 0,
  totalDuration: 0,
  queryTypes: new Map() // Track queries by type (SELECT, INSERT, UPDATE, DELETE)
};

/**
 * Wrap database query with performance monitoring
 * @param {Function} queryFn - Original query function
 * @param {string} sql - SQL query string
 * @param {Array} params - Query parameters
 * @param {string} context - Context/caller information
 * @returns {Promise<any>} Query result
 */
export async function monitoredQuery(queryFn, sql, params = [], context = 'unknown') {
  const startTime = Date.now();
  const queryType = extractQueryType(sql);
  
  try {
    const result = await queryFn(sql, params);
    const duration = Date.now() - startTime;
    
    // Update statistics
    updateQueryStats(queryType, duration);
    
    // Log slow queries
    if (duration >= SLOW_QUERY_THRESHOLD_MS) {
      logSlowQuery(sql, params, duration, context, 'slow');
    }
    
    if (duration >= VERY_SLOW_QUERY_THRESHOLD_MS) {
      logSlowQuery(sql, params, duration, context, 'very_slow');
    }

    // Track for N+1 detection (if requestId available)
    if (context && context.requestId) {
      trackQueryForNPlusOne(context.requestId, sql, params, duration);
    }

    // Track in APM (if transaction ID available)
    if (context && context.apmTransactionId) {
      trackDatabaseQuery(context.apmTransactionId, sql, {
        operation: queryType,
        duration,
        rows: result.rows?.length || result.rowCount || 0
      });
    }
    
    // Log all queries in development (if enabled)
    if (ENABLE_QUERY_LOGGING && process.env.NODE_ENV === 'development') {
      logger.debug('Database query executed', {
        sql: sanitizeQuery(sql),
        duration,
        queryType,
        context,
        rowCount: result.rows?.length || result.rowCount || 0
      });
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Database query failed', {
      sql: sanitizeQuery(sql),
      duration,
      queryType,
      context,
      error: error.message
    });
    
    captureException(error, {
      tags: { 
        component: 'database',
        queryType,
        duration,
        context
      },
      extra: {
        sql: sanitizeQuery(sql),
        params: sanitizeParams(params)
      }
    });
    
    throw error;
  }
}

/**
 * Extract query type from SQL (SELECT, INSERT, UPDATE, DELETE, etc.)
 */
function extractQueryType(sql) {
  const match = sql.trim().match(/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b/i);
  return match ? match[1].toUpperCase() : 'OTHER';
}

/**
 * Update query statistics
 */
function updateQueryStats(queryType, duration) {
  queryStats.totalQueries++;
  queryStats.totalDuration += duration;
  
  if (duration >= SLOW_QUERY_THRESHOLD_MS) {
    queryStats.slowQueries++;
  }
  
  if (duration >= VERY_SLOW_QUERY_THRESHOLD_MS) {
    queryStats.verySlowQueries++;
  }
  
  // Track by query type
  if (!queryStats.queryTypes.has(queryType)) {
    queryStats.queryTypes.set(queryType, { count: 0, totalDuration: 0 });
  }
  
  const typeStats = queryStats.queryTypes.get(queryType);
  typeStats.count++;
  typeStats.totalDuration += duration;
}

/**
 * Log slow query with details
 */
function logSlowQuery(sql, params, duration, context, severity) {
  const logData = {
    severity,
    sql: sanitizeQuery(sql),
    duration,
    durationSeconds: (duration / 1000).toFixed(2),
    context,
    params: sanitizeParams(params),
    threshold: severity === 'very_slow' ? VERY_SLOW_QUERY_THRESHOLD_MS : SLOW_QUERY_THRESHOLD_MS,
    timestamp: new Date().toISOString()
  };
  
  if (severity === 'very_slow') {
    logger.warn('⚠️ VERY SLOW QUERY detected', logData);
    
    // Also send to Sentry for very slow queries
    captureException(new Error('Very slow database query'), {
      level: 'warning',
      tags: {
        component: 'database',
        severity: 'very_slow',
        context
      },
      extra: logData
    });
  } else {
    logger.warn('🐌 Slow query detected', logData);
  }
}

/**
 * Sanitize query for logging (remove sensitive data, truncate long queries)
 */
function sanitizeQuery(sql) {
  if (!sql) return '';
  
  let sanitized = sql
    .replace(/password\s*=\s*'[^']*'/gi, "password='***'")
    .replace(/password\s*=\s*\$\d+/gi, "password=$***")
    .replace(/token\s*=\s*'[^']*'/gi, "token='***'")
    .replace(/secret\s*=\s*'[^']*'/gi, "secret='***'");
  
  // Truncate very long queries
  if (sanitized.length > 500) {
    sanitized = sanitized.substring(0, 500) + '... (truncated)';
  }
  
  return sanitized;
}

/**
 * Sanitize parameters for logging
 */
function sanitizeParams(params) {
  if (!Array.isArray(params)) return [];
  
  return params.map((param, index) => {
    // Redact potential sensitive fields
    if (typeof param === 'string' && (
      param.length > 50 || 
      param.includes('password') || 
      param.includes('token') ||
      param.includes('secret')
    )) {
      return `[REDACTED-${index}]`;
    }
    return param;
  });
}

/**
 * Get query statistics
 */
export function getQueryStats() {
  const stats = {
    ...queryStats,
    averageDuration: queryStats.totalQueries > 0 
      ? (queryStats.totalDuration / queryStats.totalQueries).toFixed(2)
      : 0,
    slowQueryPercentage: queryStats.totalQueries > 0
      ? ((queryStats.slowQueries / queryStats.totalQueries) * 100).toFixed(2)
      : 0,
    byType: {}
  };
  
  // Convert Map to object for JSON serialization
  for (const [type, typeStats] of queryStats.queryTypes.entries()) {
    stats.byType[type] = {
      count: typeStats.count,
      averageDuration: (typeStats.totalDuration / typeStats.count).toFixed(2)
    };
  }
  
  return stats;
}

/**
 * Reset query statistics (useful for testing or periodic resets)
 */
export function resetQueryStats() {
  queryStats.totalQueries = 0;
  queryStats.slowQueries = 0;
  queryStats.verySlowQueries = 0;
  queryStats.totalDuration = 0;
  queryStats.queryTypes.clear();
}

/**
 * Middleware to add query monitoring to pool
 * Wraps the pool.query method to add automatic monitoring
 * 
 * @param {object} pool - PostgreSQL pool instance
 * @returns {object} Pool with monitored query method
 */
export function addQueryMonitoring(pool) {
  const originalQuery = pool.query.bind(pool);
  
  pool.query = async function (sql, params) {
    // Get caller context from stack trace
    const stack = new Error().stack;
    const callerMatch = stack.split('\n')[2]?.match(/at\s+(.+?)\s+\(/);
    const context = callerMatch ? callerMatch[1] : 'unknown';
    
    return monitoredQuery(originalQuery, sql, params, context);
  };
  
  return pool;
}

/**
 * Create query monitoring report (for periodic logging)
 */
export function logQueryReport() {
  const stats = getQueryStats();
  
  if (stats.totalQueries === 0) {
    logger.info('No database queries executed since last report');
    return;
  }
  
  logger.info('📊 Database Query Performance Report', {
    totalQueries: stats.totalQueries,
    averageDuration: `${stats.averageDuration}ms`,
    slowQueries: stats.slowQueries,
    verySlowQueries: stats.verySlowQueries,
    slowQueryPercentage: `${stats.slowQueryPercentage}%`,
    byType: stats.byType
  });
  
  // Warn if slow query percentage is high
  if (parseFloat(stats.slowQueryPercentage) > 10) {
    logger.warn('⚠️ High percentage of slow queries detected!', {
      percentage: stats.slowQueryPercentage,
      recommendation: 'Consider adding database indexes or optimizing queries'
    });
  }
}

export default {
  monitoredQuery,
  getQueryStats,
  resetQueryStats,
  addQueryMonitoring,
  logQueryReport,
  SLOW_QUERY_THRESHOLD_MS,
  VERY_SLOW_QUERY_THRESHOLD_MS
};
