/**
 * Auth Middleware - Enterprise-grade Request Authentication
 * 
 * Provides:
 * - JWT token verification (Bearer header or cookie)
 * - User context injection (req.user)
 * - Role-based access control
 * - Multi-tenant isolation
 * 
 * All protected routes should use authMiddleware.
 * Role guards should use requireRole() after authMiddleware.
 */

import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from './auth.service.js';
import type { AuthenticatedRequest, TenantRole, JwtPayload } from './auth.types.js';
import { ROLE_HIERARCHY } from './auth.types.js';
import logger from '../../config/logger.js';

// ============================================
// TOKEN EXTRACTION
// ============================================

/**
 * Extract JWT token from Authorization header or cookie.
 * Supports: "Bearer <token>" header or "auth_token" cookie.
 */
function extractToken(req: Request): string | null {
  // 1) Check Authorization header (preferred)
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return parts[1];
    }
  }

  // 2) Check cookie (fallback for browser sessions)
  if (req.cookies?.auth_token) {
    return req.cookies.auth_token as string;
  }

  return null;
}

// ============================================
// AUTH MIDDLEWARE
// ============================================

/**
 * Middleware to verify JWT token and attach user to request.
 * 
 * On success:
 * - Attaches req.user with { userId, email, tenantId, role }
 * - Calls next()
 * 
 * On failure:
 * - Returns 401 JSON error
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const token = extractToken(req);

    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'No authentication token provided',
      });
      return;
    }

    // Verify token and extract payload
    let payload: JwtPayload;
    try {
      payload = verifyAccessToken(token);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('expired')) {
          res.status(401).json({
            error: 'Token expired',
            message: 'Please refresh your token or log in again',
          });
          return;
        }

        if (error.message.includes('Invalid')) {
          res.status(401).json({
            error: 'Invalid token',
            message: 'Authentication failed',
          });
          return;
        }
      }

      throw error;
    }

    // Attach user to request
    (req as AuthenticatedRequest).user = {
      userId: payload.userId,
      email: payload.email,
      tenantId: payload.tenantId,
      role: payload.role,
    };

    next();
  } catch (error) {
    logger.error('Auth middleware error', {
      error: error instanceof Error ? error.message : 'Unknown',
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication check failed',
    });
  }
}

// ============================================
// ROLE GUARDS
// ============================================

/**
 * Middleware to require a minimum role level.
 * Must be used AFTER authMiddleware.
 * 
 * Uses role hierarchy: OWNER > ADMIN > BILLING > MEMBER > VIEWER
 * 
 * @example
 * router.post('/admin/action', authMiddleware, requireRole('ADMIN'), handler);
 */
export function requireRole(minimumRole: TenantRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authenticatedReq = req as AuthenticatedRequest;

    if (!authenticatedReq.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const userRole = authenticatedReq.user.role;
    const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[minimumRole] ?? 100;

    if (userLevel < requiredLevel) {
      logger.warn('Access denied - insufficient role', {
        userId: authenticatedReq.user.userId,
        userRole,
        requiredRole: minimumRole,
        tenantId: authenticatedReq.user.tenantId,
      });

      res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require OWNER role.
 */
export const requireOwner = requireRole('OWNER');

/**
 * Middleware to require ADMIN or higher.
 */
export const requireAdmin = requireRole('ADMIN');

/**
 * Middleware to require BILLING or higher.
 */
export const requireBilling = requireRole('BILLING');

/**
 * Middleware to require MEMBER or higher.
 */
export const requireMember = requireRole('MEMBER');

// ============================================
// OPTIONAL AUTH
// ============================================

/**
 * Optional auth middleware.
 * Attaches user if token is valid, but doesn't fail if missing.
 * Useful for routes that behave differently for authenticated vs anonymous users.
 */
export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const token = extractToken(req);

    if (token) {
      try {
        const payload = verifyAccessToken(token);

        (req as AuthenticatedRequest).user = {
          userId: payload.userId,
          email: payload.email,
          tenantId: payload.tenantId,
          role: payload.role,
        };
      } catch {
        // Silently ignore invalid tokens for optional auth
        logger.debug('Optional auth - invalid token ignored');
      }
    }
  } catch (error) {
    logger.debug('Optional auth error', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }

  next();
}

// ============================================
// TENANT CONTEXT VALIDATION
// ============================================

/**
 * Middleware to validate that the request's tenant context matches a route param.
 * Useful for routes like /tenants/:tenantId/resources.
 * 
 * @param paramName - The route parameter name (default: 'tenantId')
 */
export function validateTenantContext(paramName = 'tenantId') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authenticatedReq = req as AuthenticatedRequest;

    if (!authenticatedReq.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const routeTenantId = req.params[paramName];
    const userTenantId = authenticatedReq.user.tenantId;

    if (!routeTenantId) {
      // No tenant in route - use user's context
      next();
      return;
    }

    // Super admin can access any tenant (check by role hierarchy - OWNER = 100)
    const userLevel = ROLE_HIERARCHY[authenticatedReq.user.role] ?? 0;
    if (userLevel >= 100) {
      next();
      return;
    }

    // Regular users can only access their own tenant
    if (routeTenantId !== userTenantId) {
      logger.warn('Tenant context mismatch', {
        userId: authenticatedReq.user.userId,
        userTenantId,
        routeTenantId,
      });

      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this tenant',
      });
      return;
    }

    next();
  };
}
