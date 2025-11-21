/**
 * Query Result Cache - Intelligent caching for frequently accessed database queries
 * 
 * Features:
 * - Redis-backed query result caching
 * - Automatic cache invalidation on data changes
 * - TTL-based expiration
 * - Cache hit/miss metrics
 * - Support for cache tags for bulk invalidation
 */

import logger from '../config/logger.js';
import { cache } from '../services/cache.js';
import crypto from 'crypto';
import { Counter, Histogram } from 'prom-client';

class QueryCache {
  constructor() {
    this.metrics = {
      hits: new Counter({
        name: 'query_cache_hits_total',
        help: 'Total cache hits',
        labelNames: ['cache_key']
      }),
      misses: new Counter({
        name: 'query_cache_misses_total',
        help: 'Total cache misses',
        labelNames: ['cache_key']
      }),
      cacheLatency: new Histogram({
        name: 'query_cache_latency_seconds',
        help: 'Cache lookup latency',
        buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1]
      })
    };

    // Cache configuration for different query types
    this.cacheConfig = {
      'domain_pricing': { ttl: 3600, tags: ['domains', 'pricing'] },           // 1 hour
      'tax_rules': { ttl: 1800, tags: ['tax', 'billing'] },                     // 30 minutes
      'products': { ttl: 600, tags: ['products', 'catalog'] },                  // 10 minutes
      'product_categories': { ttl: 3600, tags: ['products', 'categories'] },    // 1 hour
      'tld_list': { ttl: 7200, tags: ['domains', 'tlds'] },                     // 2 hours
      'server_list': { ttl: 300, tags: ['servers', 'infrastructure'] },         // 5 minutes
      'knowledge_base': { ttl: 1800, tags: ['kb', 'content'] },                 // 30 minutes
      'email_templates': { ttl: 3600, tags: ['email', 'templates'] },           // 1 hour
      'notification_preferences': { ttl: 600, tags: ['notifications', 'users'] }, // 10 minutes
      'reseller_tree': { ttl: 1800, tags: ['resellers', 'hierarchy'] }          // 30 minutes
    };

    this.enabled = process.env.QUERY_CACHE_ENABLED !== 'false';
  }

  /**
   * Generate cache key from SQL query and parameters
   */
  generateCacheKey(sql, params = [], prefix = 'query') {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    const paramString = JSON.stringify(params);
    const hash = crypto.createHash('sha256')
      .update(normalized + paramString)
      .digest('hex')
      .substring(0, 16);
    
    return `${prefix}:${hash}`;
  }

  /**
   * Get cached query result
   */
  async get(cacheKey) {
    if (!this.enabled) return null;

    const end = this.metrics.cacheLatency.startTimer();
    
    try {
      const cached = await cache.get(cacheKey);
      end();
      
      if (cached) {
        this.metrics.hits.inc({ cache_key: cacheKey });
        logger.debug('Cache hit', { cacheKey });
        return JSON.parse(cached);
      }
      
      this.metrics.misses.inc({ cache_key: cacheKey });
      logger.debug('Cache miss', { cacheKey });
      return null;
    } catch (error) {
      end();
      logger.error('Cache get error', { error: error.message, cacheKey });
      return null;
    }
  }

  /**
   * Set cached query result
   */
  async set(cacheKey, result, ttl = 300, tags = []) {
    if (!this.enabled) return;

    try {
      const serialized = JSON.stringify(result);
      
      // Set the cached value
      await cache.set(cacheKey, serialized, ttl);
      
      // Add to tag sets for bulk invalidation
      for (const tag of tags) {
        const tagKey = `cache:tag:${tag}`;
        await cache.sadd(tagKey, cacheKey);
        await cache.expire(tagKey, ttl);
      }
      
      logger.debug('Cache set', { cacheKey, ttl, tags });
    } catch (error) {
      logger.error('Cache set error', { error: error.message, cacheKey });
    }
  }

  /**
   * Invalidate cache by key
   */
  async invalidate(cacheKey) {
    if (!this.enabled) return;

    try {
      await cache.del(cacheKey);
      logger.debug('Cache invalidated', { cacheKey });
    } catch (error) {
      logger.error('Cache invalidation error', { error: error.message, cacheKey });
    }
  }

  /**
   * Invalidate all cache entries with specific tag
   */
  async invalidateByTag(tag) {
    if (!this.enabled) return;

    try {
      const tagKey = `cache:tag:${tag}`;
      const cacheKeys = await cache.smembers(tagKey);
      
      if (cacheKeys && cacheKeys.length > 0) {
        // Delete all cache entries
        await Promise.all(cacheKeys.map(key => cache.del(key)));
        
        // Delete the tag set
        await cache.del(tagKey);
        
        logger.info('Cache invalidated by tag', { tag, keysInvalidated: cacheKeys.length });
      }
    } catch (error) {
      logger.error('Cache tag invalidation error', { error: error.message, tag });
    }
  }

  /**
   * Invalidate multiple tags
   */
  async invalidateByTags(tags) {
    if (!this.enabled) return;
    await Promise.all(tags.map(tag => this.invalidateByTag(tag)));
  }

  /**
   * Wrap a query function with caching
   */
  async cachedQuery(queryType, queryFn, params = []) {
    if (!this.enabled) {
      return await queryFn();
    }

    const config = this.cacheConfig[queryType] || { ttl: 300, tags: [] };
    const cacheKey = this.generateCacheKey(queryType, params, 'query');
    
    // Try to get from cache
    const cached = await this.get(cacheKey);
    if (cached !== null) {
      return cached;
    }
    
    // Execute query
    const result = await queryFn();
    
    // Cache the result
    await this.set(cacheKey, result, config.ttl, config.tags);
    
    return result;
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      const info = await cache.info();
      const dbSize = await cache.dbsize();
      
      return {
        enabled: this.enabled,
        keyCount: dbSize,
        memory: info.used_memory_human,
        hitRate: this.calculateHitRate(),
        configuredTypes: Object.keys(this.cacheConfig).length
      };
    } catch (error) {
      logger.error('Error getting cache stats', { error: error.message });
      return null;
    }
  }

  /**
   * Calculate cache hit rate from metrics
   */
  calculateHitRate() {
    // This is a simplified version - in production, you'd query Prometheus
    return 'See Prometheus metrics for detailed hit rate';
  }

  /**
   * Clear all query cache (use with caution)
   */
  async clearAll() {
    if (!this.enabled) return;

    try {
      const pattern = 'query:*';
      const keys = await cache.keys(pattern);
      
      if (keys && keys.length > 0) {
        await Promise.all(keys.map(key => cache.del(key)));
        logger.info('All query cache cleared', { keysCleared: keys.length });
      }
    } catch (error) {
      logger.error('Cache clear error', { error: error.message });
    }
  }
}

// Singleton instance
const queryCache = new QueryCache();

/**
 * Decorator function to cache database queries
 * 
 * @example
 * const products = await withCache('products', 
 *   () => pool.query('SELECT * FROM products WHERE tenant_id = $1', [tenantId]),
 *   [tenantId]
 * );
 */
export async function withCache(queryType, queryFn, params = []) {
  return queryCache.cachedQuery(queryType, queryFn, params);
}

/**
 * Invalidate cache when data changes
 * 
 * @example
 * // After updating product
 * await invalidateCache(['products', 'catalog']);
 */
export async function invalidateCache(tags) {
  return queryCache.invalidateByTags(tags);
}

export default queryCache;
