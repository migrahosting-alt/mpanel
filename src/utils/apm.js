/**
 * APM (Application Performance Monitoring) Integration
 * 
 * Features:
 * - Transaction tracing across requests
 * - Database query attribution
 * - Distributed tracing support
 * - Performance profiling
 * - Custom instrumentation
 * - Integration with Sentry Performance
 */

import logger from '../config/logger.js';
import * as Sentry from '@sentry/node';
import { Counter, Histogram, Summary } from 'prom-client';
import crypto from 'crypto';

class APMService {
  constructor() {
    this.enabled = process.env.APM_ENABLED === 'true' || process.env.NODE_ENV === 'production';
    this.activeTransactions = new Map();
    this.activeSpans = new Map();
    
    this.metrics = {
      transactions: new Counter({
        name: 'apm_transactions_total',
        help: 'Total number of transactions',
        labelNames: ['name', 'status']
      }),
      transactionDuration: new Histogram({
        name: 'apm_transaction_duration_seconds',
        help: 'Transaction duration',
        labelNames: ['name', 'status'],
        buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
      }),
      spans: new Counter({
        name: 'apm_spans_total',
        help: 'Total number of spans',
        labelNames: ['operation', 'status']
      }),
      spanDuration: new Histogram({
        name: 'apm_span_duration_seconds',
        help: 'Span duration',
        labelNames: ['operation'],
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2]
      }),
      databaseQueries: new Counter({
        name: 'apm_database_queries_total',
        help: 'Total database queries',
        labelNames: ['operation', 'table']
      }),
      databaseQueryDuration: new Summary({
        name: 'apm_database_query_duration_seconds',
        help: 'Database query duration',
        labelNames: ['operation', 'table'],
        percentiles: [0.5, 0.9, 0.95, 0.99]
      }),
      externalCalls: new Counter({
        name: 'apm_external_calls_total',
        help: 'Total external API calls',
        labelNames: ['service', 'status']
      })
    };

    this.config = {
      sampleRate: parseFloat(process.env.APM_SAMPLE_RATE || '1.0'),
      captureHeaders: process.env.APM_CAPTURE_HEADERS !== 'false',
      captureBody: process.env.APM_CAPTURE_BODY === 'true',
      slowTransactionThreshold: parseInt(process.env.APM_SLOW_TRANSACTION_MS || '1000'),
      slowSpanThreshold: parseInt(process.env.APM_SLOW_SPAN_MS || '100')
    };
  }

  /**
   * Start a transaction (e.g., HTTP request, background job)
   */
  startTransaction(name, options = {}) {
    if (!this.enabled) return null;

    // Sample based on sample rate
    if (Math.random() > this.config.sampleRate) {
      return null;
    }

    const transactionId = options.transactionId || this.generateId();
    const parentTransactionId = options.parentTransactionId;
    
    const transaction = {
      id: transactionId,
      parentId: parentTransactionId,
      name,
      type: options.type || 'custom',
      startTime: Date.now(),
      startHrTime: process.hrtime.bigint(),
      spans: [],
      metadata: options.metadata || {},
      context: {
        request: options.request,
        user: options.user,
        tags: options.tags || {}
      },
      status: 'started'
    };

    this.activeTransactions.set(transactionId, transaction);

    // Sentry transaction
    if (Sentry.getCurrentHub) {
      const sentryTransaction = Sentry.startTransaction({
        name,
        op: options.type || 'custom',
        parentSpanId: parentTransactionId,
        ...options.sentryOptions
      });
      transaction.sentryTransaction = sentryTransaction;
    }

    logger.debug('APM transaction started', {
      transactionId,
      name,
      type: options.type
    });

    return transactionId;
  }

  /**
   * End a transaction
   */
  endTransaction(transactionId, options = {}) {
    if (!this.enabled || !transactionId) return;

    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) return;

    const endTime = Date.now();
    const duration = (endTime - transaction.startTime) / 1000;
    const status = options.status || 'success';

    transaction.endTime = endTime;
    transaction.duration = duration;
    transaction.status = status;

    // Update metrics
    this.metrics.transactions.inc({
      name: transaction.name,
      status
    });

    this.metrics.transactionDuration.observe({
      name: transaction.name,
      status
    }, duration);

    // Log slow transactions
    if (duration * 1000 > this.config.slowTransactionThreshold) {
      logger.warn('Slow transaction detected', {
        transactionId,
        name: transaction.name,
        duration: `${duration.toFixed(3)}s`,
        spans: transaction.spans.length
      });
    }

    // End Sentry transaction
    if (transaction.sentryTransaction) {
      transaction.sentryTransaction.setStatus(status);
      transaction.sentryTransaction.finish();
    }

    // Store transaction data (could send to APM backend)
    this.storeTransaction(transaction);

    this.activeTransactions.delete(transactionId);

    logger.debug('APM transaction ended', {
      transactionId,
      duration: `${duration.toFixed(3)}s`,
      status
    });
  }

  /**
   * Start a span (sub-operation within a transaction)
   */
  startSpan(transactionId, operation, options = {}) {
    if (!this.enabled || !transactionId) return null;

    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) return null;

    const spanId = this.generateId();
    
    const span = {
      id: spanId,
      transactionId,
      operation,
      type: options.type || 'custom',
      startTime: Date.now(),
      startHrTime: process.hrtime.bigint(),
      metadata: options.metadata || {},
      tags: options.tags || {}
    };

    this.activeSpans.set(spanId, span);
    transaction.spans.push(span);

    // Sentry span
    if (transaction.sentryTransaction) {
      const sentrySpan = transaction.sentryTransaction.startChild({
        op: operation,
        description: options.description,
        ...options.sentryOptions
      });
      span.sentrySpan = sentrySpan;
    }

    return spanId;
  }

  /**
   * End a span
   */
  endSpan(spanId, options = {}) {
    if (!this.enabled || !spanId) return;

    const span = this.activeSpans.get(spanId);
    if (!span) return;

    const endTime = Date.now();
    const duration = (endTime - span.startTime) / 1000;
    const status = options.status || 'success';

    span.endTime = endTime;
    span.duration = duration;
    span.status = status;
    span.result = options.result;

    // Update metrics
    this.metrics.spans.inc({
      operation: span.operation,
      status
    });

    this.metrics.spanDuration.observe({
      operation: span.operation
    }, duration);

    // Log slow spans
    if (duration * 1000 > this.config.slowSpanThreshold) {
      logger.debug('Slow span detected', {
        spanId,
        operation: span.operation,
        duration: `${duration.toFixed(3)}s`
      });
    }

    // End Sentry span
    if (span.sentrySpan) {
      span.sentrySpan.setStatus(status);
      span.sentrySpan.finish();
    }

    this.activeSpans.delete(spanId);
  }

  /**
   * Track database query
   */
  trackDatabaseQuery(transactionId, query, options = {}) {
    const { operation, table, duration, rows } = options;
    
    // Extract operation and table from query if not provided
    const parsedOperation = operation || this.extractOperation(query);
    const parsedTable = table || this.extractTable(query);

    // Update metrics
    this.metrics.databaseQueries.inc({
      operation: parsedOperation,
      table: parsedTable
    });

    if (duration) {
      this.metrics.databaseQueryDuration.observe({
        operation: parsedOperation,
        table: parsedTable
      }, duration / 1000);
    }

    // Create span for the query
    if (transactionId) {
      const spanId = this.startSpan(transactionId, 'db.query', {
        description: query.substring(0, 100),
        metadata: {
          operation: parsedOperation,
          table: parsedTable,
          rows
        }
      });

      if (duration && spanId) {
        // Span already completed, just update
        const span = this.activeSpans.get(spanId);
        if (span) {
          span.endTime = span.startTime + duration;
          span.duration = duration / 1000;
          this.endSpan(spanId);
        }
      }
    }
  }

  /**
   * Track external API call
   */
  trackExternalCall(transactionId, service, options = {}) {
    const { method, url, status, duration } = options;

    this.metrics.externalCalls.inc({
      service,
      status: status ? `${status}` : 'unknown'
    });

    if (transactionId) {
      const spanId = this.startSpan(transactionId, 'http.client', {
        description: `${method} ${url}`,
        metadata: {
          service,
          method,
          url,
          status
        }
      });

      if (duration && spanId) {
        setTimeout(() => {
          this.endSpan(spanId, { status: status >= 400 ? 'error' : 'success' });
        }, 0);
      }
    }
  }

  /**
   * Extract SQL operation (SELECT, INSERT, UPDATE, DELETE)
   */
  extractOperation(sql) {
    const match = sql.trim().toUpperCase().match(/^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/);
    return match ? match[1] : 'UNKNOWN';
  }

  /**
   * Extract table name from SQL
   */
  extractTable(sql) {
    const fromMatch = sql.match(/FROM\s+(\w+)/i);
    const intoMatch = sql.match(/INTO\s+(\w+)/i);
    const updateMatch = sql.match(/UPDATE\s+(\w+)/i);
    
    return fromMatch?.[1] || intoMatch?.[1] || updateMatch?.[1] || 'unknown';
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Store transaction data (could send to external APM service)
   */
  storeTransaction(transaction) {
    // In production, this would send to APM backend (Datadog, New Relic, etc.)
    // For now, just log aggregated data
    
    if (transaction.duration > this.config.slowTransactionThreshold / 1000) {
      logger.info('Transaction trace', {
        id: transaction.id,
        name: transaction.name,
        duration: transaction.duration,
        spans: transaction.spans.length,
        slowSpans: transaction.spans.filter(s => s.duration > this.config.slowSpanThreshold / 1000).length
      });
    }
  }

  /**
   * Get APM statistics
   */
  getStats() {
    return {
      enabled: this.enabled,
      activeTransactions: this.activeTransactions.size,
      activeSpans: this.activeSpans.size,
      config: this.config
    };
  }

  /**
   * Express middleware for automatic transaction tracking
   */
  middleware() {
    return (req, res, next) => {
      if (!this.enabled) return next();

      const transactionId = this.startTransaction(`${req.method} ${req.route?.path || req.path}`, {
        type: 'http.request',
        request: {
          method: req.method,
          url: req.url,
          headers: this.config.captureHeaders ? req.headers : undefined
        },
        user: req.user ? {
          id: req.user.id,
          email: req.user.email
        } : undefined,
        tags: {
          'http.method': req.method,
          'http.url': req.url,
          'http.route': req.route?.path
        }
      });

      // Store transaction ID in request
      req.apmTransactionId = transactionId;

      // Track response
      const originalSend = res.send.bind(res);
      res.send = function(data) {
        if (transactionId) {
          apm.endTransaction(transactionId, {
            status: res.statusCode >= 400 ? 'error' : 'success'
          });
        }
        return originalSend(data);
      };

      next();
    };
  }
}

// Singleton instance
const apm = new APMService();

/**
 * Convenience functions
 */
export function startTransaction(name, options) {
  return apm.startTransaction(name, options);
}

export function endTransaction(transactionId, options) {
  return apm.endTransaction(transactionId, options);
}

export function startSpan(transactionId, operation, options) {
  return apm.startSpan(transactionId, operation, options);
}

export function endSpan(spanId, options) {
  return apm.endSpan(spanId, options);
}

export function trackDatabaseQuery(transactionId, query, options) {
  return apm.trackDatabaseQuery(transactionId, query, options);
}

export function trackExternalCall(transactionId, service, options) {
  return apm.trackExternalCall(transactionId, service, options);
}

export function apmMiddleware() {
  return apm.middleware();
}

export default apm;
