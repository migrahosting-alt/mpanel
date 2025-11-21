// src/middleware/cacheMiddleware.js
/**
 * Express middleware for HTTP response caching
 * Supports cache control headers, ETags, and conditional requests
 */

import { cache, CacheTTL } from '../services/cache.js';
import crypto from 'crypto';
import logger from '../config/logger.js';

/**
 * Generate cache key from request
 */
function generateCacheKey(req) {
  const userId = req.user?.id || 'anonymous';
  const path = req.originalUrl || req.url;
  const method = req.method;
  
  return `http:${method}:${userId}:${path}`;
}

/**
 * Generate ETag from content
 */
function generateETag(content) {
  return crypto
    .createHash('md5')
    .update(content)
    .digest('hex');
}

/**
 * Cache middleware factory
 * @param {Object} options - Cache configuration
 * @param {number} options.ttl - Cache TTL in seconds
 * @param {string} options.namespace - Cache namespace
 * @param {Function} options.keyGenerator - Custom key generator
 * @param {boolean} options.private - Private cache (user-specific)
 * @param {boolean} options.etag - Enable ETag generation
 */
export function cacheResponse(options = {}) {
  const {
    ttl = CacheTTL.MEDIUM,
    namespace = 'http',
    keyGenerator = generateCacheKey,
    private: isPrivate = true,
    etag = true,
  } = options;

  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip if cache disabled
    if (!cache.enabled) {
      return next();
    }

    try {
      const cacheKey = keyGenerator(req);

      // Try to get from cache
      const cached = await cache.get(namespace, cacheKey);
      
      if (cached) {
        // Set cache headers
        res.set('X-Cache', 'HIT');
        res.set('Cache-Control', isPrivate ? 'private' : 'public');
        
        if (etag && cached.etag) {
          res.set('ETag', cached.etag);
          
          // Check If-None-Match header
          if (req.headers['if-none-match'] === cached.etag) {
            return res.status(304).end();
          }
        }

        // Return cached response
        return res.status(cached.status || 200)
          .set(cached.headers || {})
          .json(cached.body);
      }

      // Cache MISS - intercept response
      res.set('X-Cache', 'MISS');

      const originalJson = res.json.bind(res);
      
      res.json = function(body) {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const responseData = {
            status: res.statusCode,
            headers: {},
            body,
          };

          // Generate ETag if enabled
          if (etag) {
            const content = JSON.stringify(body);
            const etagValue = generateETag(content);
            responseData.etag = etagValue;
            res.set('ETag', etagValue);
          }

          // Store in cache asynchronously
          cache.set(namespace, cacheKey, responseData, ttl).catch(err => {
            logger.error('Failed to cache response:', err);
          });
        }

        return originalJson(body);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next();
    }
  };
}

/**
 * Middleware to invalidate cache on mutations
 */
export function invalidateCacheOn(patterns) {
  return async (req, res, next) => {
    // Store original send
    const originalSend = res.send.bind(res);

    res.send = function(body) {
      // Only invalidate on successful mutations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const patternsArray = Array.isArray(patterns) ? patterns : [patterns];
        
        Promise.all(
          patternsArray.map(pattern => {
            if (typeof pattern === 'function') {
              return cache.delPattern(pattern(req));
            }
            return cache.delPattern(pattern);
          })
        ).catch(err => {
          logger.error('Cache invalidation error:', err);
        });
      }

      return originalSend(body);
    };

    next();
  };
}

/**
 * Middleware to set cache control headers
 */
export function setCacheControl(maxAge, options = {}) {
  const {
    private: isPrivate = false,
    noStore = false,
    noCache = false,
    mustRevalidate = false,
  } = options;

  return (req, res, next) => {
    const directives = [];

    if (noStore) {
      directives.push('no-store');
    } else if (noCache) {
      directives.push('no-cache');
    } else {
      directives.push(isPrivate ? 'private' : 'public');
      directives.push(`max-age=${maxAge}`);
    }

    if (mustRevalidate) {
      directives.push('must-revalidate');
    }

    res.set('Cache-Control', directives.join(', '));
    next();
  };
}

/**
 * No-cache middleware for sensitive endpoints
 */
export const noCache = setCacheControl(0, { noStore: true });

/**
 * Short cache for frequently changing data
 */
export const shortCache = cacheResponse({ ttl: CacheTTL.SHORT });

/**
 * Medium cache for moderately stable data
 */
export const mediumCache = cacheResponse({ ttl: CacheTTL.MEDIUM });

/**
 * Long cache for stable data
 */
export const longCache = cacheResponse({ ttl: CacheTTL.LONG });

export default {
  cacheResponse,
  invalidateCacheOn,
  setCacheControl,
  noCache,
  shortCache,
  mediumCache,
  longCache,
};
