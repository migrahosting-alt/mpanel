/**
 * Auth Service - Enterprise-grade Authentication
 * 
 * Aligned with:
 * - Prisma schema (User, Tenant, TenantUser)
 * - RBAC via TenantUser.role (OWNER | ADMIN | MEMBER | BILLING | VIEWER)
 * - Multi-tenant isolation
 * - Audit logging
 * 
 * Key functions:
 * - login: Authenticate user, load tenant memberships, return JWT
 * - refresh: Refresh access token using refresh token
 * - me: Get current user info with tenant memberships
 * - switchTenant: Change active tenant context
 */

import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import logger from '../../config/logger.js';
import { writeAuditEvent } from '../security/auditService.js';
import type {
  LoginRequest,
  LoginResponse,
  RefreshRequest,
  RefreshResponse,
  SwitchTenantRequest,
  SwitchTenantResponse,
  MeResponse,
  UserInfo,
  TenantMembership,
  JwtPayload,
  RefreshTokenPayload,
  TenantRole,
  UserWithTenants,
} from './auth.types.js';

// ============================================
// CONSTANTS
// ============================================

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';
const ACCESS_TOKEN_EXPIRES_SECONDS = 900; // 15 minutes

// ============================================
// TOKEN GENERATION
// ============================================

function generateAccessToken(payload: Omit<JwtPayload, 'type' | 'iat' | 'exp'>): string {
  return jwt.sign(
    { ...payload, type: 'access' },
    env.JWT_SECRET,
    {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      issuer: 'mpanel',
      audience: 'mpanel-api',
    }
  );
}

function generateRefreshToken(userId: string): string {
  return jwt.sign(
    { userId, type: 'refresh' },
    env.JWT_SECRET,
    {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
      issuer: 'mpanel',
      audience: 'mpanel-refresh',
    }
  );
}

// ============================================
// TOKEN VERIFICATION
// ============================================

function verifyAccessToken(token: string): JwtPayload {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: 'mpanel',
      audience: 'mpanel-api',
    });

    if (typeof payload === 'string' || payload.type !== 'access') {
      throw new Error('Invalid token type');
    }

    return payload as JwtPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: 'mpanel',
      audience: 'mpanel-refresh',
    });

    if (typeof payload === 'string' || payload.type !== 'refresh') {
      throw new Error('Invalid refresh token type');
    }

    return payload as RefreshTokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Refresh token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid refresh token');
    }
    throw error;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Build user info from User record.
 */
function buildUserInfo(user: UserWithTenants): UserInfo {
  const displayName = user.displayName ||
    user.name ||
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    user.email.split('@')[0];

  const isActive = user.isActive === true ||
    (typeof user.status === 'string' && user.status.toLowerCase() === 'active');

  return {
    id: user.id,
    email: user.email,
    displayName,
    firstName: user.firstName,
    lastName: user.lastName,
    emailVerified: user.emailVerified,
    isActive: Boolean(isActive),
  };
}

/**
 * Build tenant membership from TenantUser join.
 */
function buildTenantMembership(
  tenantUser: UserWithTenants['tenantUsers'][0]
): TenantMembership {
  const tenantIsActive = tenantUser.tenant.isActive === true ||
    (typeof tenantUser.tenant.status === 'string' && tenantUser.tenant.status.toLowerCase() === 'active');

  return {
    id: tenantUser.id,
    tenantId: tenantUser.tenant.id,
    tenantName: tenantUser.tenant.name,
    tenantSlug: tenantUser.tenant.slug,
    role: tenantUser.role as TenantRole,
    isActive: Boolean(tenantIsActive) && !tenantUser.deletedAt,
  };
}

/**
 * Get active tenant memberships for a user.
 */
function getActiveTenantMemberships(user: UserWithTenants): TenantMembership[] {
  return user.tenantUsers
    .filter(tu => !tu.deletedAt)
    .map(buildTenantMembership)
    .filter(m => m.isActive);
}

// ============================================
// AUTH SERVICE CLASS
// ============================================

export class AuthService {
  /**
   * Authenticate user with email and password.
   * 
   * Flow:
   * 1. Validate user exists
   * 2. Check user not deleted/disabled
   * 3. Verify password with bcrypt
   * 4. Load tenant memberships via TenantUser
   * 5. Require at least one active tenant membership
   * 6. Generate JWT with tenant context
   * 7. Emit audit event
   * 8. Return tokens + user + tenants
   */
  async login(data: LoginRequest, ipAddress?: string): Promise<LoginResponse> {
    const { email, password } = data;
    const normalizedEmail = email.toLowerCase().trim();

    // 1) Find user with tenant memberships
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        tenantUsers: {
          where: { deletedAt: null },
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
                isActive: true,
                status: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    }) as UserWithTenants | null;

    // 2) Check user exists - generic error to not reveal email existence
    if (!user) {
      logger.warn('Login failed - user not found', { email: normalizedEmail });
      // Don't audit without tenantId
      throw new Error('Invalid credentials');
    }

    // 3) Check user not deleted
    if (user.deletedAt) {
      logger.warn('Login attempt on deleted account', { userId: user.id, email: normalizedEmail });

      // Audit if we can find a tenant
      const tenantId = user.tenantUsers[0]?.tenant?.id;
      if (tenantId) {
        await writeAuditEvent({
          actorUserId: user.id,
          tenantId,
          type: 'ACCOUNT_DISABLED_LOGIN_ATTEMPT',
          metadata: { email: normalizedEmail, reason: 'account_deleted' },
          ipAddress,
        });
      }

      throw new Error('Invalid credentials');
    }

    // 4) Check user active status
    const userActive = user.isActive === true ||
      (user.status && user.status.toLowerCase() === 'active');

    if (!userActive) {
      logger.warn('Login attempt on inactive account', { userId: user.id });

      const tenantId = user.tenantUsers[0]?.tenant?.id;
      if (tenantId) {
        await writeAuditEvent({
          actorUserId: user.id,
          tenantId,
          type: 'ACCOUNT_DISABLED_LOGIN_ATTEMPT',
          metadata: { email: normalizedEmail, reason: 'account_inactive' },
          ipAddress,
        });
      }

      throw new Error('Invalid credentials');
    }

    // 5) Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      logger.warn('Login failed - invalid password', { userId: user.id });

      const tenantId = user.tenantUsers[0]?.tenant?.id;
      if (tenantId) {
        await writeAuditEvent({
          actorUserId: user.id,
          tenantId,
          type: 'USER_LOGIN_FAILED',
          metadata: { email: normalizedEmail, reason: 'invalid_password' },
          ipAddress,
        });
      }

      throw new Error('Invalid credentials');
    }

    // 6) Get active tenant memberships
    const tenantMemberships = getActiveTenantMemberships(user);

    if (tenantMemberships.length === 0) {
      logger.warn('Login failed - no active tenants', { userId: user.id });
      throw new Error('No active tenant membership found');
    }

    // 7) Select primary tenant (first active membership)
    const primaryTenant = tenantMemberships[0];

    // 8) Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      tenantId: primaryTenant.tenantId,
      role: primaryTenant.role,
    });
    const refreshToken = generateRefreshToken(user.id);

    // 9) Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // 10) Audit event
    await writeAuditEvent({
      actorUserId: user.id,
      tenantId: primaryTenant.tenantId,
      type: 'USER_LOGIN',
      metadata: {
        email: normalizedEmail,
        tenantId: primaryTenant.tenantId,
        role: primaryTenant.role,
      },
      ipAddress,
    });

    logger.info('User logged in', {
      userId: user.id,
      email: user.email,
      tenantId: primaryTenant.tenantId,
      role: primaryTenant.role,
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_EXPIRES_SECONDS,
      user: buildUserInfo(user),
      tenants: tenantMemberships,
      activeTenant: primaryTenant,
    };
  }

  /**
   * Refresh access token using refresh token.
   */
  async refresh(data: RefreshRequest): Promise<RefreshResponse> {
    const { refreshToken } = data;

    // 1) Verify refresh token
    const payload = verifyRefreshToken(refreshToken);

    // 2) Get user with tenant memberships
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        tenantUsers: {
          where: { deletedAt: null },
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
                isActive: true,
                status: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    }) as UserWithTenants | null;

    if (!user) {
      throw new Error('User not found');
    }

    // 3) Check user is active
    const userActive = user.isActive === true ||
      (user.status && user.status.toLowerCase() === 'active');

    if (!userActive || user.deletedAt) {
      throw new Error('User account is inactive');
    }

    // 4) Get active tenant memberships
    const tenantMemberships = getActiveTenantMemberships(user);

    if (tenantMemberships.length === 0) {
      throw new Error('No active tenant membership');
    }

    const primaryTenant = tenantMemberships[0];

    // 5) Generate new tokens
    const newAccessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      tenantId: primaryTenant.tenantId,
      role: primaryTenant.role,
    });
    const newRefreshToken = generateRefreshToken(user.id);

    logger.debug('Token refreshed', { userId: user.id });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_EXPIRES_SECONDS,
    };
  }

  /**
   * Get current user info with tenant memberships.
   */
  async me(userId: string, currentTenantId?: string): Promise<MeResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenantUsers: {
          where: { deletedAt: null },
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
                isActive: true,
                status: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    }) as UserWithTenants | null;

    if (!user) {
      throw new Error('User not found');
    }

    const tenantMemberships = getActiveTenantMemberships(user);

    // Find current active tenant if provided
    let activeTenant: TenantMembership | null = null;
    if (currentTenantId) {
      activeTenant = tenantMemberships.find(t => t.tenantId === currentTenantId) || null;
    }
    if (!activeTenant && tenantMemberships.length > 0) {
      activeTenant = tenantMemberships[0];
    }

    return {
      user: buildUserInfo(user),
      tenants: tenantMemberships,
      activeTenant,
    };
  }

  /**
   * List user's tenant memberships.
   */
  async listTenants(userId: string): Promise<TenantMembership[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenantUsers: {
          where: { deletedAt: null },
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
                isActive: true,
                status: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    }) as UserWithTenants | null;

    if (!user) {
      throw new Error('User not found');
    }

    return getActiveTenantMemberships(user);
  }

  /**
   * Switch to a different tenant.
   * Issues new JWT with the new tenant context.
   */
  async switchTenant(
    userId: string,
    data: SwitchTenantRequest,
    ipAddress?: string
  ): Promise<SwitchTenantResponse> {
    const { tenantId: targetTenantId } = data;

    // 1) Get user with memberships
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenantUsers: {
          where: { deletedAt: null },
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
                isActive: true,
                status: true,
              },
            },
          },
        },
      },
    }) as UserWithTenants | null;

    if (!user) {
      throw new Error('User not found');
    }

    // 2) Find the target tenant membership
    const tenantMemberships = getActiveTenantMemberships(user);
    const targetMembership = tenantMemberships.find(
      m => m.tenantId === targetTenantId
    );

    if (!targetMembership) {
      throw new Error('Access denied - not a member of target tenant');
    }

    // 3) Generate new tokens with target tenant context
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      tenantId: targetMembership.tenantId,
      role: targetMembership.role,
    });
    const refreshToken = generateRefreshToken(user.id);

    // 4) Audit event
    await writeAuditEvent({
      actorUserId: user.id,
      tenantId: targetMembership.tenantId,
      type: 'TENANT_SWITCHED',
      metadata: {
        previousTenantId: null, // Could be passed in for tracking
        newTenantId: targetMembership.tenantId,
        role: targetMembership.role,
      },
      ipAddress,
    });

    logger.info('Tenant switched', {
      userId: user.id,
      tenantId: targetMembership.tenantId,
      role: targetMembership.role,
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_EXPIRES_SECONDS,
      activeTenant: targetMembership,
    };
  }

  /**
   * Logout - emit audit event.
   * JWT is stateless, so actual token invalidation is client-side.
   */
  async logout(userId: string, tenantId: string, ipAddress?: string): Promise<void> {
    await writeAuditEvent({
      actorUserId: userId,
      tenantId,
      type: 'USER_LOGOUT',
      metadata: {},
      ipAddress,
    });

    logger.info('User logged out', { userId, tenantId });
  }
}

// ============================================
// EXPORTS
// ============================================

export default new AuthService();

// Re-export token functions for middleware
export { verifyAccessToken, verifyRefreshToken };
