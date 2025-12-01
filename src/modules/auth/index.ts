/**
 * Auth Module Index
 * 
 * Enterprise-grade authentication module aligned with:
 * - Prisma schema (User, Tenant, TenantUser)
 * - RBAC via TenantUser.role (OWNER | ADMIN | MEMBER | BILLING | VIEWER)
 * - Multi-tenant isolation
 * - Audit logging
 */

// Router
export { default as authRouter } from './auth.router.js';

// Service
export { default as authService } from './auth.service.js';
export { verifyAccessToken, verifyRefreshToken } from './auth.service.js';

// Controller
export { default as authController } from './auth.controller.js';

// Middleware
export {
  authMiddleware,
  requireRole,
  requireOwner,
  requireAdmin,
  requireBilling,
  requireMember,
  optionalAuth,
  validateTenantContext,
} from './auth.middleware.js';

// Types
export type {
  TenantRole,
  JwtPayload,
  RefreshTokenPayload,
  LoginRequest,
  LoginResponse,
  RefreshRequest,
  RefreshResponse,
  SwitchTenantRequest,
  SwitchTenantResponse,
  MeResponse,
  UserInfo,
  TenantMembership,
  AuthUser,
  AuthenticatedRequest,
  UserWithTenants,
} from './auth.types.js';

export { TenantRole as TenantRoleConstants, ROLE_HIERARCHY } from './auth.types.js';
