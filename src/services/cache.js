// src/services/cache.js
/**
 * Redis-based caching service for performance optimization
 * Supports multi-layer caching with TTL, cache invalidation, and pattern-based deletion
 */

import Redis from 'ioredis';
import logger from '../config/logger.js';

// Redis client singleton
let redisClient = null;

/**
 * Initialize Redis connection
 */
export function initializeRedis() {
  if (redisClient) return redisClient;

  const config = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
  };

  redisClient = new Redis(config);

  redisClient.on('connect', () => {
    logger.info('Redis connected successfully');
  });

  redisClient.on('error', (err) => {
    logger.error('Redis connection error:', err);
  });

  redisClient.on('ready', () => {
    logger.info('Redis ready for operations');
  });

  return redisClient;
}

/**
 * Get Redis client instance
 */
export function getRedisClient() {
  if (!redisClient) {
    return initializeRedis();
  }
  return redisClient;
}

/**
 * Cache service with automatic serialization/deserialization
 */
class CacheService {
  constructor() {
    this.client = null;
    this.defaultTTL = 3600; // 1 hour default
    this.enabled = process.env.CACHE_ENABLED !== 'false';
  }

  /**
   * Initialize cache service
   */
  async initialize() {
    if (!this.enabled) {
      logger.info('Cache disabled by configuration');
      return;
    }
    this.client = getRedisClient();
  }

  /**
   * Generate cache key with namespace
   */
  key(namespace, identifier) {
    return `mpanel:${namespace}:${identifier}`;
  }

  /**
   * Get value from cache
   */
  async get(namespace, identifier) {
    if (!this.enabled || !this.client) return null;

    try {
      const cacheKey = this.key(namespace, identifier);
      const value = await this.client.get(cacheKey);
      
      if (!value) return null;

      // Try to parse JSON, return raw if fails
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(namespace, identifier, value, ttl = null) {
    if (!this.enabled || !this.client) return false;

    try {
      const cacheKey = this.key(namespace, identifier);
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      const expiry = ttl || this.defaultTTL;

      await this.client.setex(cacheKey, expiry, serialized);
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete specific cache entry
   */
  async del(namespace, identifier) {
    if (!this.enabled || !this.client) return false;

    try {
      const cacheKey = this.key(namespace, identifier);
      await this.client.del(cacheKey);
      return true;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Delete all keys matching pattern
   */
  async delPattern(pattern) {
    if (!this.enabled || !this.client) return 0;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;

      await this.client.del(...keys);
      return keys.length;
    } catch (error) {
      logger.error('Cache pattern delete error:', error);
      return 0;
    }
  }

  /**
   * Invalidate all cache for a namespace
   */
  async invalidateNamespace(namespace) {
    return this.delPattern(`mpanel:${namespace}:*`);
  }

  /**
   * Invalidate user-specific cache
   */
  async invalidateUser(userId) {
    const deleted = await this.delPattern(`mpanel:*:user:${userId}:*`);
    logger.info(`Invalidated ${deleted} cache entries for user ${userId}`);
    return deleted;
  }

  /**
   * Cache wrapper for database queries
   */
  async wrap(namespace, identifier, fetchFn, ttl = null) {
    // Try to get from cache first
    const cached = await this.get(namespace, identifier);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const data = await fetchFn();
    
    // Store in cache
    await this.set(namespace, identifier, data, ttl);
    
    return data;
  }

  /**
   * Multi-get for batch operations
   */
  async mget(namespace, identifiers) {
    if (!this.enabled || !this.client) return {};

    try {
      const keys = identifiers.map(id => this.key(namespace, id));
      const values = await this.client.mget(...keys);
      
      const result = {};
      identifiers.forEach((id, index) => {
        if (values[index]) {
          try {
            result[id] = JSON.parse(values[index]);
          } catch {
            result[id] = values[index];
          }
        }
      });
      
      return result;
    } catch (error) {
      logger.error('Cache mget error:', error);
      return {};
    }
  }

  /**
   * Multi-set for batch operations
   */
  async mset(namespace, items, ttl = null) {
    if (!this.enabled || !this.client) return false;

    try {
      const pipeline = this.client.pipeline();
      const expiry = ttl || this.defaultTTL;

      Object.entries(items).forEach(([id, value]) => {
        const cacheKey = this.key(namespace, id);
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);
        pipeline.setex(cacheKey, expiry, serialized);
      });

      await pipeline.exec();
      return true;
    } catch (error) {
      logger.error('Cache mset error:', error);
      return false;
    }
  }

  /**
   * Increment counter (for rate limiting, analytics)
   */
  async incr(namespace, identifier, expiry = null) {
    if (!this.enabled || !this.client) return 0;

    try {
      const cacheKey = this.key(namespace, identifier);
      const value = await this.client.incr(cacheKey);
      
      if (expiry && value === 1) {
        await this.client.expire(cacheKey, expiry);
      }
      
      return value;
    } catch (error) {
      logger.error('Cache incr error:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    if (!this.enabled || !this.client) {
      return { enabled: false };
    }

    try {
      const info = await this.client.info('stats');
      const dbSize = await this.client.dbsize();
      
      return {
        enabled: true,
        dbSize,
        info: info.split('\r\n').reduce((acc, line) => {
          const [key, value] = line.split(':');
          if (key && value) acc[key] = value;
          return acc;
        }, {}),
      };
    } catch (error) {
      logger.error('Cache stats error:', error);
      return { enabled: true, error: error.message };
    }
  }

  /**
   * Flush all cache (use with caution!)
   */
  async flushAll() {
    if (!this.enabled || !this.client) return false;

    try {
      await this.client.flushdb();
      logger.warn('Cache flushed - all data cleared');
      return true;
    } catch (error) {
      logger.error('Cache flush error:', error);
      return false;
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      logger.info('Redis connection closed');
    }
  }
}

// Export singleton instance
export const cache = new CacheService();

// Cache TTL constants (in seconds)
export const CacheTTL = {
  SHORT: 60,           // 1 minute
  MEDIUM: 300,         // 5 minutes
  LONG: 3600,          // 1 hour
  DAY: 86400,          // 24 hours
  WEEK: 604800,        // 7 days
};

// Cache namespaces
export const CacheNamespace = {
  USER: 'user',
  PRODUCT: 'product',
  DOMAIN: 'domain',
  INVOICE: 'invoice',
  SUBSCRIPTION: 'subscription',
  WEBSITE: 'website',
  DATABASE: 'database',
  EMAIL: 'email',
  SSL: 'ssl',
  DNS: 'dns',
  BACKUP: 'backup',
  METRICS: 'metrics',
  STATS: 'stats',
};

export default cache;
