/**
 * Circuit Breaker Pattern
 * Prevents cascading failures from external service outages
 * Auto-recovers when services become available
 */

import logger from '../config/logger.js';
import { captureException } from '../config/sentry.js';

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5; // Failures before opening
    this.timeout = options.timeout || 60000; // Time to wait before retry (1 min)
    this.resetTimeout = options.resetTimeout || 30000; // Time in half-open state
    this.monitoringPeriod = options.monitoringPeriod || 10000; // Period to track failures
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    this.recentFailures = []; // Track failures in monitoring period
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttemptTime) {
        const error = new Error(`Circuit breaker '${this.name}' is OPEN - service unavailable`);
        error.circuitBreaker = true;
        throw error;
      }
      
      // Transition to half-open to test service
      this.state = 'HALF_OPEN';
      logger.info(`Circuit breaker '${this.name}' entering HALF_OPEN state`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  onSuccess() {
    this.successes++;
    
    if (this.state === 'HALF_OPEN') {
      // Service recovered, close circuit
      this.state = 'CLOSED';
      this.failures = 0;
      this.recentFailures = [];
      logger.info(`Circuit breaker '${this.name}' closed - service recovered`);
    }
  }

  /**
   * Handle failed execution
   */
  onFailure(error) {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.recentFailures.push(Date.now());
    
    // Clean old failures outside monitoring period
    this.recentFailures = this.recentFailures.filter(
      time => Date.now() - time < this.monitoringPeriod
    );

    logger.warn(`Circuit breaker '${this.name}' failure (${this.recentFailures.length}/${this.failureThreshold})`, {
      error: error.message,
      state: this.state
    });

    if (this.state === 'HALF_OPEN') {
      // Service still failing, re-open circuit
      this.state = 'OPEN';
      this.nextAttemptTime = Date.now() + this.timeout;
      logger.error(`Circuit breaker '${this.name}' re-opened - service still unavailable`);
      captureException(error, {
        tags: { circuitBreaker: this.name, state: 'HALF_OPEN_FAILED' }
      });
    } else if (this.recentFailures.length >= this.failureThreshold) {
      // Too many failures, open circuit
      this.state = 'OPEN';
      this.nextAttemptTime = Date.now() + this.timeout;
      logger.error(`Circuit breaker '${this.name}' opened - threshold exceeded`, {
        failures: this.failures,
        threshold: this.failureThreshold
      });
      captureException(error, {
        tags: { circuitBreaker: this.name, state: 'OPENED' }
      });
    }
  }

  /**
   * Get circuit breaker status
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      recentFailures: this.recentFailures.length,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      isAvailable: this.state !== 'OPEN' || Date.now() >= this.nextAttemptTime
    };
  }

  /**
   * Manually reset circuit breaker
   */
  reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.recentFailures = [];
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    logger.info(`Circuit breaker '${this.name}' manually reset`);
  }
}

// Pre-configured circuit breakers for external services
export const stripeCircuitBreaker = new CircuitBreaker('stripe', {
  failureThreshold: 3,
  timeout: 30000, // 30s
  monitoringPeriod: 60000 // 1 min
});

export const twilioCircuitBreaker = new CircuitBreaker('twilio', {
  failureThreshold: 5,
  timeout: 60000, // 1 min
  monitoringPeriod: 300000 // 5 min
});

export const nameSiloCircuitBreaker = new CircuitBreaker('namesilo', {
  failureThreshold: 3,
  timeout: 120000, // 2 min
  monitoringPeriod: 600000 // 10 min
});

export const openAICircuitBreaker = new CircuitBreaker('openai', {
  failureThreshold: 5,
  timeout: 30000, // 30s
  monitoringPeriod: 120000 // 2 min
});

/**
 * Get status of all circuit breakers
 */
export function getAllCircuitBreakerStatus() {
  return {
    stripe: stripeCircuitBreaker.getStatus(),
    twilio: twilioCircuitBreaker.getStatus(),
    namesilo: nameSiloCircuitBreaker.getStatus(),
    openai: openAICircuitBreaker.getStatus()
  };
}

/**
 * Exponential backoff utility
 */
export async function withRetry(fn, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const initialDelay = options.initialDelay || 1000;
  const maxDelay = options.maxDelay || 10000;
  const factor = options.factor || 2;

  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const delay = Math.min(initialDelay * Math.pow(factor, attempt), maxDelay);
        logger.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`, {
          error: error.message
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

export default {
  CircuitBreaker,
  stripeCircuitBreaker,
  twilioCircuitBreaker,
  nameSiloCircuitBreaker,
  openAICircuitBreaker,
  getAllCircuitBreakerStatus,
  withRetry
};
