/**
 * Enterprise Middleware Orchestrator
 * 
 * Centralizes all middleware logic with proper ordering:
 * 1. Request ID & Logging
 * 2. Security headers
 * 3. CORS
 * 4. Rate limiting
 * 5. Shield (security policy)
 * 6. Authentication (smart tiered)
 * 7. Route handlers
 */

import logger from '../config/logger.js';
import { smartAuth, isPublicRoute } from './authTiers.js';
import shieldMiddleware from './shield.js';

/**
 * Apply middleware to router with proper ordering
 */
export function applyMiddleware(router, options = {}) {
  const {
    enableShield = true,
    enableAuth = true,
    enableLogging = true,
    customMiddleware = []
  } = options;

  // 1. Shield security (if enabled)
  if (enableShield) {
    router.use((req, res, next) => {
      const path = req.path || req.originalUrl;
      
      // Skip shield for public routes
      if (isPublicRoute(path)) {
        res.setHeader('X-mPanel-Shield', 'bypass:public_route');
        return next();
      }
      
      // Apply shield for protected routes
      return shieldMiddleware(req, res, next);
    });
  }

  // 2. Smart authentication (if enabled)
  if (enableAuth) {
    router.use((req, res, next) => {
      const path = req.path || req.originalUrl;
      
      if (enableLogging) {
        logger.debug('Auth check', {
          path,
          isPublic: isPublicRoute(path),
          hasAuth: !!req.headers.authorization
        });
      }
      
      return smartAuth(req, res, next);
    });
  }

  // 3. Custom middleware
  customMiddleware.forEach(middleware => {
    router.use(middleware);
  });

  return router;
}

/**
 * Create a public router (no auth required)
 */
export function createPublicRouter() {
  const { Router } = await import('express');
  const router = Router();
  
  // No auth, but still apply shield
  return applyMiddleware(router, {
    enableAuth: false,
    enableShield: true,
    enableLogging: true
  });
}

/**
 * Create a protected router (auth required)
 */
export function createProtectedRouter() {
  const { Router } = await import('express');
  const router = Router();
  
  // Full middleware stack
  return applyMiddleware(router, {
    enableAuth: true,
    enableShield: true,
    enableLogging: true
  });
}

/**
 * Create an admin router (admin role required)
 */
export function createAdminRouter() {
  const { Router } = await import('express');
  const router = Router();
  const { requireAdmin } = await import('./authTiers.js');
  
  // Full middleware + admin role check
  return applyMiddleware(router, {
    enableAuth: true,
    enableShield: true,
    customMiddleware: [requireAdmin]
  });
}

/**
 * Log middleware execution for debugging
 */
export function logMiddlewareStack(req, res, next) {
  logger.debug('Middleware stack execution', {
    path: req.path,
    method: req.method,
    isPublic: isPublicRoute(req.path),
    hasUser: !!req.user,
    headers: {
      authorization: !!req.headers.authorization,
      shield: res.getHeader('X-mPanel-Shield')
    }
  });
  next();
}

export default {
  applyMiddleware,
  createPublicRouter,
  createProtectedRouter,
  createAdminRouter,
  logMiddlewareStack
};
