/**
 * RBAC Middleware - Role-Based Access Control
 * For tenant-scoped and platform-level permissions
 */

import type { Request, Response, NextFunction } from 'express';
import logger from '../config/logger.js';

// Authenticated request type
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    tenantId: string;
    role: string;
  };
}

/**
 * Require specific tenant roles
 * Must be used AFTER authMiddleware
 */
export function requireTenantRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    if (!allowedRoles.includes(authReq.user.role)) {
      logger.warn('RBAC: Access denied', {
        userId: authReq.user.userId,
        role: authReq.user.role,
        requiredRoles: allowedRoles,
        path: req.path,
      });

      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
      });
      return;
    }

    next();
  };
}

/**
 * Require platform admin permission
 * For platform-wide operations (Customers, Servers, etc.)
 */
export function requirePlatformPermission(permission?: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    // Check for PLATFORM_ADMIN role or platform owner email
    const isPlatformAdmin =
      authReq.user.role === 'PLATFORM_ADMIN' ||
      authReq.user.email === process.env.PLATFORM_OWNER_EMAIL;

    if (!isPlatformAdmin) {
      logger.warn('RBAC: Platform access denied', {
        userId: authReq.user.userId,
        email: authReq.user.email,
        role: authReq.user.role,
        permission,
        path: req.path,
      });

      res.status(403).json({
        success: false,
        error: 'Platform access denied',
        message: 'This resource requires platform administrator privileges',
      });
      return;
    }

    next();
  };
}

export default {
  requireTenantRole,
  requirePlatformPermission,
};
