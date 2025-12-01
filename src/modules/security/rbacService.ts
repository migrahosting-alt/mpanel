/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * RBAC Service - Centralized Role-Based Access Control for multi-tenant operations.
 * 
 * CRITICAL: Every API that deals with tenant data MUST use these helpers.
 * 
 * Permission Format: "{resource}:{action}" e.g., "cloudpods:manage", "billing:read"
 * 
 * Role Hierarchy:
 * - SUPER_ADMIN: Full platform access, cross-tenant operations
 * - ADMIN: Full access within their tenant
 * - OWNER: Tenant owner, can manage users and billing
 * - MEMBER: Regular tenant member, limited access
 * - VIEWER: Read-only access
 */

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';

// User role type (string-based since DB uses varchar)
export type UserRole = 'super_admin' | 'admin' | 'support' | 'billing' | 'read_only' | 'customer' | string;

// ============================================
// TYPES
// ============================================

export interface RbacUser {
  userId: string;
  email?: string;
  role: UserRole;
  tenantId?: string | null;
}

export interface PermissionCheck {
  user: RbacUser;
  tenantId?: string | null;
  permission: string;
}

// ============================================
// ROLE DEFINITIONS
// ============================================

/**
 * Platform-level permissions (SUPER_ADMIN only)
 */
const PLATFORM_PERMISSIONS = [
  'platform:admin',
  'admin:read',
  'admin:write',
  'tenants:read',
  'tenants:write',
  'tenants:delete',
  'users:read:all',
  'users:write:all',
  'servers:manage',
  'provisioning:manage',
  'audit:read:all',
  'billing:read:all',
] as const;

/**
 * Tenant-level permissions by role
 */
const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  SUPER_ADMIN: [
    ...PLATFORM_PERMISSIONS,
    'cloudpods:read',
    'cloudpods:write',
    'cloudpods:manage',
    'cloudpods:delete',
    'subscriptions:read',
    'subscriptions:write',
    'subscriptions:cancel',
    'domains:read',
    'domains:write',
    'dns:read',
    'dns:write',
    'billing:read',
    'billing:write',
    'users:read',
    'users:write',
    'users:invite',
    'audit:read',
  ],
  ADMIN: [
    'cloudpods:read',
    'cloudpods:write',
    'cloudpods:manage',
    'cloudpods:delete',
    'subscriptions:read',
    'subscriptions:write',
    'subscriptions:cancel',
    'domains:read',
    'domains:write',
    'dns:read',
    'dns:write',
    'billing:read',
    'billing:write',
    'users:read',
    'users:write',
    'users:invite',
    'audit:read',
  ],
  OWNER: [
    'cloudpods:read',
    'cloudpods:write',
    'cloudpods:manage',
    'subscriptions:read',
    'subscriptions:write',
    'domains:read',
    'domains:write',
    'dns:read',
    'dns:write',
    'billing:read',
    'billing:write',
    'users:read',
    'users:invite',
    'audit:read',
  ],
  MEMBER: [
    'cloudpods:read',
    'cloudpods:write',
    'subscriptions:read',
    'domains:read',
    'dns:read',
    'billing:read',
    'users:read',
  ],
  VIEWER: [
    'cloudpods:read',
    'subscriptions:read',
    'domains:read',
    'dns:read',
    'billing:read',
  ],
  CLIENT: [
    'cloudpods:read',
    'cloudpods:write',
    'subscriptions:read',
    'domains:read',
    'dns:read',
    'billing:read',
  ],
  USER: [
    'cloudpods:read',
    'subscriptions:read',
    'billing:read',
  ],
};

// ============================================
// CORE RBAC FUNCTIONS
// ============================================

/**
 * Check if a user has a specific permission.
 * Does NOT check tenant membership - use requireTenantPermission for that.
 */
export function hasPermission(user: RbacUser, permission: string): boolean {
  const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
  return rolePermissions.includes(permission);
}

/**
 * Check if user has platform-level (cross-tenant) permission.
 * Only SUPER_ADMIN has platform permissions.
 */
export function hasPlatformPermission(user: RbacUser, permission: string): boolean {
  if (user.role !== 'SUPER_ADMIN') {
    return false;
  }
  return PLATFORM_PERMISSIONS.includes(permission as any);
}

/**
 * Require a tenant-scoped permission.
 * Verifies user belongs to tenant AND has the required permission.
 * 
 * @throws Error if user doesn't have permission or doesn't belong to tenant
 */
export async function requireTenantPermission(
  user: RbacUser,
  tenantId: string,
  permission: string
): Promise<void> {
  // SUPER_ADMIN bypasses tenant membership check
  if (user.role === 'SUPER_ADMIN') {
    if (!hasPermission(user, permission)) {
      logger.warn('RBAC: Permission denied', {
        userId: user.userId,
        role: user.role,
        permission,
        tenantId,
      });
      throw new Error(`Permission denied: ${permission}`);
    }
    return;
  }

  // Check user belongs to tenant
  const membership = await prisma.tenantUser.findFirst({
    where: {
      userId: user.userId,
      tenantId,
    },
    select: { role: true },
  });

  if (!membership) {
    logger.warn('RBAC: User not member of tenant', {
      userId: user.userId,
      tenantId,
    });
    throw new Error('Access denied: Not a member of this tenant');
  }

  // Use tenant-specific role for permission check
  const effectiveRole = membership.role || user.role;
  const effectivePermissions = ROLE_PERMISSIONS[effectiveRole] || [];

  if (!effectivePermissions.includes(permission)) {
    logger.warn('RBAC: Permission denied', {
      userId: user.userId,
      role: effectiveRole,
      permission,
      tenantId,
    });
    throw new Error(`Permission denied: ${permission}`);
  }
}

/**
 * Require a platform-level permission.
 * Only SUPER_ADMIN can access platform operations.
 * 
 * @throws Error if user doesn't have platform permission
 */
export async function requirePlatformPermission(
  user: RbacUser,
  permission: string
): Promise<void> {
  if (!hasPlatformPermission(user, permission)) {
    logger.warn('RBAC: Platform permission denied', {
      userId: user.userId,
      role: user.role,
      permission,
    });
    throw new Error(`Platform permission denied: ${permission}`);
  }
}

/**
 * Check if user belongs to a tenant.
 */
export async function userBelongsToTenant(
  userId: string,
  tenantId: string
): Promise<boolean> {
  const membership = await prisma.tenantUser.findFirst({
    where: { userId, tenantId },
  });
  return !!membership;
}

/**
 * Get all tenants a user belongs to.
 */
export async function getUserTenants(userId: string): Promise<string[]> {
  const memberships = await prisma.tenantUser.findMany({
    where: { userId },
    select: { tenantId: true },
  });
  return memberships.map(m => m.tenantId);
}

/**
 * Ensure a query is scoped to a specific tenant.
 * Returns a where clause filter for Prisma queries.
 * 
 * @example
 * const cloudPods = await prisma.cloudPod.findMany({
 *   where: {
 *     ...tenantScope(tenantId),
 *     status: 'RUNNING',
 *   },
 * });
 */
export function tenantScope(tenantId: string): { tenantId: string } {
  if (!tenantId) {
    throw new Error('tenantId is required for tenant-scoped queries');
  }
  return { tenantId };
}

/**
 * Get tenant ID from user context.
 * For SUPER_ADMIN, returns null (must specify tenant explicitly).
 * For other users, returns their primary tenant.
 */
export async function getTenantIdFromUser(user: RbacUser): Promise<string | null> {
  if (user.tenantId) {
    return user.tenantId;
  }

  if (user.role === 'SUPER_ADMIN') {
    return null; // SUPER_ADMIN must specify tenant
  }

  // Get user's primary tenant (first one they belong to)
  const memberships = await prisma.tenantUser.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: 'asc' },
    take: 1,
    select: { tenantId: true },
  });

  return memberships[0]?.tenantId || null;
}

// ============================================
// EXPRESS MIDDLEWARE
// ============================================

import { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../auth/auth.types.js';

/**
 * Middleware to require a specific permission.
 * Must be used AFTER authMiddleware.
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    
    if (!authReq.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!hasPermission(authReq.user, permission)) {
      res.status(403).json({ 
        error: 'Forbidden',
        message: `Permission denied: ${permission}`,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require tenant context.
 * Extracts tenantId from params, query, or body and validates access.
 */
export function requireTenantContext(permission: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    
    if (!authReq.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Extract tenantId from various sources
    const tenantId = req.params.tenantId || 
                    req.query.tenantId as string || 
                    req.body?.tenantId ||
                    authReq.user.tenantId;

    if (!tenantId) {
      res.status(400).json({ 
        error: 'Bad Request',
        message: 'tenantId is required',
      });
      return;
    }

    try {
      await requireTenantPermission(authReq.user, tenantId, permission);
      
      // Attach tenantId to request for downstream use
      (req as any).tenantId = tenantId;
      
      next();
    } catch (error) {
      res.status(403).json({ 
        error: 'Forbidden',
        message: error instanceof Error ? error.message : 'Access denied',
      });
    }
  };
}

/**
 * Middleware to require platform admin access.
 */
export function requirePlatformAdmin() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    
    if (!authReq.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    try {
      await requirePlatformPermission(authReq.user, 'platform:admin');
      next();
    } catch (error) {
      res.status(403).json({ 
        error: 'Forbidden',
        message: 'Platform admin access required',
      });
    }
  };
}

export default {
  hasPermission,
  hasPlatformPermission,
  requireTenantPermission,
  requirePlatformPermission,
  userBelongsToTenant,
  getUserTenants,
  tenantScope,
  getTenantIdFromUser,
  requirePermission,
  requireTenantContext,
  requirePlatformAdmin,
};
