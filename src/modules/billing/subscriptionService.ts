/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * Subscription Service - Handles subscription lifecycle and billing provider sync.
 */

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import { writeAuditEvent } from '../security/auditService.js';

// ============================================
// TYPES
// ============================================

export interface Subscription {
  id: string;
  tenantId: string;
  productId: string;
  planCode: string;
  billingCycle: 'monthly' | 'yearly';
  status: 'ACTIVE' | 'CANCELLED' | 'SUSPENDED' | 'PENDING' | 'EXPIRED';
  externalSubscriptionId: string | null;
  quantity: number;
  price: number;
  currency: string;
  startedAt: Date;
  renewsAt: Date | null;
  cancelAt: Date | null;
  cancelledAt: Date | null;
  addOns: string[] | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateSubscriptionFromProviderInput {
  tenantId: string;
  planCode: string;
  billingCycle: 'monthly' | 'yearly';
  externalSubscriptionId: string;
  addOns?: string[];
  quantity?: number;
  price?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  type: string;
  price: number;
  billingInterval: string;
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Create a subscription from a billing provider event (e.g., Stripe webhook).
 * 
 * Idempotent: Uses externalSubscriptionId to prevent duplicates.
 * 
 * @example
 * const subscription = await createSubscriptionFromProviderEvent({
 *   tenantId: tenant.id,
 *   planCode: 'cloudpod-starter',
 *   billingCycle: 'monthly',
 *   externalSubscriptionId: 'sub_xxx',
 * });
 */
export async function createSubscriptionFromProviderEvent(
  input: CreateSubscriptionFromProviderInput
): Promise<Subscription> {
  const {
    tenantId,
    planCode,
    billingCycle,
    externalSubscriptionId,
    addOns,
    quantity = 1,
    price,
    currency = 'USD',
    metadata,
  } = input;

  // Idempotency check: avoid duplicates if webhook retries
  const existing = await prisma.subscription.findFirst({
    where: { externalSubscriptionId },
  });

  if (existing) {
    logger.info('Subscription already exists for external ID', {
      externalSubscriptionId,
      subscriptionId: existing.id,
    });
    return existing as Subscription;
  }

  // Get product by plan code
  const product = await prisma.product.findFirst({
    where: { code: planCode },
  });

  if (!product) {
    throw new Error(`Unknown planCode: ${planCode}`);
  }

  // Calculate renewal date
  const now = new Date();
  const renewsAt = new Date(now);
  if (billingCycle === 'yearly') {
    renewsAt.setFullYear(renewsAt.getFullYear() + 1);
  } else {
    renewsAt.setMonth(renewsAt.getMonth() + 1);
  }

  // Create subscription
  const subscription = await prisma.subscription.create({
    data: {
      tenantId,
      productId: product.id,
      planCode,
      billingCycle,
      status: 'ACTIVE',
      externalSubscriptionId,
      quantity,
      price: price ?? product.price,
      currency,
      startedAt: now,
      renewsAt,
      addOns: addOns ?? [],
      metadata: metadata ?? {},
      createdAt: now,
      updatedAt: now,
    },
  });

  logger.info('Subscription created from provider event', {
    subscriptionId: subscription.id,
    tenantId,
    planCode,
    externalSubscriptionId,
  });

  await writeAuditEvent({
    actorUserId: null, // System action
    tenantId,
    type: 'SUBSCRIPTION_SYNCED_FROM_PROVIDER',
    metadata: {
      subscriptionId: subscription.id,
      externalSubscriptionId,
      planCode,
      billingCycle,
    },
  });

  return subscription as Subscription;
}

/**
 * Get a subscription by ID.
 */
export async function getSubscriptionById(
  subscriptionId: string
): Promise<Subscription | null> {
  const subscription = await prisma.subscription.findFirst({
    where: {
      id: subscriptionId,
      deletedAt: null,
    },
  });

  return subscription as Subscription | null;
}

/**
 * Get all subscriptions for a tenant.
 */
export async function getTenantSubscriptions(
  tenantId: string,
  options: { includeInactive?: boolean } = {}
): Promise<Subscription[]> {
  const where: Record<string, unknown> = {
    tenantId,
    deletedAt: null,
  };

  if (!options.includeInactive) {
    where.status = 'ACTIVE';
  }

  const subscriptions = await prisma.subscription.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return subscriptions as Subscription[];
}

/**
 * Get subscription by external provider ID (e.g., Stripe subscription ID).
 */
export async function getSubscriptionByExternalId(
  externalSubscriptionId: string
): Promise<Subscription | null> {
  const subscription = await prisma.subscription.findFirst({
    where: { externalSubscriptionId },
  });

  return subscription as Subscription | null;
}

/**
 * Update subscription status.
 */
export async function updateSubscriptionStatus(
  subscriptionId: string,
  status: Subscription['status'],
  actorUserId: string | null = null
): Promise<Subscription> {
  const subscription = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status,
      updatedAt: new Date(),
      ...(status === 'CANCELLED' ? { cancelledAt: new Date() } : {}),
    },
  });

  const eventType = status === 'CANCELLED'
    ? 'SUBSCRIPTION_CANCELLED'
    : 'SUBSCRIPTION_UPDATED';

  await writeAuditEvent({
    actorUserId,
    tenantId: subscription.tenantId,
    type: eventType,
    metadata: {
      subscriptionId,
      newStatus: status,
    },
  });

  logger.info('Subscription status updated', {
    subscriptionId,
    status,
  });

  return subscription as Subscription;
}

/**
 * Cancel a subscription at period end.
 */
export async function cancelSubscriptionAtPeriodEnd(
  subscriptionId: string,
  actorUserId: string
): Promise<Subscription> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    throw new Error(`Subscription not found: ${subscriptionId}`);
  }

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      cancelAt: subscription.renewsAt, // Cancel at next renewal
      updatedAt: new Date(),
    },
  });

  await writeAuditEvent({
    actorUserId,
    tenantId: subscription.tenantId,
    type: 'SUBSCRIPTION_CANCELLED',
    metadata: {
      subscriptionId,
      cancelAt: subscription.renewsAt,
      immediate: false,
    },
  });

  logger.info('Subscription scheduled for cancellation', {
    subscriptionId,
    cancelAt: subscription.renewsAt,
  });

  return updated as Subscription;
}

/**
 * Upgrade or downgrade a subscription to a new plan.
 */
export async function changeSubscriptionPlan(
  subscriptionId: string,
  newPlanCode: string,
  actorUserId: string
): Promise<Subscription> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    throw new Error(`Subscription not found: ${subscriptionId}`);
  }

  const newProduct = await prisma.product.findFirst({
    where: { code: newPlanCode },
  });

  if (!newProduct) {
    throw new Error(`Unknown plan code: ${newPlanCode}`);
  }

  const oldPlanCode = subscription.planCode;

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      planCode: newPlanCode,
      productId: newProduct.id,
      price: newProduct.price,
      updatedAt: new Date(),
    },
  });

  const isUpgrade = newProduct.price > subscription.price;
  
  await writeAuditEvent({
    actorUserId,
    tenantId: subscription.tenantId,
    type: isUpgrade ? 'SUBSCRIPTION_UPGRADE_REQUESTED' : 'SUBSCRIPTION_DOWNGRADE_REQUESTED',
    metadata: {
      subscriptionId,
      oldPlanCode,
      newPlanCode,
      oldPrice: subscription.price,
      newPrice: newProduct.price,
    },
  });

  logger.info('Subscription plan changed', {
    subscriptionId,
    oldPlanCode,
    newPlanCode,
    isUpgrade,
  });

  return updated as Subscription;
}

/**
 * Renew a subscription.
 */
export async function renewSubscription(
  subscriptionId: string
): Promise<Subscription> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    throw new Error(`Subscription not found: ${subscriptionId}`);
  }

  const now = new Date();
  const newRenewalDate = new Date(now);
  
  if (subscription.billingCycle === 'yearly') {
    newRenewalDate.setFullYear(newRenewalDate.getFullYear() + 1);
  } else {
    newRenewalDate.setMonth(newRenewalDate.getMonth() + 1);
  }

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      renewsAt: newRenewalDate,
      status: 'ACTIVE',
      cancelAt: null,
      updatedAt: now,
    },
  });

  await writeAuditEvent({
    actorUserId: null,
    tenantId: subscription.tenantId,
    type: 'SUBSCRIPTION_RENEWED',
    metadata: {
      subscriptionId,
      renewsAt: newRenewalDate,
    },
  });

  logger.info('Subscription renewed', {
    subscriptionId,
    newRenewalDate,
  });

  return updated as Subscription;
}

/**
 * Get product by plan code.
 */
export async function getProductByCode(planCode: string): Promise<Product | null> {
  const product = await prisma.product.findFirst({
    where: { code: planCode },
  });

  return product as Product | null;
}

export default {
  createSubscriptionFromProviderEvent,
  getSubscriptionById,
  getTenantSubscriptions,
  getSubscriptionByExternalId,
  updateSubscriptionStatus,
  cancelSubscriptionAtPeriodEnd,
  changeSubscriptionPlan,
  renewSubscription,
  getProductByCode,
};
