/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * User Service - Handles user account management.
 */

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import { writeAuditEvent } from '../security/auditService.js';
import crypto from 'crypto';

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
      // Generate a random password that must be reset
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
// HELPERS
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

/**
 * Hash a password using bcrypt-compatible approach.
 * In production, use bcrypt or argon2.
 */
async function hashPassword(password: string): Promise<string> {
  // This is a placeholder - in production use bcrypt
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
    .toString('hex');
  return `${salt}:${hash}`;
}

export default {
  getOrCreateUserForEmail,
  getUserById,
  getUserByEmail,
  updateUser,
  recordUserLogin,
  deleteUser,
  getUserTenants,
  userBelongsToTenant,
  getUserTenantRole,
};
