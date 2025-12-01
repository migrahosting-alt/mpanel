/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * User Service - Handles user account management.
 * 
 * P0.1 FIX (Enterprise Hardening):
 * - ALL tenant-facing queries MUST filter by tenantId via TenantUser join
 * - Uses bcrypt for password hashing (consistent with auth module)
 * - Audit logging for user listing/viewing
 * - No cross-tenant data leaks
 */

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import { writeAuditEvent } from '../security/auditService.js';
import * as bcrypt from 'bcrypt';
import crypto from 'crypto';

// ============================================
// CONSTANTS
// ============================================

/** Bcrypt rounds - matches auth.service.ts */
const BCRYPT_ROUNDS = 12;

// ============================================
// TYPES
// ============================================

export interface User {
  id: string;
  email: string;
  name: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';
  emailVerified: boolean;
  role: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
  deletedAt: Date | null;
}

export interface CreateUserInput {
  email: string;
  name?: string;
  password?: string;
  status?: User['status'];
  emailVerified?: boolean;
  source?: 'signup' | 'billing_webhook' | 'admin_invite' | 'import';
}

export interface TenantUserInfo extends User {
  tenantRole: string;
  joinedAt: Date;
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Get or create a user by email address.
 * This is the primary function for webhook flows where we need to ensure
 * a user exists before creating subscriptions.
 * 
 * Idempotent: Safe to call multiple times with the same email.
 * 
 * @example
 * const user = await getOrCreateUserForEmail('customer@example.com');
 */
export async function getOrCreateUserForEmail(
  email: string,
  options: Partial<CreateUserInput> = {}
): Promise<User> {
  const normalizedEmail = email.toLowerCase().trim();

  // Check for existing user first (idempotency)
  const existingUser = await prisma.user.findFirst({
    where: {
      email: normalizedEmail,
      deletedAt: null,
    },
  });

  if (existingUser) {
    logger.debug('Found existing user for email', {
      userId: existingUser.id,
      email: normalizedEmail,
    });
    return existingUser as User;
  }

  // Create new user
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: options.name ?? extractNameFromEmail(normalizedEmail),
      status: options.status ?? 'PENDING_VERIFICATION',
      emailVerified: options.emailVerified ?? false,
      // P0.4: Use bcrypt for password hashing (not PBKDF2)
      passwordHash: options.password
        ? await hashPassword(options.password)
        : await hashPassword(crypto.randomBytes(32).toString('hex')),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  logger.info('Created new user', {
    userId: user.id,
    email: normalizedEmail,
    source: options.source ?? 'unknown',
  });

  await writeAuditEvent({
    actorUserId: null, // System action
    tenantId: null,
    type: 'USER_CREATED',
    metadata: {
      userId: user.id,
      email: normalizedEmail,
      source: options.source ?? 'unknown',
    },
  });

  return user as User;
}

/**
 * Get a user by ID.
 */
export async function getUserById(userId: string): Promise<User | null> {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
    },
  });

  return user as User | null;
}

/**
 * Get a user by email.
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findFirst({
    where: {
      email: normalizedEmail,
      deletedAt: null,
    },
  });

  return user as User | null;
}

/**
 * Update user details.
 */
export async function updateUser(
  userId: string,
  data: Partial<Pick<User, 'name' | 'status' | 'emailVerified'>>,
  actorUserId?: string
): Promise<User> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });

  await writeAuditEvent({
    actorUserId: actorUserId ?? null,
    tenantId: null,
    type: 'USER_UPDATED',
    metadata: {
      userId,
      changes: Object.keys(data),
    },
  });

  return user as User;
}

/**
 * Record a user login.
 */
export async function recordUserLogin(
  userId: string,
  ipAddress?: string
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      lastLoginAt: new Date(),
    },
  });

  await writeAuditEvent({
    actorUserId: userId,
    tenantId: null,
    type: 'USER_LOGIN',
    ipAddress,
    metadata: { userId },
  });
}

/**
 * Soft delete a user.
 */
export async function deleteUser(
  userId: string,
  actorUserId: string
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      deletedAt: new Date(),
      status: 'INACTIVE',
    },
  });

  await writeAuditEvent({
    actorUserId,
    tenantId: null,
    type: 'USER_DELETED',
    metadata: { deletedUserId: userId },
  });

  logger.info('User soft deleted', { userId, actorUserId });
}

// ============================================
// TENANT MEMBERSHIP
// ============================================

/**
 * Get all tenants a user belongs to.
 */
export async function getUserTenants(userId: string) {
  const memberships = await prisma.tenantUser.findMany({
    where: {
      userId,
      deletedAt: null,
    },
    include: {
      tenant: true,
    },
  });

  return memberships.map(m => ({
    tenant: m.tenant,
    role: m.role,
    joinedAt: m.createdAt,
  }));
}

/**
 * Check if a user belongs to a specific tenant.
 */
export async function userBelongsToTenant(
  userId: string,
  tenantId: string
): Promise<boolean> {
  const membership = await prisma.tenantUser.findFirst({
    where: {
      userId,
      tenantId,
      deletedAt: null,
    },
  });

  return !!membership;
}

/**
 * Get user's role within a tenant.
 */
export async function getUserTenantRole(
  userId: string,
  tenantId: string
): Promise<string | null> {
  const membership = await prisma.tenantUser.findFirst({
    where: {
      userId,
      tenantId,
      deletedAt: null,
    },
  });

  return membership?.role ?? null;
}

// ============================================
// TENANT-SCOPED USER HELPERS (P0.1 FIX)
// ============================================

/**
 * List users within a specific tenant.
 * Uses TenantUser join table to ensure tenant isolation.
 * 
 * @param tenantId - The tenant to list users for
 * @param actorUserId - User performing the action (for audit)
 * @param options - Pagination and filter options
 */
export async function listUsersForTenant(
  tenantId: string,
  actorUserId: string,
  options: {
    page?: number;
    pageSize?: number;
    search?: string;
    role?: string;
  } = {}
): Promise<{ users: TenantUserInfo[]; total: number }> {
  const { page = 1, pageSize = 50, search, role } = options;
  const skip = (page - 1) * pageSize;

  // Build where clause for TenantUser join
  const where: any = {
    tenantId,
    deletedAt: null,
    user: {
      deletedAt: null,
    },
  };

  if (role) {
    where.role = role;
  }

  if (search) {
    where.user.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [memberships, total] = await Promise.all([
    prisma.tenantUser.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            status: true,
            emailVerified: true,
            role: true,
            createdAt: true,
            updatedAt: true,
            lastLoginAt: true,
            deletedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take: pageSize,
    }),
    prisma.tenantUser.count({ where }),
  ]);

  const users: TenantUserInfo[] = memberships.map(m => ({
    ...m.user,
    tenantRole: m.role,
    joinedAt: m.createdAt,
  })) as TenantUserInfo[];

  // Audit logging
  await writeAuditEvent({
    actorUserId,
    tenantId,
    type: 'TENANT_USERS_LISTED',
    metadata: {
      resultCount: users.length,
      total,
      page,
      search: search ?? null,
    },
  });

  logger.debug('Listed users for tenant', { tenantId, count: users.length, total });

  return { users, total };
}

/**
 * Get a specific user within a tenant context.
 * Verifies user belongs to tenant via TenantUser join.
 * Returns 404-style null if user not in tenant.
 * 
 * @param tenantId - The tenant context
 * @param userId - The user to retrieve
 * @param actorUserId - User performing the action (for audit)
 */
export async function getUserForTenant(
  tenantId: string,
  userId: string,
  actorUserId: string
): Promise<TenantUserInfo | null> {
  // Must be in TenantUser to be visible
  const membership = await prisma.tenantUser.findFirst({
    where: {
      tenantId,
      userId,
      deletedAt: null,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          emailVerified: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!membership || membership.user.deletedAt) {
    logger.warn('User not found in tenant context', { tenantId, userId });
    return null;
  }

  // Audit logging
  await writeAuditEvent({
    actorUserId,
    tenantId,
    type: 'TENANT_USER_VIEWED',
    metadata: {
      viewedUserId: userId,
      viewedUserEmail: membership.user.email,
    },
  });

  return {
    ...membership.user,
    tenantRole: membership.role,
    joinedAt: membership.createdAt,
  } as TenantUserInfo;
}

/**
 * Verify a user belongs to a tenant before allowing access.
 * Use this as a guard before any user-specific operation.
 */
export async function verifyUserInTenant(
  tenantId: string,
  userId: string
): Promise<boolean> {
  const membership = await prisma.tenantUser.findFirst({
    where: {
      tenantId,
      userId,
      deletedAt: null,
    },
  });

  return !!membership;
}

// ============================================
// PASSWORD HELPERS (P0.4 FIX - BCRYPT)
// ============================================

/**
 * Hash a password using bcrypt.
 * Consistent with auth.service.ts (12 rounds).
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a hash.
 * Supports both bcrypt and legacy PBKDF2 hashes with auto-migration.
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  // Check if it's a bcrypt hash (starts with $2a$, $2b$, or $2y$)
  if (hash.startsWith('$2')) {
    return bcrypt.compare(password, hash);
  }

  // Legacy PBKDF2 format: "salt:hash"
  if (hash.includes(':')) {
    const [salt, storedHash] = hash.split(':');
    const computedHash = crypto
      .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
      .toString('hex');
    return computedHash === storedHash;
  }

  return false;
}

/**
 * Verify password with automatic migration to bcrypt.
 * If legacy hash is valid, updates to bcrypt.
 */
export async function verifyPasswordWithMigration(
  userId: string,
  password: string,
  currentHash: string
): Promise<boolean> {
  // Check if bcrypt hash
  if (currentHash.startsWith('$2')) {
    return bcrypt.compare(password, currentHash);
  }

  // Legacy PBKDF2 check
  const isValid = await verifyPassword(password, currentHash);

  if (isValid) {
    // Migrate to bcrypt
    const newHash = await hashPassword(password);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    logger.info('Migrated user password hash to bcrypt', { userId });

    await writeAuditEvent({
      actorUserId: userId,
      tenantId: null,
      type: 'PASSWORD_HASH_MIGRATED',
      metadata: { userId, from: 'pbkdf2', to: 'bcrypt' },
    });
  }

  return isValid;
}

// ============================================
// GENERAL HELPERS
// ============================================

/**
 * Extract a display name from an email address.
 */
function extractNameFromEmail(email: string): string {
  const localPart = email.split('@')[0];
  // Convert "john.doe" or "john_doe" to "John Doe"
  return localPart
    .split(/[._-]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export default {
  // Core functions
  getOrCreateUserForEmail,
  getUserById,
  getUserByEmail,
  updateUser,
  recordUserLogin,
  deleteUser,
  // Tenant membership
  getUserTenants,
  userBelongsToTenant,
  getUserTenantRole,
  // P0.1: Tenant-scoped user access
  listUsersForTenant,
  getUserForTenant,
  verifyUserInTenant,
  // P0.4: Password helpers (bcrypt)
  hashPassword,
  verifyPassword,
  verifyPasswordWithMigration,
};
