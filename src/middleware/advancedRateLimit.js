// src/middleware/advancedRateLimit.js
/**
 * Advanced rate limiting with Redis backend
 * Supports different limits per endpoint, user role, and API key
 */

import { getRedisClient } from '../services/cache.js';
import logger from '../config/logger.js';

/**
 * Token bucket rate limiter
 */
class TokenBucket {
  constructor(capacity, refillRate, refillInterval) {
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.refillInterval = refillInterval; // in milliseconds
  }

  async consume(redis, key, tokens = 1) {
    const now = Date.now();
    const bucketKey = `ratelimit:bucket:${key}`;

    // Get current bucket state
    const data = await redis.get(bucketKey);
    let bucket = data ? JSON.parse(data) : {
      tokens: this.capacity,
      lastRefill: now,
    };

    // Refill tokens based on time elapsed
    const timePassed = now - bucket.lastRefill;
    const refills = Math.floor(timePassed / this.refillInterval);
    
    if (refills > 0) {
      bucket.tokens = Math.min(
        this.capacity,
        bucket.tokens + (refills * this.refillRate)
      );
      bucket.lastRefill = now;
    }

    // Try to consume tokens
    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      await redis.setex(bucketKey, 3600, JSON.stringify(bucket)); // 1 hour expiry
      return {
        allowed: true,
        remaining: bucket.tokens,
        resetAt: bucket.lastRefill + this.refillInterval,
      };
    }

    // Not enough tokens
    await redis.setex(bucketKey, 3600, JSON.stringify(bucket));
    return {
      allowed: false,
      remaining: 0,
      resetAt: bucket.lastRefill + this.refillInterval,
      retryAfter: Math.ceil((tokens - bucket.tokens) * this.refillInterval / this.refillRate),
    };
  }
}

/**
 * Create rate limit middleware
 */
export function createRateLimit(options = {}) {
  const {
    windowMs = 60000, // 1 minute
    max = 60, // 60 requests per window
    keyGenerator = (req) => req.ip || 'unknown',
    skip = () => false,
    handler = null,
    standardHeaders = true,
    legacyHeaders = false,
  } = options;

  const redis = getRedisClient();
  const bucket = new TokenBucket(max, max, windowMs);

  return async (req, res, next) => {
    try {
      // Skip if function returns true
      if (skip(req, res)) {
        return next();
      }

      const key = keyGenerator(req);
      const result = await bucket.consume(redis, key);

      // Set rate limit headers
      if (standardHeaders) {
        res.setHeader('RateLimit-Limit', max);
        res.setHeader('RateLimit-Remaining', Math.max(0, result.remaining));
        res.setHeader('RateLimit-Reset', new Date(result.resetAt).toISOString());
      }

      if (legacyHeaders) {
        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining));
        res.setHeader('X-RateLimit-Reset', Math.floor(result.resetAt / 1000));
      }

      if (!result.allowed) {
        res.setHeader('Retry-After', Math.ceil(result.retryAfter / 1000));
        
        if (handler) {
          return handler(req, res, next);
        }

        return res.status(429).json({
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: result.retryAfter,
        });
      }

      next();
    } catch (error) {
      logger.error('Rate limit error:', error);
      // Fail open - allow request if rate limiter fails
      next();
    }
  };
}

/**
 * Different rate limits per user role
 */
export function roleBasedRateLimit(limits) {
  return createRateLimit({
    max: (req) => {
      const role = req.user?.role || 'anonymous';
      return limits[role] || limits.default || 60;
    },
    keyGenerator: (req) => {
      const userId = req.user?.id || req.ip;
      const role = req.user?.role || 'anonymous';
      return `${role}:${userId}`;
    },
  });
}

/**
 * Cost-based rate limiting (different endpoints cost different tokens)
 */
export function costBasedRateLimit(baseCost = 1) {
  const costs = {
    GET: 1,
    POST: 2,
    PUT: 2,
    DELETE: 3,
    PATCH: 2,
  };

  return createRateLimit({
    keyGenerator: (req) => {
      const userId = req.user?.id || req.ip;
      const cost = costs[req.method] || baseCost;
      req.rateLimitCost = cost;
      return userId;
    },
  });
}

/**
 * Sliding window rate limiter (more accurate)
 */
export function slidingWindowLimit(options = {}) {
  const {
    windowMs = 60000,
    max = 60,
    keyGenerator = (req) => req.ip,
  } = options;

  const redis = getRedisClient();

  return async (req, res, next) => {
    try {
      const key = `ratelimit:sliding:${keyGenerator(req)}`;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Add current request
      await redis.zadd(key, now, `${now}:${Math.random()}`);
      
      // Remove old requests outside window
      await redis.zremrangebyscore(key, 0, windowStart);
      
      // Count requests in window
      const count = await redis.zcard(key);
      
      // Set expiry
      await redis.expire(key, Math.ceil(windowMs / 1000) + 1);

      // Set headers
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - count));
      res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());

      if (count > max) {
        return res.status(429).json({
          error: 'Too many requests',
          message: 'Rate limit exceeded',
        });
      }

      next();
    } catch (error) {
      logger.error('Sliding window rate limit error:', error);
      next();
    }
  };
}

/**
 * DDoS protection - detect and block suspicious patterns
 */
export function ddosProtection(options = {}) {
  const {
    suspiciousThreshold = 100, // requests per minute
    blockDuration = 3600, // 1 hour in seconds
  } = options;

  const redis = getRedisClient();

  return async (req, res, next) => {
    try {
      const ip = req.ip || 'unknown';
      const key = `ddos:${ip}`;

      // Check if IP is blocked
      const blocked = await redis.get(`${key}:blocked`);
      if (blocked) {
        logger.warn(`Blocked DDoS attempt from ${ip}`);
        return res.status(403).json({
          error: 'Access denied',
          message: 'Your IP has been temporarily blocked due to suspicious activity',
        });
      }

      // Count requests
      const count = await redis.incr(key);
      
      if (count === 1) {
        await redis.expire(key, 60); // 1 minute window
      }

      // Check if suspicious
      if (count > suspiciousThreshold) {
        await redis.setex(`${key}:blocked`, blockDuration, '1');
        logger.error(`DDoS detected from ${ip}, blocking for ${blockDuration}s`);
        
        return res.status(403).json({
          error: 'Access denied',
          message: 'Too many requests detected',
        });
      }

      next();
    } catch (error) {
      logger.error('DDoS protection error:', error);
      next();
    }
  };
}

/**
 * IP whitelist/blacklist
 */
export function ipFilter(options = {}) {
  const {
    whitelist = [],
    blacklist = [],
    mode = 'blacklist', // 'whitelist' or 'blacklist'
  } = options;

  return (req, res, next) => {
    const ip = req.ip || '';

    if (mode === 'whitelist') {
      if (!whitelist.includes(ip)) {
        logger.warn(`Rejected non-whitelisted IP: ${ip}`);
        return res.status(403).json({
          error: 'Access denied',
          message: 'Your IP is not authorized',
        });
      }
    } else if (mode === 'blacklist') {
      if (blacklist.includes(ip)) {
        logger.warn(`Rejected blacklisted IP: ${ip}`);
        return res.status(403).json({
          error: 'Access denied',
          message: 'Your IP has been blocked',
        });
      }
    }

    next();
  };
}

// Preset rate limits
export const rateLimits = {
  // Very strict - authentication endpoints
  auth: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    keyGenerator: (req) => `auth:${req.ip}`,
  }),

  // Strict - write operations
  strict: createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
  }),

  // Standard - most API endpoints
  standard: createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60,
  }),

  // Relaxed - read operations
  relaxed: createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 120,
  }),

  // Per-user limits based on role
  perUser: roleBasedRateLimit({
    admin: 300,
    customer: 100,
    default: 60,
  }),
};

export default {
  createRateLimit,
  roleBasedRateLimit,
  costBasedRateLimit,
  slidingWindowLimit,
  ddosProtection,
  ipFilter,
  rateLimits,
};
