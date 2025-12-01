/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * Tenant Service - Handles customer account (tenant) management.
 */

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import { writeAuditEvent } from '../security/auditService.js';
import type { User } from '../users/userService.js';

// ============================================
// TYPES
// ============================================

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  billingEmail: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'PENDING';
  address: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateTenantInput {
  name: string;
  billingEmail?: string;
  address?: string;
  status?: Tenant['status'];
}

export interface TenantWithOwner extends Tenant {
  owner: User | null;
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Get or create a tenant for a user.
 * If the user already owns a tenant, return it.
 * Otherwise, create a new tenant and make the user the owner.
 * 
 * Idempotent: Safe to call multiple times.
 * 
 * @example
 * const tenant = await getOrCreateTenantForUser(user);
 */
export async function getOrCreateTenantForUser(user: User): Promise<Tenant> {
  // Check if user already owns a tenant
  const existingMembership = await prisma.tenantUser.findFirst({
    where: {
      userId: user.id,
      role: 'OWNER',
      deletedAt: null,
    },
    include: {
      tenant: true,
    },
  });

  if (existingMembership?.tenant) {
    logger.debug('Found existing tenant for user', {
      userId: user.id,
      tenantId: existingMembership.tenant.id,
    });
    return existingMembership.tenant as Tenant;
  }

  // Create new tenant
  const tenantName = user.name || extractCompanyName(user.email);
  const slug = generateSlug(tenantName);
  const uniqueSlug = await ensureUniqueSlug(slug);

  const tenant = await prisma.tenant.create({
    data: {
      name: tenantName,
      slug: uniqueSlug,
      domain: uniqueSlug,  // domain is synced with slug
      billingEmail: user.email,
      status: 'ACTIVE',
    },
  });

  // Make user the owner
  await prisma.tenantUser.create({
    data: {
      userId: user.id,
      tenantId: tenant.id,
      role: 'OWNER',
      createdAt: new Date(),
    },
  });

  logger.info('Created new tenant for user', {
    userId: user.id,
    tenantId: tenant.id,
    tenantName: tenant.name,
  });

  await writeAuditEvent({
    actorUserId: user.id,
    tenantId: tenant.id,
    type: 'TENANT_CREATED',
    metadata: {
      tenantId: tenant.id,
      tenantName: tenant.name,
      ownerUserId: user.id,
      source: 'auto_created',
    },
  });

  return tenant as Tenant;
}

/**
 * Get a tenant by ID.
 */
export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  const tenant = await prisma.tenant.findFirst({
    where: {
      id: tenantId,
      deletedAt: null,
    },
  });

  return tenant as Tenant | null;
}

/**
 * Get a tenant by slug.
 */
export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const tenant = await prisma.tenant.findFirst({
    where: {
      slug,
      deletedAt: null,
    },
  });

  return tenant as Tenant | null;
}

/**
 * Create a new tenant manually (e.g., from admin panel).
 */
export async function createTenant(
  input: CreateTenantInput,
  actorUserId: string
): Promise<Tenant> {
  const slug = generateSlug(input.name);
  const uniqueSlug = await ensureUniqueSlug(slug);

  const tenant = await prisma.tenant.create({
    data: {
      name: input.name,
      slug: uniqueSlug,
      domain: uniqueSlug,  // domain is synced with slug
      billingEmail: input.billingEmail ?? null,
      address: input.address ?? null,
      status: input.status ?? 'ACTIVE',
    },
  });

  await writeAuditEvent({
    actorUserId,
    tenantId: tenant.id,
    type: 'TENANT_CREATED',
    metadata: {
      tenantId: tenant.id,
      tenantName: tenant.name,
      source: 'manual',
    },
  });

  logger.info('Tenant created manually', {
    tenantId: tenant.id,
    actorUserId,
  });

  return tenant as Tenant;
}

/**
 * Update tenant details.
 */
export async function updateTenant(
  tenantId: string,
  data: Partial<Pick<Tenant, 'name' | 'billingEmail' | 'address' | 'status'>>,
  actorUserId: string
): Promise<Tenant> {
  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });

  await writeAuditEvent({
    actorUserId,
    tenantId,
    type: 'TENANT_UPDATED',
    metadata: {
      changes: Object.keys(data),
    },
  });

  return tenant as Tenant;
}

/**
 * Suspend a tenant.
 */
export async function suspendTenant(
  tenantId: string,
  reason: string,
  actorUserId: string
): Promise<Tenant> {
  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      status: 'SUSPENDED',
      updatedAt: new Date(),
    },
  });

  await writeAuditEvent({
    actorUserId,
    tenantId,
    type: 'TENANT_SUSPENDED',
    severity: 'warning',
    metadata: {
      reason,
    },
  });

  logger.warn('Tenant suspended', {
    tenantId,
    reason,
    actorUserId,
  });

  return tenant as Tenant;
}

/**
 * Reactivate a suspended tenant.
 */
export async function reactivateTenant(
  tenantId: string,
  actorUserId: string
): Promise<Tenant> {
  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      status: 'ACTIVE',
      updatedAt: new Date(),
    },
  });

  await writeAuditEvent({
    actorUserId,
    tenantId,
    type: 'TENANT_REACTIVATED',
    metadata: {},
  });

  logger.info('Tenant reactivated', {
    tenantId,
    actorUserId,
  });

  return tenant as Tenant;
}

// ============================================
// TENANT USERS
// ============================================

/**
 * Add a user to a tenant with a specific role.
 */
export async function addUserToTenant(
  tenantId: string,
  userId: string,
  role: string,
  actorUserId: string
): Promise<void> {
  // Check if already a member
  const existing = await prisma.tenantUser.findFirst({
    where: {
      tenantId,
      userId,
      deletedAt: null,
    },
  });

  if (existing) {
    logger.debug('User already member of tenant', { tenantId, userId });
    return;
  }

  await prisma.tenantUser.create({
    data: {
      tenantId,
      userId,
      role,
      createdAt: new Date(),
    },
  });

  await writeAuditEvent({
    actorUserId,
    tenantId,
    type: 'USER_CREATED', // Role assigned
    metadata: {
      addedUserId: userId,
      role,
    },
  });

  logger.info('User added to tenant', {
    tenantId,
    userId,
    role,
    actorUserId,
  });
}

/**
 * Remove a user from a tenant.
 */
export async function removeUserFromTenant(
  tenantId: string,
  userId: string,
  actorUserId: string
): Promise<void> {
  await prisma.tenantUser.updateMany({
    where: {
      tenantId,
      userId,
      deletedAt: null,
    },
    data: {
      deletedAt: new Date(),
    },
  });

  await writeAuditEvent({
    actorUserId,
    tenantId,
    type: 'USER_DELETED',
    metadata: {
      removedUserId: userId,
    },
  });

  logger.info('User removed from tenant', {
    tenantId,
    userId,
    actorUserId,
  });
}

/**
 * Get all users in a tenant.
 */
export async function getTenantUsers(tenantId: string) {
  const memberships = await prisma.tenantUser.findMany({
    where: {
      tenantId,
      deletedAt: null,
    },
    include: {
      user: true,
    },
  });

  return memberships.map(m => ({
    user: m.user,
    role: m.role,
    joinedAt: m.createdAt,
  }));
}

/**
 * Get the owner of a tenant.
 */
export async function getTenantOwner(tenantId: string): Promise<User | null> {
  const ownership = await prisma.tenantUser.findFirst({
    where: {
      tenantId,
      role: 'OWNER',
      deletedAt: null,
    },
    include: {
      user: true,
    },
  });

  return (ownership?.user as User) ?? null;
}

// ============================================
// HELPERS
// ============================================

/**
 * Generate a URL-safe slug from a name.
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

/**
 * Ensure the slug is unique by appending a number if needed.
 */
async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.tenant.findFirst({
      where: { slug },
    });

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;

    if (counter > 100) {
      // Fallback to random suffix
      slug = `${baseSlug}-${Date.now()}`;
      return slug;
    }
  }
}

/**
 * Extract a company name from an email domain.
 */
function extractCompanyName(email: string): string {
  const domain = email.split('@')[1];
  if (!domain) return 'My Company';

  // Handle common email providers
  const commonProviders = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];
  if (commonProviders.includes(domain.toLowerCase())) {
    // Use the email local part instead
    const localPart = email.split('@')[0];
    return localPart
      .split(/[._-]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ') + "'s Account";
  }

  // Extract company name from domain
  const domainParts = domain.split('.');
  const companyPart = domainParts[0];
  return companyPart.charAt(0).toUpperCase() + companyPart.slice(1);
}

export default {
  getOrCreateTenantForUser,
  getTenantById,
  getTenantBySlug,
  createTenant,
  updateTenant,
  suspendTenant,
  reactivateTenant,
  addUserToTenant,
  removeUserFromTenant,
  getTenantUsers,
  getTenantOwner,
};
