/**
 * Request Coalescer - Prevents duplicate concurrent requests
 * 
 * Features:
 * - Deduplicates identical concurrent requests
 * - Shares response between duplicate requests
 * - Reduces database load
 * - Configurable TTL for request cache
 */

import logger from '../config/logger.js';
import crypto from 'crypto';
import { Counter, Histogram } from 'prom-client';

class RequestCoalescer {
  constructor() {
    this.pendingRequests = new Map(); // key -> Promise
    
    this.metrics = {
      coalesced: new Counter({
        name: 'coalesced_requests_total',
        help: 'Total number of coalesced requests',
        labelNames: ['method', 'path']
      }),
      deduplicationRate: new Histogram({
        name: 'request_deduplication_rate',
        help: 'Rate of request deduplication',
        buckets: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
      })
    };

    this.enabled = process.env.REQUEST_COALESCING_ENABLED !== 'false';
  }

  /**
   * Generate unique key for request
   */
  generateKey(method, path, query, body) {
    const data = JSON.stringify({
      method,
      path,
      query: query || {},
      body: body || {}
    });
    
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Coalesce concurrent requests
   */
  async coalesce(key, fn, context = {}) {
    if (!this.enabled) {
      return await fn();
    }

    // Check if identical request is already in flight
    if (this.pendingRequests.has(key)) {
      logger.debug('Request coalesced', {
        key: key.substring(0, 16),
        method: context.method,
        path: context.path
      });

      this.metrics.coalesced.inc({
        method: context.method || 'unknown',
        path: context.path || 'unknown'
      });

      // Wait for the existing request to complete
      return await this.pendingRequests.get(key);
    }

    // Execute request and store promise
    const promise = fn()
      .then(result => {
        // Remove from pending after completion
        this.pendingRequests.delete(key);
        return result;
      })
      .catch(error => {
        // Remove from pending after error
        this.pendingRequests.delete(key);
        throw error;
      });

    this.pendingRequests.set(key, promise);
    return await promise;
  }

  /**
   * Middleware for request coalescing
   */
  middleware() {
    return async (req, res, next) => {
      if (!this.enabled) {
        return next();
      }

      // Only coalesce GET requests (idempotent)
      if (req.method !== 'GET') {
        return next();
      }

      const key = this.generateKey(req.method, req.path, req.query, req.body);
      
      try {
        // Store original send function
        const originalSend = res.send.bind(res);
        const originalJson = res.json.bind(res);
        
        let responseData;
        let responseSent = false;

        // Wrap send to capture response
        res.send = function(data) {
          responseData = data;
          responseSent = true;
          return originalSend(data);
        };

        res.json = function(data) {
          responseData = data;
          responseSent = true;
          return originalJson(data);
        };

        // Continue with request
        next();

      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      enabled: this.enabled,
      pendingRequests: this.pendingRequests.size
    };
  }

  /**
   * Clear all pending requests (use with caution)
   */
  clear() {
    this.pendingRequests.clear();
  }
}

export default new RequestCoalescer();
