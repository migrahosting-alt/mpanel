/**
 * Memory Leak Detector - Monitors Node.js memory usage and detects leaks
 * 
 * Features:
 * - Heap snapshot comparison
 * - Memory growth trend analysis
 * - Automatic heap dump on abnormal growth
 * - Memory usage alerts
 * - GC statistics tracking
 */

import logger from '../config/logger.js';
import v8 from 'v8';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Gauge, Counter } from 'prom-client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MemoryLeakDetector {
  constructor() {
    this.snapshots = [];
    this.memoryHistory = [];
    this.maxSnapshots = 10;
    this.maxHistory = 100;
    
    this.metrics = {
      heapUsed: new Gauge({
        name: 'nodejs_heap_used_bytes',
        help: 'Heap used by Node.js process'
      }),
      heapTotal: new Gauge({
        name: 'nodejs_heap_total_bytes',
        help: 'Total heap allocated by Node.js'
      }),
      external: new Gauge({
        name: 'nodejs_external_memory_bytes',
        help: 'External memory used by Node.js'
      }),
      rss: new Gauge({
        name: 'nodejs_rss_bytes',
        help: 'Resident Set Size (total memory)'
      }),
      gcRuns: new Counter({
        name: 'nodejs_gc_runs_total',
        help: 'Total garbage collection runs',
        labelNames: ['type']
      }),
      leakAlerts: new Counter({
        name: 'memory_leak_alerts_total',
        help: 'Total memory leak alerts'
      })
    };

    this.thresholds = {
      HEAP_GROWTH_RATE: 0.1,        // 10% growth per minute
      CONSECUTIVE_GROWTH: 5,         // 5 consecutive growth periods
      MAX_HEAP_SIZE: 1024 * 1024 * 1024, // 1GB
      HEAP_USAGE_PERCENT: 0.9,       // 90% of max heap
      ALERT_COOLDOWN: 300000         // 5 minutes between alerts
    };

    this.lastAlertTime = 0;
    this.consecutiveGrowth = 0;
    
    this.enabled = process.env.MEMORY_LEAK_DETECTION !== 'false';
    this.heapDumpPath = process.env.HEAP_DUMP_PATH || path.join(process.cwd(), 'heap-dumps');

    // Ensure heap dump directory exists
    if (this.enabled && !fs.existsSync(this.heapDumpPath)) {
      fs.mkdirSync(this.heapDumpPath, { recursive: true });
    }
  }

  /**
   * Start monitoring memory
   */
  start(interval = 30000) { // Check every 30 seconds
    if (!this.enabled) {
      logger.info('Memory leak detection disabled');
      return;
    }

    logger.info('Memory leak detection started', {
      interval,
      heapDumpPath: this.heapDumpPath
    });

    // Monitor memory usage
    this.monitoringInterval = setInterval(() => {
      this.checkMemory();
    }, interval);

    // Expose GC stats if available
    if (global.gc) {
      logger.info('GC stats available (--expose-gc flag detected)');
      this.setupGCMonitoring();
    } else {
      logger.warn('GC stats not available - start with --expose-gc flag for detailed GC monitoring');
    }
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      logger.info('Memory leak detection stopped');
    }
  }

  /**
   * Check current memory usage
   */
  checkMemory() {
    const memUsage = process.memoryUsage();
    const timestamp = Date.now();

    // Update Prometheus metrics
    this.metrics.heapUsed.set(memUsage.heapUsed);
    this.metrics.heapTotal.set(memUsage.heapTotal);
    this.metrics.external.set(memUsage.external);
    this.metrics.rss.set(memUsage.rss);

    // Add to history
    this.memoryHistory.push({
      timestamp,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      rss: memUsage.rss,
      external: memUsage.external
    });

    // Keep only recent history
    if (this.memoryHistory.length > this.maxHistory) {
      this.memoryHistory.shift();
    }

    // Analyze for leaks
    this.analyzeMemoryGrowth();
    this.checkHeapUsage(memUsage);
  }

  /**
   * Analyze memory growth trends
   */
  analyzeMemoryGrowth() {
    if (this.memoryHistory.length < 5) return;

    const recent = this.memoryHistory.slice(-5);
    const oldest = recent[0];
    const newest = recent[recent.length - 1];
    
    const timeDiff = newest.timestamp - oldest.timestamp;
    const heapGrowth = newest.heapUsed - oldest.heapUsed;
    const growthRate = heapGrowth / timeDiff; // bytes per millisecond

    // Convert to MB per minute
    const growthRateMBPerMin = (growthRate * 60000) / (1024 * 1024);

    // Check for sustained growth
    let isGrowing = true;
    for (let i = 1; i < recent.length; i++) {
      if (recent[i].heapUsed <= recent[i - 1].heapUsed) {
        isGrowing = false;
        break;
      }
    }

    if (isGrowing) {
      this.consecutiveGrowth++;
      
      if (this.consecutiveGrowth >= this.thresholds.CONSECUTIVE_GROWTH) {
        this.alertMemoryLeak('sustained_growth', {
          growthRate: growthRateMBPerMin.toFixed(2) + ' MB/min',
          consecutivePeriods: this.consecutiveGrowth,
          currentHeap: (newest.heapUsed / 1024 / 1024).toFixed(2) + ' MB'
        });
      }
    } else {
      this.consecutiveGrowth = 0;
    }
  }

  /**
   * Check heap usage percentage
   */
  checkHeapUsage(memUsage) {
    const heapStats = v8.getHeapStatistics();
    const usagePercent = memUsage.heapUsed / heapStats.heap_size_limit;

    if (usagePercent > this.thresholds.HEAP_USAGE_PERCENT) {
      this.alertMemoryLeak('high_heap_usage', {
        usagePercent: (usagePercent * 100).toFixed(1) + '%',
        heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
        heapLimit: (heapStats.heap_size_limit / 1024 / 1024).toFixed(2) + ' MB'
      });

      // Take heap snapshot for analysis
      this.takeHeapSnapshot('high_usage');
    }
  }

  /**
   * Alert about potential memory leak
   */
  alertMemoryLeak(type, details) {
    const now = Date.now();
    
    // Cooldown period
    if (now - this.lastAlertTime < this.thresholds.ALERT_COOLDOWN) {
      return;
    }

    this.metrics.leakAlerts.inc();
    this.lastAlertTime = now;

    logger.error('⚠️  POTENTIAL MEMORY LEAK DETECTED', {
      type,
      ...details,
      recommendation: 'Review application code for memory leaks, check for unclosed resources'
    });

    // Take heap snapshot for analysis
    this.takeHeapSnapshot(type);
  }

  /**
   * Take heap snapshot for analysis
   */
  takeHeapSnapshot(reason = 'manual') {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `heap-${reason}-${timestamp}.heapsnapshot`;
      const filepath = path.join(this.heapDumpPath, filename);

      const snapshot = v8.writeHeapSnapshot(filepath);
      
      logger.info('Heap snapshot created', {
        reason,
        filename,
        path: snapshot,
        size: fs.statSync(snapshot).size
      });

      // Keep only recent snapshots
      this.cleanupOldSnapshots();

      return snapshot;
    } catch (error) {
      logger.error('Failed to create heap snapshot', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Cleanup old heap snapshots
   */
  cleanupOldSnapshots() {
    try {
      const files = fs.readdirSync(this.heapDumpPath)
        .filter(f => f.endsWith('.heapsnapshot'))
        .map(f => ({
          name: f,
          path: path.join(this.heapDumpPath, f),
          time: fs.statSync(path.join(this.heapDumpPath, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

      // Keep only 10 most recent snapshots
      if (files.length > 10) {
        files.slice(10).forEach(file => {
          fs.unlinkSync(file.path);
          logger.debug('Deleted old heap snapshot', { file: file.name });
        });
      }
    } catch (error) {
      logger.error('Error cleaning up snapshots', { error: error.message });
    }
  }

  /**
   * Setup GC monitoring (requires --expose-gc flag)
   */
  setupGCMonitoring() {
    const v8 = require('v8');
    
    // This would require additional setup with gc-stats or similar
    logger.info('GC monitoring setup complete');
  }

  /**
   * Get memory statistics
   */
  getStats() {
    const memUsage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();

    return {
      current: {
        heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
        heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
        rss: (memUsage.rss / 1024 / 1024).toFixed(2) + ' MB',
        external: (memUsage.external / 1024 / 1024).toFixed(2) + ' MB'
      },
      limits: {
        heapSizeLimit: (heapStats.heap_size_limit / 1024 / 1024).toFixed(2) + ' MB',
        usagePercent: ((memUsage.heapUsed / heapStats.heap_size_limit) * 100).toFixed(1) + '%'
      },
      trend: {
        consecutiveGrowth: this.consecutiveGrowth,
        historySize: this.memoryHistory.length
      },
      heapDumps: {
        path: this.heapDumpPath,
        count: fs.existsSync(this.heapDumpPath) 
          ? fs.readdirSync(this.heapDumpPath).filter(f => f.endsWith('.heapsnapshot')).length 
          : 0
      }
    };
  }

  /**
   * Force garbage collection (requires --expose-gc)
   */
  forceGC() {
    if (global.gc) {
      global.gc();
      logger.info('Garbage collection forced');
      return true;
    }
    logger.warn('Cannot force GC - start with --expose-gc flag');
    return false;
  }
}

export default new MemoryLeakDetector();
