/**
 * Sentry Configuration
 * Production error monitoring and performance tracking
 * https://docs.sentry.io/platforms/node/
 */

import * as Sentry from '@sentry/node';
import logger from './logger.js';

/**
 * Initialize Sentry
 * Call this BEFORE any other app code
 */
export function initSentry(app) {
  // Only initialize in production or if explicitly enabled
  if (process.env.NODE_ENV !== 'production' && !process.env.SENTRY_ENABLED) {
    logger.info('Sentry disabled (not in production mode)');
    return;
  }

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.warn('SENTRY_DSN not configured - error monitoring disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    
    // Release tracking (use git commit SHA or version)
    release: process.env.GIT_COMMIT || process.env.npm_package_version,
    
    // Performance Monitoring
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'), // 10% of requests
    
    // Profiling disabled by default (requires @sentry/profiling-node to be properly configured)
    // profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
    
    // Error filtering
    beforeSend(event, hint) {
      // Don't send errors in development unless explicitly enabled
      if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_ENABLED) {
        return null;
      }

      // Filter out specific errors (e.g., bots, known issues)
      const error = hint.originalException;
      
      // Ignore common bot/crawler errors
      if (error?.message?.includes('favicon.ico')) return null;
      if (error?.message?.includes('robots.txt')) return null;
      
      // Ignore validation errors (client mistakes, not bugs)
      if (event.tags?.errorType === 'validation') return null;
      
      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.error('[Sentry] Would send error:', event.message || event.exception);
      }
      
      return event;
    },

    // Performance filtering
    beforeSendTransaction(transaction) {
      // Don't track health check endpoints
      if (transaction.name?.includes('/health')) return null;
      if (transaction.name?.includes('/ping')) return null;
      
      return transaction;
    },
  });

  // Express middleware integration
  if (app) {
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());
    logger.info('Sentry request handlers initialized');
  }

  logger.info(`Sentry initialized for ${process.env.NODE_ENV} environment`);
}

/**
 * Error handler middleware for Express
 * Must be added AFTER all routes, BEFORE other error handlers
 */
export function sentryErrorHandler(error, req, res, next) {
  // Only capture 5xx errors
  if (!error.status || error.status >= 500) {
    Sentry.captureException(error, {
      user: req.user ? {
        id: req.user.id,
        email: req.user.email,
        tenantId: req.user.tenantId
      } : undefined,
      extra: {
        url: req.url,
        method: req.method,
        ip: req.ip
      }
    });
  }
  
  // Pass to next error handler
  next(error);
}

/**
 * Capture exception manually
 */
export function captureException(error, context = {}) {
  Sentry.captureException(error, {
    tags: context.tags || {},
    extra: context.extra || {},
    user: context.user || {},
    level: context.level || 'error',
  });
  
  // Also log locally
  logger.error('Exception captured by Sentry:', error, context);
}

/**
 * Capture message manually
 */
export function captureMessage(message, level = 'info', context = {}) {
  Sentry.captureMessage(message, {
    level,
    tags: context.tags || {},
    extra: context.extra || {},
    user: context.user || {},
  });
  
  logger.info('Message captured by Sentry:', message, context);
}

/**
 * Set user context for error tracking
 */
export function setUser(user) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username || user.email,
    tenantId: user.tenantId,
    role: user.role,
  });
}

/**
 * Clear user context (e.g., on logout)
 */
export function clearUser() {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging context
 */
export function addBreadcrumb(category, message, data = {}) {
  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level: 'info',
    timestamp: Date.now() / 1000,
  });
}

/**
 * Start a transaction for performance monitoring
 */
export function startTransaction(name, op = 'function') {
  return Sentry.startTransaction({
    name,
    op,
  });
}

/**
 * Close and flush Sentry before app shutdown
 */
export async function closeSentry(timeout = 2000) {
  logger.info('Closing Sentry...');
  await Sentry.close(timeout);
}

export default {
  initSentry,
  sentryErrorHandler,
  captureException,
  captureMessage,
  setUser,
  clearUser,
  addBreadcrumb,
  startTransaction,
  closeSentry,
};
