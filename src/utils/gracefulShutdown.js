/**
 * Graceful Shutdown Handler
 * Ensures clean shutdown during deployments and restarts
 * Prevents dropped requests and data corruption
 */

import logger from '../config/logger.js';
import { closeSentry } from '../config/sentry.js';

let isShuttingDown = false;
const shutdownCallbacks = [];

/**
 * Register cleanup callback
 * @param {Function} callback - Async cleanup function
 */
export function onShutdown(callback) {
  shutdownCallbacks.push(callback);
}

/**
 * Check if server is shutting down
 */
export function isShutdownInProgress() {
  return isShuttingDown;
}

/**
 * Graceful shutdown middleware
 * Returns 503 Service Unavailable during shutdown
 */
export function shutdownMiddleware(req, res, next) {
  if (isShuttingDown) {
    res.set('Connection', 'close');
    return res.status(503).json({
      error: 'Server is shutting down',
      retry_after: 30
    });
  }
  next();
}

/**
 * Initialize graceful shutdown handlers
 */
export function initializeGracefulShutdown(server) {
  const signals = ['SIGTERM', 'SIGINT'];
  
  signals.forEach(signal => {
    process.on(signal, async () => {
      if (isShuttingDown) {
        logger.warn('Shutdown already in progress, forcing exit...');
        process.exit(1);
      }

      isShuttingDown = true;
      logger.info(`${signal} received, starting graceful shutdown...`);

      // Set timeout to force exit if graceful shutdown takes too long
      const forceExitTimeout = setTimeout(() => {
        logger.error('Graceful shutdown timeout exceeded, forcing exit');
        process.exit(1);
      }, 30000); // 30 seconds

      try {
        // Step 1: Stop accepting new connections
        logger.info('Stopping new connections...');
        server.close(() => {
          logger.info('Server closed to new connections');
        });

        // Step 2: Wait for existing connections to drain
        logger.info('Draining existing connections...');
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5s grace period

        // Step 3: Run registered cleanup callbacks
        logger.info(`Running ${shutdownCallbacks.length} cleanup callbacks...`);
        for (const callback of shutdownCallbacks) {
          try {
            await callback();
          } catch (error) {
            logger.error('Cleanup callback error:', error);
          }
        }

        // Step 4: Close Sentry
        await closeSentry();

        clearTimeout(forceExitTimeout);
        logger.info('Graceful shutdown completed successfully');
        process.exit(0);

      } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        clearTimeout(forceExitTimeout);
        process.exit(1);
      }
    });
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception - initiating shutdown:', error);
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection - initiating shutdown:', { reason, promise });
    process.exit(1);
  });

  logger.info('Graceful shutdown handlers initialized');
}

export default {
  onShutdown,
  isShutdownInProgress,
  shutdownMiddleware,
  initializeGracefulShutdown
};
