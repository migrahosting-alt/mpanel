/**
 * Connection Pool Monitor - Advanced PostgreSQL pool monitoring and optimization
 * 
 * Features:
 * - Real-time pool metrics (idle, active, waiting)
 * - Dynamic pool sizing based on load patterns
 * - Connection leak detection
 * - Pool saturation alerts
 * - Query queue depth tracking
 */

import logger from '../config/logger.js';
import { register as prometheusRegistry, Gauge, Counter, Histogram } from 'prom-client';

class ConnectionPoolMonitor {
  constructor() {
    this.metrics = {
      totalConnections: new Gauge({
        name: 'db_pool_connections_total',
        help: 'Total number of connections in pool',
        registers: [prometheusRegistry]
      }),
      idleConnections: new Gauge({
        name: 'db_pool_connections_idle',
        help: 'Number of idle connections',
        registers: [prometheusRegistry]
      }),
      activeConnections: new Gauge({
        name: 'db_pool_connections_active',
        help: 'Number of active connections',
        registers: [prometheusRegistry]
      }),
      waitingConnections: new Gauge({
        name: 'db_pool_connections_waiting',
        help: 'Number of connections waiting in queue',
        registers: [prometheusRegistry]
      }),
      connectionAcquireTime: new Histogram({
        name: 'db_pool_connection_acquire_duration_seconds',
        help: 'Time to acquire connection from pool',
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
        registers: [prometheusRegistry]
      }),
      connectionErrors: new Counter({
        name: 'db_pool_connection_errors_total',
        help: 'Total connection errors',
        labelNames: ['error_type'],
        registers: [prometheusRegistry]
      }),
      poolSaturation: new Gauge({
        name: 'db_pool_saturation_ratio',
        help: 'Ratio of active connections to max pool size (0-1)',
        registers: [prometheusRegistry]
      })
    };

    this.poolStats = {
      connectionLifetimes: [],
      peakUsage: 0,
      lastSaturationAlert: 0,
      lastLeakCheck: 0
    };

    this.thresholds = {
      SATURATION_WARNING: 0.75,  // Warn at 75% pool capacity
      SATURATION_CRITICAL: 0.9,  // Critical at 90% pool capacity
      LEAK_CHECK_INTERVAL: 60000, // Check for leaks every minute
      SATURATION_ALERT_COOLDOWN: 300000 // 5 minutes between saturation alerts
    };
  }

  /**
   * Start monitoring a database pool
   */
  monitorPool(pool) {
    // Track pool metrics every 5 seconds
    setInterval(() => {
      this.collectPoolMetrics(pool);
    }, 5000);

    // Connection leak detection every minute
    setInterval(() => {
      this.detectConnectionLeaks(pool);
    }, this.thresholds.LEAK_CHECK_INTERVAL);

    // Wrap pool.connect to track acquisition time
    const originalConnect = pool.connect.bind(pool);
    pool.connect = async (...args) => {
      const startTime = Date.now();
      const end = this.metrics.connectionAcquireTime.startTimer();
      
      try {
        const client = await originalConnect(...args);
        const duration = Date.now() - startTime;
        end();
        
        if (duration > 100) {
          logger.warn('Slow connection acquisition', {
            duration,
            totalConnections: pool.totalCount,
            idleConnections: pool.idleCount,
            waitingCount: pool.waitingCount
          });
        }
        
        // Track connection lifetime (with safety check)
        if (client && client.release) {
          const connectionStartTime = Date.now();
          const originalRelease = client.release.bind(client);
          client.release = (...releaseArgs) => {
            const lifetime = Date.now() - connectionStartTime;
            this.poolStats.connectionLifetimes.push(lifetime);
            
            // Keep only last 1000 lifetimes
            if (this.poolStats.connectionLifetimes.length > 1000) {
              this.poolStats.connectionLifetimes.shift();
            }
            
            return originalRelease(...releaseArgs);
          };
        }
        
        return client;
      } catch (error) {
        end();
        this.metrics.connectionErrors.inc({ error_type: error.code || 'unknown' });
        logger.error('Connection acquisition failed', {
          error: error.message,
          code: error.code,
          totalConnections: pool.totalCount,
          waitingCount: pool.waitingCount
        });
        throw error;
      }
    };

    // Handle pool errors
    pool.on('error', (error, client) => {
      this.metrics.connectionErrors.inc({ error_type: 'pool_error' });
      logger.error('Unexpected pool error', {
        error: error.message,
        code: error.code
      });
    });

    // Handle pool connection events
    pool.on('connect', (client) => {
      logger.debug('New client connected to pool', {
        totalConnections: pool.totalCount
      });
    });

    pool.on('acquire', (client) => {
      logger.debug('Client acquired from pool', {
        idleConnections: pool.idleCount,
        activeConnections: pool.totalCount - pool.idleCount
      });
    });

    pool.on('remove', (client) => {
      logger.debug('Client removed from pool', {
        totalConnections: pool.totalCount
      });
    });

    logger.info('Connection pool monitoring initialized', {
      minConnections: pool.options.min,
      maxConnections: pool.options.max
    });
  }

  /**
   * Collect current pool metrics
   */
  collectPoolMetrics(pool) {
    const totalCount = pool.totalCount;
    const idleCount = pool.idleCount;
    const waitingCount = pool.waitingCount;
    const activeCount = totalCount - idleCount;
    const maxSize = pool.options.max;
    const saturation = totalCount / maxSize;

    // Update Prometheus metrics
    this.metrics.totalConnections.set(totalCount);
    this.metrics.idleConnections.set(idleCount);
    this.metrics.activeConnections.set(activeCount);
    this.metrics.waitingConnections.set(waitingCount);
    this.metrics.poolSaturation.set(saturation);

    // Track peak usage
    if (activeCount > this.poolStats.peakUsage) {
      this.poolStats.peakUsage = activeCount;
    }

    // Saturation warnings
    const now = Date.now();
    if (saturation >= this.thresholds.SATURATION_CRITICAL) {
      if (now - this.poolStats.lastSaturationAlert > this.thresholds.SATURATION_ALERT_COOLDOWN) {
        logger.error('CRITICAL: Database pool near saturation', {
          saturation: `${(saturation * 100).toFixed(1)}%`,
          active: activeCount,
          max: maxSize,
          waiting: waitingCount,
          recommendation: 'Consider increasing pool size or optimizing queries'
        });
        this.poolStats.lastSaturationAlert = now;
      }
    } else if (saturation >= this.thresholds.SATURATION_WARNING) {
      if (now - this.poolStats.lastSaturationAlert > this.thresholds.SATURATION_ALERT_COOLDOWN) {
        logger.warn('Database pool saturation warning', {
          saturation: `${(saturation * 100).toFixed(1)}%`,
          active: activeCount,
          max: maxSize,
          waiting: waitingCount
        });
        this.poolStats.lastSaturationAlert = now;
      }
    }

    // Alert on waiting connections
    if (waitingCount > 0) {
      logger.warn('Connections waiting for pool availability', {
        waiting: waitingCount,
        idle: idleCount,
        active: activeCount,
        total: totalCount,
        max: maxSize
      });
    }
  }

  /**
   * Detect potential connection leaks
   */
  detectConnectionLeaks(pool) {
    const activeCount = pool.totalCount - pool.idleCount;
    const idleCount = pool.idleCount;
    
    // Connection leak heuristic: 
    // - All connections active for extended period
    // - No idle connections
    // - Saturation above critical threshold
    if (idleCount === 0 && activeCount >= pool.options.max * this.thresholds.SATURATION_CRITICAL) {
      logger.error('Potential connection leak detected', {
        active: activeCount,
        idle: idleCount,
        total: pool.totalCount,
        max: pool.options.max,
        recommendation: 'Check for unreleased connections in code'
      });
    }

    // Analyze connection lifetimes
    if (this.poolStats.connectionLifetimes.length > 100) {
      const avgLifetime = this.poolStats.connectionLifetimes.reduce((a, b) => a + b, 0) / this.poolStats.connectionLifetimes.length;
      const maxLifetime = Math.max(...this.poolStats.connectionLifetimes);
      
      // Warn if connections held for very long time (> 30 seconds average)
      if (avgLifetime > 30000) {
        logger.warn('Long-lived database connections detected', {
          averageLifetime: `${(avgLifetime / 1000).toFixed(2)}s`,
          maxLifetime: `${(maxLifetime / 1000).toFixed(2)}s`,
          recommendation: 'Optimize transaction duration and ensure proper connection release'
        });
      }
    }
  }

  /**
   * Get pool statistics
   */
  getPoolStats(pool) {
    const avgLifetime = this.poolStats.connectionLifetimes.length > 0
      ? this.poolStats.connectionLifetimes.reduce((a, b) => a + b, 0) / this.poolStats.connectionLifetimes.length
      : 0;

    return {
      current: {
        total: pool.totalCount,
        idle: pool.idleCount,
        active: pool.totalCount - pool.idleCount,
        waiting: pool.waitingCount
      },
      capacity: {
        min: pool.options.min,
        max: pool.options.max,
        saturation: pool.totalCount / pool.options.max
      },
      performance: {
        peakUsage: this.poolStats.peakUsage,
        averageConnectionLifetime: avgLifetime,
        maxConnectionLifetime: this.poolStats.connectionLifetimes.length > 0 
          ? Math.max(...this.poolStats.connectionLifetimes) 
          : 0
      },
      recommendations: this.getRecommendations(pool)
    };
  }

  /**
   * Generate recommendations based on pool behavior
   */
  getRecommendations(pool) {
    const recommendations = [];
    const saturation = pool.totalCount / pool.options.max;
    const idleRatio = pool.idleCount / pool.totalCount;

    // Too many idle connections
    if (idleRatio > 0.7 && pool.totalCount > pool.options.min) {
      recommendations.push({
        type: 'reduce_pool_size',
        message: 'Pool has many idle connections - consider reducing max size',
        current: pool.options.max,
        suggested: Math.max(pool.options.min, Math.ceil(this.poolStats.peakUsage * 1.2))
      });
    }

    // Frequent saturation
    if (saturation > this.thresholds.SATURATION_WARNING) {
      recommendations.push({
        type: 'increase_pool_size',
        message: 'Pool frequently saturated - consider increasing max size',
        current: pool.options.max,
        suggested: Math.ceil(pool.options.max * 1.5)
      });
    }

    // Waiting connections
    if (pool.waitingCount > 0) {
      recommendations.push({
        type: 'urgent_action',
        message: 'Connections waiting - immediate action required',
        waitingCount: pool.waitingCount,
        actions: ['Increase pool size', 'Optimize slow queries', 'Check for connection leaks']
      });
    }

    return recommendations;
  }

  /**
   * Generate hourly pool health report
   */
  generatePoolReport(pool) {
    const stats = this.getPoolStats(pool);
    
    logger.info('Database Pool Health Report', {
      timestamp: new Date().toISOString(),
      currentUsage: stats.current,
      capacity: stats.capacity,
      performance: stats.performance,
      recommendations: stats.recommendations
    });

    return stats;
  }
}

export default new ConnectionPoolMonitor();
