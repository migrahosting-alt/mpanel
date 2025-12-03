/**
 * Rate Limiting Middleware
 * 
 * Protects against brute force attacks, API abuse, and DOS attempts.
 * 
 * Features:
 * - Per-IP rate limiting
 * - Per-tenant rate limiting
 * - Per-user rate limiting
 * - Configurable windows and limits
 * - Redis-backed (production) or in-memory (development)
 * 
 * Usage:
 *   router.post('/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }), handler);
 *   router.post('/auth/password-reset', rateLimit({ windowMs: 60 * 60 * 1000, max: 3 }), handler);
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger.js';

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
  keyPrefix?: string; // Prefix for rate limit keys
  skip?: (req: Request) => boolean; // Skip rate limiting for certain requests
  handler?: (req: Request, res: Response) => void; // Custom handler when limit exceeded
  by?: 'ip' | 'tenant' | 'user' | 'ip+tenant'; // What to rate limit by
}

// In-memory store (for development)
// In production, replace with Redis
class MemoryStore {
  private hits: Map<string, { count: number; resetTime: number }> = new Map();

  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
    const now = Date.now();
    const record = this.hits.get(key);

    if (!record || now > record.resetTime) {
      // Start new window
      const resetTime = now + windowMs;
      const newRecord = { count: 1, resetTime };
      this.hits.set(key, newRecord);
      return newRecord;
    }

    // Increment existing window
    record.count++;
    this.hits.set(key, record);
    return record;
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    for (const [key, record] of this.hits.entries()) {
      if (now > record.resetTime) {
        this.hits.delete(key);
      }
    }
  }
}

const store = new MemoryStore();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  store.cleanup().catch((err) => logger.error('Rate limit cleanup error', { error: err }));
}, 5 * 60 * 1000);

/**
 * Rate limiting middleware factory
 */
export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    keyPrefix = 'ratelimit',
    skip,
    handler,
    by = 'ip',
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if we should skip rate limiting
      if (skip && skip(req)) {
        return next();
      }

      // Build rate limit key
      let key = `${keyPrefix}:`;
      
      if (by === 'ip' || by === 'ip+tenant') {
        const ip = getClientIp(req);
        key += `ip:${ip}`;
      }
      
      if (by === 'tenant' || by === 'ip+tenant') {
        const tenantId = (req as any).tenantId;
        if (tenantId) {
          key += `:tenant:${tenantId}`;
        }
      }
      
      if (by === 'user') {
        const userId = (req as any).userId;
        if (userId) {
          key += `:user:${userId}`;
        } else {
          // Fallback to IP if no user
          const ip = getClientIp(req);
          key += `:ip:${ip}`;
        }
      }

      // Increment counter
      const { count, resetTime } = await store.increment(key, windowMs);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', max.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - count).toString());
      res.setHeader('X-RateLimit-Reset', new Date(resetTime).toISOString());

      // Check if limit exceeded
      if (count > max) {
        logger.warn('Rate limit exceeded', {
          key,
          count,
          max,
          ip: getClientIp(req),
          path: req.path,
          method: req.method,
        });

        if (handler) {
          return handler(req, res);
        }

        return res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests. Please try again after ${new Date(resetTime).toISOString()}`,
          retryAfter: Math.ceil((resetTime - Date.now()) / 1000), // seconds
        });
      }

      next();
    } catch (error) {
      logger.error('Rate limit middleware error', { error });
      // Don't block request if rate limiting fails
      next();
    }
  };
}

/**
 * Get client IP address from request
 */
function getClientIp(req: Request): string {
  // Try various headers (for proxies/load balancers)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return ips.split(',')[0].trim();
  }

  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  return req.socket.remoteAddress || 'unknown';
}

/**
 * Preset rate limiters for common scenarios
 */

// Auth routes (strict)
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  keyPrefix: 'auth',
  by: 'ip',
});

// Password reset (very strict)
export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts
  keyPrefix: 'password-reset',
  by: 'ip',
});

// API routes (moderate)
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests
  keyPrefix: 'api',
  by: 'ip+tenant',
});

// Admin routes (moderate but per-user)
export const adminRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests
  keyPrefix: 'admin',
  by: 'user',
});

// Webhook routes (lenient - these are from external services)
export const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 500, // 500 requests (Stripe can send bursts)
  keyPrefix: 'webhook',
  by: 'ip',
});
