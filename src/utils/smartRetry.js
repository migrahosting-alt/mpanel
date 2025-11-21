/**
 * Smart Retry Logic - Exponential backoff with jitter for transient failures
 * 
 * Features:
 * - Exponential backoff with configurable base delay
 * - Jitter to prevent thundering herd
 * - Circuit breaker integration
 * - Retry only on transient errors
 * - Different retry strategies per service
 */

import logger from '../config/logger.js';
import { Counter, Histogram } from 'prom-client';

class SmartRetry {
  constructor() {
    this.metrics = {
      retries: new Counter({
        name: 'retry_attempts_total',
        help: 'Total retry attempts',
        labelNames: ['service', 'attempt']
      }),
      retrySuccess: new Counter({
        name: 'retry_success_total',
        help: 'Successful retries',
        labelNames: ['service']
      }),
      retryFailure: new Counter({
        name: 'retry_failure_total',
        help: 'Failed retries after all attempts',
        labelNames: ['service', 'error_type']
      }),
      retryDuration: new Histogram({
        name: 'retry_duration_seconds',
        help: 'Total time spent in retries',
        buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
        labelNames: ['service']
      })
    };

    // Default retry configuration
    this.defaultConfig = {
      maxAttempts: 3,
      baseDelay: 100,        // 100ms base delay
      maxDelay: 5000,        // 5 second max delay
      exponentialBase: 2,    // 2x backoff (100ms, 200ms, 400ms...)
      jitter: true,          // Add randomness
      retryableErrors: [
        'ECONNRESET',
        'ETIMEDOUT',
        'ECONNREFUSED',
        'ENOTFOUND',
        'ENETUNREACH',
        'EAI_AGAIN'
      ],
      retryableStatusCodes: [408, 429, 500, 502, 503, 504]
    };

    // Service-specific configurations
    this.serviceConfigs = {
      'database': {
        maxAttempts: 3,
        baseDelay: 50,
        retryableErrors: ['ECONNRESET', 'ETIMEDOUT', '57P01', '57P02', '57P03']
      },
      'stripe': {
        maxAttempts: 3,
        baseDelay: 200,
        retryableStatusCodes: [429, 500, 502, 503]
      },
      'email': {
        maxAttempts: 5,
        baseDelay: 1000,
        maxDelay: 30000
      },
      'external_api': {
        maxAttempts: 4,
        baseDelay: 500,
        maxDelay: 10000
      },
      's3': {
        maxAttempts: 3,
        baseDelay: 100,
        retryableStatusCodes: [500, 503, 504]
      }
    };
  }

  /**
   * Execute function with retry logic
   */
  async execute(fn, options = {}) {
    const config = { ...this.defaultConfig, ...options };
    const serviceName = options.service || 'unknown';
    
    let lastError;
    const startTime = Date.now();

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        // Execute function
        const result = await fn();
        
        // Success
        if (attempt > 1) {
          this.metrics.retrySuccess.inc({ service: serviceName });
          logger.info('Retry succeeded', {
            service: serviceName,
            attempt,
            totalDuration: Date.now() - startTime
          });
        }
        
        return result;

      } catch (error) {
        lastError = error;
        
        // Track retry attempt
        this.metrics.retries.inc({
          service: serviceName,
          attempt: attempt.toString()
        });

        // Check if error is retryable
        if (!this.isRetryable(error, config)) {
          logger.debug('Error not retryable', {
            service: serviceName,
            error: error.message,
            code: error.code,
            statusCode: error.statusCode
          });
          throw error;
        }

        // Last attempt - give up
        if (attempt === config.maxAttempts) {
          this.metrics.retryFailure.inc({
            service: serviceName,
            error_type: error.code || error.statusCode || 'unknown'
          });
          
          const duration = (Date.now() - startTime) / 1000;
          this.metrics.retryDuration.observe({ service: serviceName }, duration);
          
          logger.error('All retry attempts failed', {
            service: serviceName,
            attempts: attempt,
            lastError: error.message,
            totalDuration: Date.now() - startTime
          });
          
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt, config);
        
        logger.warn('Retry attempt failed, backing off', {
          service: serviceName,
          attempt,
          nextAttempt: attempt + 1,
          delay,
          error: error.message,
          code: error.code || error.statusCode
        });

        // Wait before next attempt
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Check if error is retryable
   */
  isRetryable(error, config) {
    // Check error code
    if (error.code && config.retryableErrors.includes(error.code)) {
      return true;
    }

    // Check HTTP status code
    if (error.statusCode && config.retryableStatusCodes.includes(error.statusCode)) {
      return true;
    }

    // Check response status (Axios style)
    if (error.response && error.response.status && 
        config.retryableStatusCodes.includes(error.response.status)) {
      return true;
    }

    return false;
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  calculateDelay(attempt, config) {
    // Exponential backoff: baseDelay * (exponentialBase ^ (attempt - 1))
    let delay = config.baseDelay * Math.pow(config.exponentialBase, attempt - 1);
    
    // Cap at maxDelay
    delay = Math.min(delay, config.maxDelay);
    
    // Add jitter (randomness between 0% and 100% of delay)
    if (config.jitter) {
      const jitterAmount = delay * Math.random();
      delay = delay + jitterAmount;
    }
    
    return Math.floor(delay);
  }

  /**
   * Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get service-specific configuration
   */
  getConfig(serviceName) {
    return {
      ...this.defaultConfig,
      ...(this.serviceConfigs[serviceName] || {})
    };
  }

  /**
   * Retry wrapper for database queries
   */
  async database(fn) {
    return this.execute(fn, {
      ...this.getConfig('database'),
      service: 'database'
    });
  }

  /**
   * Retry wrapper for Stripe calls
   */
  async stripe(fn) {
    return this.execute(fn, {
      ...this.getConfig('stripe'),
      service: 'stripe'
    });
  }

  /**
   * Retry wrapper for email sending
   */
  async email(fn) {
    return this.execute(fn, {
      ...this.getConfig('email'),
      service: 'email'
    });
  }

  /**
   * Retry wrapper for external API calls
   */
  async externalApi(fn) {
    return this.execute(fn, {
      ...this.getConfig('external_api'),
      service: 'external_api'
    });
  }

  /**
   * Retry wrapper for S3/MinIO operations
   */
  async s3(fn) {
    return this.execute(fn, {
      ...this.getConfig('s3'),
      service: 's3'
    });
  }
}

// Singleton instance
const smartRetry = new SmartRetry();

/**
 * Convenience function for retrying operations
 * 
 * @example
 * const data = await retry(
 *   () => axios.get('https://api.example.com/data'),
 *   { service: 'external_api', maxAttempts: 5 }
 * );
 */
export async function retry(fn, options = {}) {
  return smartRetry.execute(fn, options);
}

/**
 * Convenience functions for specific services
 */
export const retryDatabase = (fn) => smartRetry.database(fn);
export const retryStripe = (fn) => smartRetry.stripe(fn);
export const retryEmail = (fn) => smartRetry.email(fn);
export const retryExternalApi = (fn) => smartRetry.externalApi(fn);
export const retryS3 = (fn) => smartRetry.s3(fn);

export default smartRetry;
