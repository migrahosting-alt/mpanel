/**
 * Auth Module Types
 * 
 * Enterprise-grade authentication types aligned with:
 * - Prisma schema (User, Tenant, TenantUser)
 * - RBAC rules (TenantUser.role: OWNER | ADMIN | MEMBER | BILLING | VIEWER)
 * - Multi-tenant isolation requirements
 */

import type { Request } from 'express';
import type { User, Tenant, TenantUser } from '@prisma/client';

// ============================================
// TENANT USER ROLE (from TenantUser.role)
// ============================================

/**
 * Role within a tenant context.
 * Stored in TenantUser.role as varchar.
 */
export type TenantRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'BILLING' | 'VIEWER';

export const TenantRole = {
  OWNER: 'OWNER' as TenantRole,
  ADMIN: 'ADMIN' as TenantRole,
  MEMBER: 'MEMBER' as TenantRole,
  BILLING: 'BILLING' as TenantRole,
  VIEWER: 'VIEWER' as TenantRole,
} as const;

/**
 * Role hierarchy for permission checks.
 * Higher number = more permissions.
 */
export const ROLE_HIERARCHY: Record<TenantRole, number> = {
  OWNER: 100,
  ADMIN: 80,
  BILLING: 60,
  MEMBER: 40,
  VIEWER: 20,
};

// ============================================
// JWT PAYLOAD
// ============================================

/**
 * JWT access token payload.
 * Contains user identity and current tenant context.
 */
export interface JwtPayload {
  /** User ID */
  userId: string;
  /** User email */
  email: string;
  /** Current active tenant ID */
  tenantId: string;
  /** User's role in the current tenant */
  role: TenantRole;
  /** Token type */
  type: 'access';
  /** Issued at (unix timestamp) */
  iat?: number;
  /** Expiration (unix timestamp) */
  exp?: number;
}

/**
 * JWT refresh token payload.
 * Minimal payload for token refresh.
 */
export interface RefreshTokenPayload {
  /** User ID */
  userId: string;
  /** Token type */
  type: 'refresh';
  /** Issued at (unix timestamp) */
  iat?: number;
  /** Expiration (unix timestamp) */
  exp?: number;
}

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

/**
 * Login request body.
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Tenant membership info returned in login response.
 */
export interface TenantMembership {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: TenantRole;
  isActive: boolean;
}

/**
 * User info returned in responses.
 */
export interface UserInfo {
  id: string;
  email: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  emailVerified: boolean;
  isActive: boolean;
}

/**
 * Login response.
 */
export interface LoginResponse {
  /** Access token */
  accessToken: string;
  /** Refresh token */
  refreshToken: string;
  /** Token type (always 'Bearer') */
  tokenType: 'Bearer';
  /** Access token expiration in seconds */
  expiresIn: number;
  /** Authenticated user info */
  user: UserInfo;
  /** User's tenant memberships */
  tenants: TenantMembership[];
  /** Currently active tenant */
  activeTenant: TenantMembership;
}

/**
 * Refresh token request body.
 */
export interface RefreshRequest {
  refreshToken: string;
}

/**
 * Refresh token response.
 */
export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

/**
 * Switch tenant request body.
 */
export interface SwitchTenantRequest {
  tenantId: string;
}

/**
 * Switch tenant response.
 */
export interface SwitchTenantResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  activeTenant: TenantMembership;
}

/**
 * Me response (current user info).
 */
export interface MeResponse {
  user: UserInfo;
  tenants: TenantMembership[];
  activeTenant: TenantMembership | null;
}

// ============================================
// AUTHENTICATED REQUEST
// ============================================

/**
 * User context attached to authenticated requests.
 */
export interface AuthUser {
  userId: string;
  email: string;
  tenantId: string;
  role: TenantRole;
}

/**
 * Express request with authenticated user context.
 */
export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

// ============================================
// USER WITH TENANT MEMBERSHIPS (for internal use)
// ============================================

/**
 * User with tenant memberships for auth operations.
 */
export interface UserWithTenants extends User {
  tenantUsers: (TenantUser & {
    tenant: Pick<Tenant, 'id' | 'name' | 'slug' | 'isActive' | 'status'>;
  })[];
}
