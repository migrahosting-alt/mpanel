// src/services/performanceMonitoring.js
/**
 * Performance monitoring service using built-in Node.js Performance API
 * Tracks request latency, memory usage, CPU usage, and custom metrics
 */

import { performance, PerformanceObserver } from 'perf_hooks';
import logger from '../config/logger.js';
import { cache, CacheNamespace, CacheTTL } from './cache.js';

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.enabled = process.env.PERFORMANCE_MONITORING !== 'false';
    this.thresholds = {
      slowRequest: parseInt(process.env.SLOW_REQUEST_MS) || 1000,
      highMemory: parseInt(process.env.HIGH_MEMORY_MB) || 512,
    };

    if (this.enabled) {
      this.initializeObservers();
    }
  }

  /**
   * Initialize performance observers
   */
  initializeObservers() {
    // HTTP request observer
    const httpObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > this.thresholds.slowRequest) {
          logger.warn('Slow HTTP request detected', {
            name: entry.name,
            duration: entry.duration.toFixed(2),
            startTime: entry.startTime.toFixed(2),
          });
        }
      }
    });

    httpObserver.observe({ entryTypes: ['measure'], buffered: true });

    // Function call observer
    const functionObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.recordMetric('function_calls', entry.name, entry.duration);
      }
    });

    functionObserver.observe({ entryTypes: ['function'], buffered: true });
  }

  /**
   * Mark start of operation
   */
  mark(name) {
    if (!this.enabled) return;
    performance.mark(`${name}-start`);
  }

  /**
   * Mark end of operation and measure duration
   */
  measure(name) {
    if (!this.enabled) return 0;

    try {
      performance.mark(`${name}-end`);
      const measure = performance.measure(
        name,
        `${name}-start`,
        `${name}-end`
      );

      // Clean up marks
      performance.clearMarks(`${name}-start`);
      performance.clearMarks(`${name}-end`);

      return measure.duration;
    } catch (error) {
      logger.error('Performance measure error:', error);
      return 0;
    }
  }

  /**
   * Measure async function execution time
   */
  async measureAsync(name, fn) {
    this.mark(name);
    try {
      const result = await fn();
      const duration = this.measure(name);
      this.recordMetric('async_operations', name, duration);
      return result;
    } catch (error) {
      this.measure(name);
      throw error;
    }
  }

  /**
   * Measure sync function execution time
   */
  measureSync(name, fn) {
    this.mark(name);
    try {
      const result = fn();
      const duration = this.measure(name);
      this.recordMetric('sync_operations', name, duration);
      return result;
    } catch (error) {
      this.measure(name);
      throw error;
    }
  }

  /**
   * Record custom metric
   */
  recordMetric(category, name, value) {
    const key = `${category}:${name}`;
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        count: 0,
        total: 0,
        min: Infinity,
        max: -Infinity,
        avg: 0,
      });
    }

    const metric = this.metrics.get(key);
    metric.count++;
    metric.total += value;
    metric.min = Math.min(metric.min, value);
    metric.max = Math.max(metric.max, value);
    metric.avg = metric.total / metric.count;

    this.metrics.set(key, metric);
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats() {
    const usage = process.memoryUsage();
    
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
      rss: Math.round(usage.rss / 1024 / 1024),
      arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024),
    };
  }

  /**
   * Get CPU usage statistics
   */
  getCpuStats() {
    const usage = process.cpuUsage();
    
    return {
      user: Math.round(usage.user / 1000), // milliseconds
      system: Math.round(usage.system / 1000),
      total: Math.round((usage.user + usage.system) / 1000),
    };
  }

  /**
   * Get event loop lag
   */
  async getEventLoopLag() {
    const start = Date.now();
    
    return new Promise((resolve) => {
      setImmediate(() => {
        const lag = Date.now() - start;
        resolve(lag);
      });
    });
  }

  /**
   * Get all performance metrics
   */
  async getMetrics() {
    const memory = this.getMemoryStats();
    const cpu = this.getCpuStats();
    const eventLoopLag = await this.getEventLoopLag();

    // Convert Map to object
    const customMetrics = {};
    for (const [key, value] of this.metrics.entries()) {
      customMetrics[key] = value;
    }

    return {
      memory,
      cpu,
      eventLoopLag,
      uptime: Math.round(process.uptime()),
      metrics: customMetrics,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    const summary = {
      totalMetrics: this.metrics.size,
      slowestOperations: [],
      mostFrequentOperations: [],
    };

    // Get slowest operations
    const sorted = Array.from(this.metrics.entries())
      .sort((a, b) => b[1].max - a[1].max)
      .slice(0, 10);

    summary.slowestOperations = sorted.map(([name, metric]) => ({
      name,
      maxDuration: metric.max.toFixed(2),
      avgDuration: metric.avg.toFixed(2),
      count: metric.count,
    }));

    // Get most frequent operations
    const frequent = Array.from(this.metrics.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);

    summary.mostFrequentOperations = frequent.map(([name, metric]) => ({
      name,
      count: metric.count,
      avgDuration: metric.avg.toFixed(2),
    }));

    return summary;
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics.clear();
    performance.clearMeasures();
    performance.clearMarks();
    logger.info('Performance metrics reset');
  }

  /**
   * Check if system is healthy
   */
  async healthCheck() {
    const memory = this.getMemoryStats();
    const eventLoopLag = await this.getEventLoopLag();

    const issues = [];

    if (memory.heapUsed > this.thresholds.highMemory) {
      issues.push(`High memory usage: ${memory.heapUsed}MB`);
    }

    if (eventLoopLag > 100) {
      issues.push(`High event loop lag: ${eventLoopLag}ms`);
    }

    return {
      healthy: issues.length === 0,
      issues,
      memory,
      eventLoopLag,
    };
  }

  /**
   * Start periodic metric collection
   */
  startCollection(intervalMs = 60000) {
    setInterval(async () => {
      const metrics = await this.getMetrics();
      
      // Store in cache for dashboards
      await cache.set(
        CacheNamespace.METRICS,
        `performance:${Date.now()}`,
        metrics,
        CacheTTL.DAY
      );

      // Log if unhealthy
      const health = await this.healthCheck();
      if (!health.healthy) {
        logger.warn('Performance health check failed', health.issues);
      }
    }, intervalMs);

    logger.info(`Performance monitoring started (interval: ${intervalMs}ms)`);
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Express middleware for request performance tracking
 */
export function performanceMiddleware(req, res, next) {
  const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;
  const start = performance.now();

  res.on('finish', () => {
    const duration = performance.now() - start;
    
    performanceMonitor.recordMetric('http_requests', req.path, duration);
    
    // Set performance header
    res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`);

    // Log slow requests
    if (duration > performanceMonitor.thresholds.slowRequest) {
      logger.warn('Slow request', {
        requestId,
        method: req.method,
        path: req.path,
        duration: duration.toFixed(2),
        statusCode: res.statusCode,
      });
    }
  });

  next();
}

export default performanceMonitor;
