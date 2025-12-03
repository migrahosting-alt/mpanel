/**
 * Enterprise-Grade Authentication Middleware
 * 
 * Provides tiered auth:
 * - PUBLIC: No auth required
 * - AUTHENTICATED: Valid JWT required
 * - ROLE_BASED: JWT + specific role required
 */

import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Public routes that require NO authentication
const PUBLIC_ROUTES = [
  '/api/health',
  '/api/status',
  '/api/__debug',
  '/api/system/health',
  '/api/system/ready',
  '/api/system/live',
  '/api/system/metrics',
  '/system/health',
  '/system/ready',
  '/system/live',
  '/system/metrics',
  '/api/products/public',
  '/products/public',
  '/api/products/pricing',
  '/products/pricing',
  '/api/public/plans',
  '/public/plans',
  '/api/public/checkout',
  '/public/checkout',
  '/api/auth/login',
  '/auth/login',
  '/api/auth/register',
  '/auth/register',
  '/api/auth/refresh',
  '/auth/refresh',
  '/api/auth/forgot-password',
  '/auth/forgot-password',
  '/api/auth/reset-password',
  '/auth/reset-password',
  '/api/payments/stripe/webhook',
  '/payments/stripe/webhook',
];

/**
 * Check if route is public
 */
function isPublicRoute(path) {
  return PUBLIC_ROUTES.some(route => {
    if (route.endsWith('*')) {
      return path.startsWith(route.slice(0, -1));
    }
    return path === route || path.startsWith(route + '/') || path.startsWith(route + '?');
  });
}

/**
 * Extract JWT token from request
 */
function extractToken(req) {
  // Check Authorization header
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return parts[1];
    }
  }

  // Check cookies
  if (req.cookies?.auth_token || req.cookies?.token) {
    return req.cookies.auth_token || req.cookies.token;
  }

  // Check query param (for webhooks/callbacks only)
  if (req.query?.token) {
    return req.query.token;
  }

  return null;
}

/**
 * Verify and decode JWT token
 */
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Normalize payload fields
    return {
      userId: decoded.userId || decoded.id || decoded.user_id,
      email: decoded.email,
      tenantId: decoded.tenantId || decoded.tenant_id,
      role: decoded.role || 'user',
      permissions: decoded.permissions || [],
      ...decoded
    };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * TIER 1: Public route handler
 * Allows requests without authentication
 */
export function publicRoute(req, res, next) {
  // Try to attach user if token present, but don't require it
  const token = extractToken(req);
  if (token) {
    try {
      req.user = verifyToken(token);
    } catch (error) {
      // Ignore auth errors on public routes
      logger.debug('Optional auth failed on public route', { 
        path: req.path,
        error: error.message 
      });
    }
  }
  
  next();
}

/**
 * TIER 2: Authenticated route handler
 * Requires valid JWT token
 */
export function authenticatedRoute(req, res, next) {
  const token = extractToken(req);
  
  if (!token) {
    logger.warn('Authentication required but no token provided', {
      path: req.originalUrl,
      method: req.method,
      ip: req.ip
    });
    
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required. Please provide a valid access token.',
      code: 'AUTH_REQUIRED'
    });
  }

  try {
    req.user = verifyToken(token);
    
    logger.debug('User authenticated', {
      userId: req.user.userId,
      role: req.user.role,
      path: req.path
    });
    
    next();
  } catch (error) {
    logger.warn('Authentication failed', {
      error: error.message,
      path: req.originalUrl
    });

    if (error.message === 'Token expired') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Your session has expired. Please log in again.',
        code: 'TOKEN_EXPIRED'
      });
    }

    return res.status(401).json({
      error: 'Invalid token',
      message: 'Authentication failed. Please log in again.',
      code: 'AUTH_INVALID'
    });
  }
}

/**
 * TIER 3: Role-based authorization
 * Requires authenticated user with specific role
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userRole = req.user.role?.toUpperCase();
    const allowed = allowedRoles.map(r => r.toUpperCase());

    if (!allowed.includes(userRole)) {
      logger.warn('Authorization failed', {
        userId: req.user.userId,
        userRole,
        requiredRoles: allowedRoles,
        path: req.path
      });

      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}`,
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
}

/**
 * SMART MIDDLEWARE: Automatically routes based on path
 * - Public routes: No auth
 * - Private routes: Auth required
 */
export function smartAuth(req, res, next) {
  const path = req.originalUrl || (req.baseUrl ? req.baseUrl + req.path : req.path);

  // Public route - no auth required
  if (isPublicRoute(path)) {
    req.isPublicRoute = true;
    logger.info('smartAuth: public route', { path });
    return publicRoute(req, res, next);
  }

  // Private route - auth required
  req.isPublicRoute = false;
  logger.info('smartAuth: private route', { path });
  return authenticatedRoute(req, res, next);
}

/**
 * Optional auth middleware
 * Attaches user if token present, but doesn't require it
 */
export function optionalAuth(req, res, next) {
  return publicRoute(req, res, next);
}

// Export helpers
export { isPublicRoute, extractToken, verifyToken };

// Convenience exports
export const requireAdmin = requireRole('ADMIN', 'SUPERADMIN');
export const requireBilling = requireRole('BILLING', 'ADMIN', 'SUPERADMIN');
export const requireSupport = requireRole('SUPPORT', 'ADMIN', 'SUPERADMIN');

export default {
  publicRoute,
  authenticatedRoute,
  requireRole,
  smartAuth,
  optionalAuth,
  requireAdmin,
  requireBilling,
  requireSupport,
  isPublicRoute
};
