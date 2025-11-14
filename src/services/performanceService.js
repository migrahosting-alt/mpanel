const pool = require('../config/database');
const redis = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Performance Optimization Suite Service
 * 
 * Features:
 * - Multi-layer Redis caching strategy
 * - Query optimization analyzer
 * - Database connection pooling optimization
 * - CDN integration and management
 * - Asset optimization (compression, minification)
 * - Performance budgets and monitoring
 * - Core Web Vitals tracking
 * - Lazy loading and code splitting recommendations
 */

class PerformanceService {
  constructor() {
    this.cacheConfig = {
      // Cache TTLs in seconds
      static: 86400, // 24 hours for static content
      dynamic: 300, // 5 minutes for dynamic content
      query: 60, // 1 minute for database queries
      session: 3600, // 1 hour for session data
      user: 900 // 15 minutes for user data
    };

    this.performanceBudgets = {
      // Core Web Vitals targets
      LCP: 2500, // Largest Contentful Paint (ms)
      FID: 100, // First Input Delay (ms)
      CLS: 0.1, // Cumulative Layout Shift
      FCP: 1800, // First Contentful Paint (ms)
      TTFB: 600 // Time to First Byte (ms)
    };
  }

  /**
   * Multi-layer caching strategy
   */

  /**
   * Get from cache with fallback to database
   * 
   * @param {string} key - Cache key
   * @param {Function} fetchFunction - Function to fetch data if cache miss
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<any>}
   */
  async cacheGet(key, fetchFunction, ttl = this.cacheConfig.dynamic) {
    try {
      // Try L1 cache (Redis)
      const cached = await redis.get(key);
      
      if (cached) {
        logger.debug('Cache hit (L1)', { key });
        return JSON.parse(cached);
      }

      // Cache miss - fetch from source
      logger.debug('Cache miss', { key });
      const data = await fetchFunction();

      // Store in cache
      if (data !== null && data !== undefined) {
        await redis.setex(key, ttl, JSON.stringify(data));
      }

      return data;
    } catch (error) {
      logger.error('Cache error, falling back to direct fetch:', error);
      return await fetchFunction();
    }
  }

  /**
   * Invalidate cache
   * 
   * @param {string|string[]} keys - Cache key(s) to invalidate
   */
  async cacheInvalidate(keys) {
    try {
      const keyArray = Array.isArray(keys) ? keys : [keys];
      
      for (const key of keyArray) {
        // Support wildcard invalidation
        if (key.includes('*')) {
          const pattern = key;
          const matchingKeys = await redis.keys(pattern);
          
          if (matchingKeys.length > 0) {
            await redis.del(...matchingKeys);
            logger.info('Cache invalidated (wildcard)', { pattern, count: matchingKeys.length });
          }
        } else {
          await redis.del(key);
          logger.debug('Cache invalidated', { key });
        }
      }
    } catch (error) {
      logger.error('Failed to invalidate cache:', error);
    }
  }

  /**
   * Query optimization analyzer
   */

  /**
   * Analyze slow queries and provide optimization recommendations
   * 
   * @param {number} tenantId
   * @param {number} thresholdMs - Queries slower than this will be analyzed
   * @returns {Promise<Array>}
   */
  async analyzeSlowQueries(tenantId, thresholdMs = 1000) {
    try {
      // Get slow queries from pg_stat_statements
      const result = await pool.query(
        `SELECT 
          queryid,
          query,
          calls,
          total_exec_time,
          mean_exec_time,
          stddev_exec_time,
          rows,
          shared_blks_hit,
          shared_blks_read,
          shared_blks_written
         FROM pg_stat_statements
         WHERE mean_exec_time > $1
         ORDER BY mean_exec_time DESC
         LIMIT 50`,
        [thresholdMs]
      );

      const analyses = [];

      for (const query of result.rows) {
        const recommendations = this.generateQueryRecommendations(query);
        
        analyses.push({
          queryId: query.queryid,
          query: query.query,
          stats: {
            calls: parseInt(query.calls),
            avgExecutionTime: parseFloat(query.mean_exec_time).toFixed(2),
            totalTime: parseFloat(query.total_exec_time).toFixed(2),
            stddev: parseFloat(query.stddev_exec_time).toFixed(2),
            avgRows: parseInt(query.rows / query.calls)
          },
          cacheMetrics: {
            hitRate: query.shared_blks_read > 0
              ? ((query.shared_blks_hit / (query.shared_blks_hit + query.shared_blks_read)) * 100).toFixed(2)
              : 100,
            blocksRead: parseInt(query.shared_blks_read),
            blocksHit: parseInt(query.shared_blks_hit)
          },
          recommendations
        });
      }

      // Store analysis
      await pool.query(
        `INSERT INTO query_analysis_reports 
        (tenant_id, threshold_ms, queries_analyzed, report_data, created_at)
        VALUES ($1, $2, $3, $4, NOW())`,
        [tenantId, thresholdMs, analyses.length, JSON.stringify(analyses)]
      );

      return analyses;
    } catch (error) {
      logger.error('Failed to analyze slow queries:', error);
      throw error;
    }
  }

  /**
   * Generate query optimization recommendations
   * 
   * @param {Object} queryStats
   * @returns {Array<string>}
   */
  generateQueryRecommendations(queryStats) {
    const recommendations = [];
    const query = queryStats.query.toLowerCase();

    // Check for missing indexes
    if (queryStats.shared_blks_read > 1000) {
      recommendations.push('High disk reads detected - consider adding indexes on frequently queried columns');
    }

    // Check for SELECT *
    if (query.includes('select *')) {
      recommendations.push('Avoid SELECT * - specify only needed columns to reduce data transfer');
    }

    // Check for N+1 queries
    if (queryStats.calls > 100 && queryStats.rows / queryStats.calls === 1) {
      recommendations.push('Possible N+1 query pattern - consider using JOIN or batch loading');
    }

    // Check for LIKE queries without index
    if (query.includes('like') && !query.includes('like \'%')) {
      recommendations.push('LIKE queries may benefit from GIN/GIST indexes for full-text search');
    }

    // Check for missing LIMIT
    if (!query.includes('limit') && queryStats.rows > 1000) {
      recommendations.push('Consider adding LIMIT clause to reduce result set size');
    }

    // Check for subqueries
    if (query.match(/select.*select/g)) {
      recommendations.push('Subquery detected - consider rewriting as JOIN for better performance');
    }

    // Check for DISTINCT without index
    if (query.includes('distinct')) {
      recommendations.push('DISTINCT can be expensive - ensure proper indexes exist or use GROUP BY');
    }

    // Check cache hit rate
    const hitRate = queryStats.shared_blks_read > 0
      ? (queryStats.shared_blks_hit / (queryStats.shared_blks_hit + queryStats.shared_blks_read)) * 100
      : 100;

    if (hitRate < 90) {
      recommendations.push(`Low cache hit rate (${hitRate.toFixed(2)}%) - increase shared_buffers or add caching layer`);
    }

    return recommendations;
  }

  /**
   * Database connection pool optimization
   */

  /**
   * Analyze connection pool usage
   * 
   * @returns {Promise<Object>}
   */
  async analyzeConnectionPool() {
    try {
      const poolStats = {
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingClients: pool.waitingCount,
        maxConnections: pool.options.max,
        utilization: ((pool.totalCount / pool.options.max) * 100).toFixed(2)
      };

      // Get active queries
      const activeQueries = await pool.query(
        `SELECT 
          COUNT(*) as active_queries,
          COUNT(CASE WHEN state = 'idle' THEN 1 END) as idle_queries,
          COUNT(CASE WHEN state = 'idle in transaction' THEN 1 END) as idle_in_transaction,
          AVG(EXTRACT(EPOCH FROM (NOW() - query_start))) as avg_query_duration
         FROM pg_stat_activity
         WHERE datname = current_database()`
      );

      poolStats.activeQueries = activeQueries.rows[0];

      // Recommendations
      poolStats.recommendations = [];

      if (parseFloat(poolStats.utilization) > 80) {
        poolStats.recommendations.push('Connection pool is >80% utilized - consider increasing max connections');
      }

      if (activeQueries.rows[0].idle_in_transaction > 0) {
        poolStats.recommendations.push(`${activeQueries.rows[0].idle_in_transaction} idle transactions detected - ensure transactions are properly closed`);
      }

      if (pool.waitingCount > 0) {
        poolStats.recommendations.push(`${pool.waitingCount} clients waiting for connections - increase pool size or optimize queries`);
      }

      return poolStats;
    } catch (error) {
      logger.error('Failed to analyze connection pool:', error);
      throw error;
    }
  }

  /**
   * Core Web Vitals tracking
   */

  /**
   * Record Web Vitals metric
   * 
   * @param {Object} metricData
   * @returns {Promise<Object>}
   */
  async recordWebVital(metricData) {
    const {
      tenantId,
      websiteId,
      metricName, // LCP, FID, CLS, FCP, TTFB
      value,
      url,
      userAgent,
      connectionType
    } = metricData;

    try {
      const result = await pool.query(
        `INSERT INTO web_vitals_metrics 
        (tenant_id, website_id, metric_name, value, url, user_agent, connection_type, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *`,
        [tenantId, websiteId, metricName, value, url, userAgent, connectionType]
      );

      // Check against performance budget
      const budget = this.performanceBudgets[metricName];
      if (budget && value > budget) {
        await this.recordBudgetViolation(tenantId, websiteId, metricName, value, budget);
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to record web vital:', error);
      throw error;
    }
  }

  /**
   * Get Web Vitals summary
   * 
   * @param {number} tenantId
   * @param {number} websiteId
   * @param {Date} startDate
   * @param {Date} endDate
   * @returns {Promise<Object>}
   */
  async getWebVitalsSummary(tenantId, websiteId, startDate, endDate) {
    try {
      const result = await pool.query(
        `SELECT 
          metric_name,
          COUNT(*) as samples,
          AVG(value) as avg_value,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY value) as p50,
          PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY value) as p75,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value) as p95,
          MIN(value) as min_value,
          MAX(value) as max_value
         FROM web_vitals_metrics
         WHERE tenant_id = $1 
           AND website_id = $2 
           AND created_at BETWEEN $3 AND $4
         GROUP BY metric_name`,
        [tenantId, websiteId, startDate, endDate]
      );

      const summary = {};

      for (const row of result.rows) {
        const budget = this.performanceBudgets[row.metric_name];
        const compliance = budget
          ? ((row.samples - await this.countBudgetViolations(tenantId, websiteId, row.metric_name, startDate, endDate)) / row.samples * 100).toFixed(2)
          : 100;

        summary[row.metric_name] = {
          samples: parseInt(row.samples),
          avg: parseFloat(row.avg_value).toFixed(2),
          p50: parseFloat(row.p50).toFixed(2),
          p75: parseFloat(row.p75).toFixed(2),
          p95: parseFloat(row.p95).toFixed(2),
          min: parseFloat(row.min_value).toFixed(2),
          max: parseFloat(row.max_value).toFixed(2),
          budget: budget || 'N/A',
          compliance: `${compliance}%`,
          status: this.getWebVitalStatus(row.metric_name, parseFloat(row.p75))
        };
      }

      return summary;
    } catch (error) {
      logger.error('Failed to get web vitals summary:', error);
      throw error;
    }
  }

  /**
   * Determine Web Vital status (good/needs-improvement/poor)
   * Based on Google's Web Vitals thresholds
   */
  getWebVitalStatus(metricName, value) {
    const thresholds = {
      LCP: { good: 2500, poor: 4000 },
      FID: { good: 100, poor: 300 },
      CLS: { good: 0.1, poor: 0.25 },
      FCP: { good: 1800, poor: 3000 },
      TTFB: { good: 800, poor: 1800 }
    };

    const threshold = thresholds[metricName];
    if (!threshold) return 'unknown';

    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  }

  async recordBudgetViolation(tenantId, websiteId, metricName, actualValue, budgetValue) {
    await pool.query(
      `INSERT INTO performance_budget_violations 
      (tenant_id, website_id, metric_name, actual_value, budget_value, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())`,
      [tenantId, websiteId, metricName, actualValue, budgetValue]
    );

    logger.warn('Performance budget violation', {
      tenantId,
      websiteId,
      metricName,
      actualValue,
      budgetValue
    });
  }

  async countBudgetViolations(tenantId, websiteId, metricName, startDate, endDate) {
    const result = await pool.query(
      `SELECT COUNT(*) as violations
       FROM performance_budget_violations
       WHERE tenant_id = $1 
         AND website_id = $2 
         AND metric_name = $3
         AND created_at BETWEEN $4 AND $5`,
      [tenantId, websiteId, metricName, startDate, endDate]
    );

    return parseInt(result.rows[0].violations);
  }

  /**
   * CDN integration
   */

  /**
   * Purge CDN cache
   * 
   * @param {number} websiteId
   * @param {string[]} urls - URLs to purge (empty = purge all)
   * @param {string} provider - 'cloudflare', 'cloudfront', 'fastly'
   * @returns {Promise<Object>}
   */
  async purgeCDNCache(websiteId, urls = [], provider = 'cloudflare') {
    try {
      // Get website CDN configuration
      const websiteResult = await pool.query(
        'SELECT cdn_zone_id, cdn_api_key FROM websites WHERE id = $1',
        [websiteId]
      );

      if (websiteResult.rows.length === 0) {
        throw new Error('Website not found');
      }

      const website = websiteResult.rows[0];

      let purgeResult;

      if (provider === 'cloudflare') {
        purgeResult = await this.purgeCloudflare(website.cdn_zone_id, website.cdn_api_key, urls);
      } else if (provider === 'cloudfront') {
        purgeResult = await this.purgeCloudFront(website.cdn_distribution_id, urls);
      } else if (provider === 'fastly') {
        purgeResult = await this.purgeFastly(website.cdn_service_id, website.cdn_api_key, urls);
      } else {
        throw new Error('Unsupported CDN provider');
      }

      // Log purge
      await pool.query(
        `INSERT INTO cdn_purge_logs 
        (website_id, provider, urls, status, created_at)
        VALUES ($1, $2, $3, $4, NOW())`,
        [websiteId, provider, JSON.stringify(urls), purgeResult.success ? 'success' : 'failed']
      );

      return purgeResult;
    } catch (error) {
      logger.error('Failed to purge CDN cache:', error);
      throw error;
    }
  }

  async purgeCloudflare(zoneId, apiKey, urls) {
    // Implementation would use Cloudflare API
    logger.info('Cloudflare purge requested', { zoneId, urlCount: urls.length });
    
    // Stub - in production, use axios to call Cloudflare API
    return {
      success: true,
      provider: 'cloudflare',
      purgedUrls: urls.length > 0 ? urls : ['all']
    };
  }

  async purgeCloudFront(distributionId, urls) {
    // Implementation would use AWS SDK
    logger.info('CloudFront purge requested', { distributionId, urlCount: urls.length });
    
    return {
      success: true,
      provider: 'cloudfront',
      purgedUrls: urls.length > 0 ? urls : ['all']
    };
  }

  async purgeFastly(serviceId, apiKey, urls) {
    // Implementation would use Fastly API
    logger.info('Fastly purge requested', { serviceId, urlCount: urls.length });
    
    return {
      success: true,
      provider: 'fastly',
      purgedUrls: urls.length > 0 ? urls : ['all']
    };
  }

  /**
   * Asset optimization recommendations
   */

  /**
   * Analyze website assets for optimization opportunities
   * 
   * @param {number} websiteId
   * @returns {Promise<Object>}
   */
  async analyzeAssets(websiteId) {
    try {
      // In production, this would scan actual website files
      // For now, provide general recommendations based on common patterns
      
      const recommendations = {
        images: [
          'Convert images to WebP format for better compression',
          'Implement responsive images with srcset',
          'Use lazy loading for below-the-fold images',
          'Compress images to reduce file size by 30-60%'
        ],
        javascript: [
          'Enable code splitting to reduce initial bundle size',
          'Minify JavaScript files',
          'Use tree shaking to eliminate dead code',
          'Implement dynamic imports for route-based code splitting',
          'Consider preloading critical JavaScript'
        ],
        css: [
          'Remove unused CSS rules',
          'Minify CSS files',
          'Inline critical CSS',
          'Use CSS sprites for small icons',
          'Enable CSS compression'
        ],
        fonts: [
          'Use font-display: swap to prevent invisible text',
          'Subset fonts to include only needed characters',
          'Preload critical fonts',
          'Use variable fonts where possible'
        ],
        general: [
          'Enable Gzip/Brotli compression',
          'Implement HTTP/2 server push for critical resources',
          'Add proper cache headers (Cache-Control, ETag)',
          'Minimize redirects',
          'Use a CDN for static assets'
        ]
      };

      // Store recommendations
      await pool.query(
        `INSERT INTO asset_optimization_reports 
        (website_id, recommendations, created_at)
        VALUES ($1, $2, NOW())`,
        [websiteId, JSON.stringify(recommendations)]
      );

      return recommendations;
    } catch (error) {
      logger.error('Failed to analyze assets:', error);
      throw error;
    }
  }

  /**
   * Performance score calculation
   * 
   * @param {number} websiteId
   * @returns {Promise<Object>}
   */
  async calculatePerformanceScore(websiteId) {
    try {
      // Get latest Web Vitals
      const vitals = await pool.query(
        `SELECT metric_name, AVG(value) as avg_value
         FROM web_vitals_metrics
         WHERE website_id = $1 
           AND created_at > NOW() - INTERVAL '24 hours'
         GROUP BY metric_name`,
        [websiteId]
      );

      let score = 100;
      const penalties = {};

      for (const vital of vitals.rows) {
        const status = this.getWebVitalStatus(vital.metric_name, parseFloat(vital.avg_value));
        
        if (status === 'needs-improvement') {
          const penalty = 10;
          score -= penalty;
          penalties[vital.metric_name] = { status, penalty };
        } else if (status === 'poor') {
          const penalty = 20;
          score -= penalty;
          penalties[vital.metric_name] = { status, penalty };
        }
      }

      score = Math.max(0, score);

      const grade = score >= 90 ? 'A' 
                  : score >= 80 ? 'B'
                  : score >= 70 ? 'C'
                  : score >= 60 ? 'D'
                  : 'F';

      return {
        score,
        grade,
        penalties,
        recommendations: score < 90 ? await this.analyzeAssets(websiteId) : null
      };
    } catch (error) {
      logger.error('Failed to calculate performance score:', error);
      throw error;
    }
  }

  /**
   * Cache warming
   * 
   * @param {number} tenantId
   * @param {string[]} keys - Cache keys to warm
   * @returns {Promise<Object>}
   */
  async warmCache(tenantId, keys) {
    const warmed = [];
    const failed = [];

    for (const key of keys) {
      try {
        // Check if already cached
        const exists = await redis.exists(key);
        
        if (!exists) {
          // Fetch and cache based on key pattern
          if (key.startsWith('tenant:')) {
            const data = await pool.query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
            await redis.setex(key, this.cacheConfig.dynamic, JSON.stringify(data.rows[0]));
            warmed.push(key);
          } else if (key.startsWith('user:')) {
            const userId = key.split(':')[1];
            const data = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
            await redis.setex(key, this.cacheConfig.user, JSON.stringify(data.rows[0]));
            warmed.push(key);
          }
          // Add more key patterns as needed
        }
      } catch (error) {
        logger.error('Failed to warm cache for key:', key, error);
        failed.push(key);
      }
    }

    return { warmed, failed, total: keys.length };
  }
}

module.exports = new PerformanceService();
