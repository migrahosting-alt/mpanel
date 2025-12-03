/**
 * BILLING SUBSCRIPTIONS Service
 * Recurring services with CloudPod integration
 */

import prisma from '../../config/database.js';
import logger from '../../config/logger.js';
import {
  SubscriptionStatus,
  type Subscription,
  type CreateSubscriptionRequest,
  type UpdateSubscriptionRequest,
  type CancelSubscriptionRequest,
  type RecordUsageRequest,
} from './billing-subscriptions.types.js';

export async function listSubscriptions(filters: {
  status?: SubscriptionStatus;
  tenantId?: string;
  productId?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: Subscription[]; total: number }> {
  const { status, tenantId, productId, page = 1, pageSize = 50 } = filters;

  const where: any = {};
  if (status) where.status = status;
  if (tenantId) where.tenantId = tenantId;
  if (productId) where.productId = productId;

  try {
    // @ts-ignore
    const [items, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.subscription.count({ where }),
    ]);

    return { items, total };
  } catch (error) {
    logger.error('Failed to list subscriptions', { error });
    return { items: [], total: 0 };
  }
}

export async function getSubscriptionById(id: string): Promise<Subscription | null> {
  try {
    // @ts-ignore
    const subscription = await prisma.subscription.findFirst({
      where: { id },
    });
    return subscription;
  } catch {
    return null;
  }
}

export async function createSubscription(
  data: CreateSubscriptionRequest,
  actorId: string
): Promise<{ subscription: Subscription; jobId: string }> {
  const {
    tenantId,
    productId,
    planCode,
    quantity = 1,
    billingPeriod,
    autoRenew = true,
    startDate,
    trialDays,
    metadata,
    cloudPodConfig,
  } = data;

  const now = new Date();
  const actualStartDate = startDate || now;
  const trialEndsAt = trialDays ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000) : null;

  // Create subscription
  // @ts-ignore
  const subscription = await prisma.subscription.create({
    data: {
      tenantId,
      productId,
      externalRef: null, // Will be set after provisioning
      planCode,
      status: 'PENDING_ACTIVATION',
      startDate: actualStartDate,
      currentPeriodStart: actualStartDate,
      currentPeriodEnd: new Date(actualStartDate.getTime() + 30 * 24 * 60 * 60 * 1000), // +30 days
      billingPeriod,
      quantity,
      currency: 'USD',
      pricePerUnit: 0, // Will be resolved from product
      discountPercent: 0,
      discountAmount: 0,
      nextBillingDate: trialEndsAt || new Date(actualStartDate.getTime() + 30 * 24 * 60 * 60 * 1000),
      cancelAt: null,
      cancelledAt: null,
      autoRenew,
      trialEndsAt,
      metadata: metadata || null,
      createdById: actorId,
      updatedById: null,
    },
  });

  // Enqueue provisioning job
  const job = await prisma.job.create({
    data: {
      tenantId,
      type: 'subscription.activate',
      status: 'pending',
      payload: {
        subscriptionId: subscription.id,
        productId,
        cloudPodConfig,
      },
      createdBy: actorId,
    },
  });

  logger.info('Subscription created', { subscriptionId: subscription.id, jobId: job.id });

  return { subscription, jobId: job.id };
}

export async function updateSubscription(
  id: string,
  data: UpdateSubscriptionRequest,
  actorId: string
): Promise<Subscription> {
  const subscription = await getSubscriptionById(id);
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  // @ts-ignore
  const updated = await prisma.subscription.update({
    where: { id },
    data: {
      ...data,
      updatedById: actorId,
    },
  });

  logger.info('Subscription updated', { subscriptionId: id });

  return updated;
}

export async function cancelSubscription(
  id: string,
  data: CancelSubscriptionRequest,
  actorId: string
): Promise<Subscription> {
  const subscription = await getSubscriptionById(id);
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  const { cancelAt, reason } = data;

  let cancelDate: Date;
  let newStatus: SubscriptionStatus = subscription.status;

  if (cancelAt === 'IMMEDIATE') {
    cancelDate = new Date();
    newStatus = SubscriptionStatus.CANCELLED;
  } else {
    // END_OF_TERM
    cancelDate = subscription.currentPeriodEnd || new Date();
  }

  // @ts-ignore
  const updated = await prisma.subscription.update({
    where: { id },
    data: {
      cancelAt: cancelDate,
      cancelledAt: cancelAt === 'IMMEDIATE' ? new Date() : null,
      status: newStatus,
      metadata: {
        ...(subscription.metadata || {}),
        cancellationReason: reason,
      },
      updatedById: actorId,
    },
  });

  logger.info('Subscription cancelled', { subscriptionId: id, cancelAt });

  return updated;
}

export async function suspendSubscription(id: string, actorId: string): Promise<Subscription> {
  // @ts-ignore
  const updated = await prisma.subscription.update({
    where: { id },
    data: {
      status: 'SUSPENDED',
      updatedById: actorId,
    },
  });

  logger.info('Subscription suspended', { subscriptionId: id });

  return updated;
}

export async function resumeSubscription(id: string, actorId: string): Promise<Subscription> {
  // @ts-ignore
  const updated = await prisma.subscription.update({
    where: { id },
    data: {
      status: 'ACTIVE',
      updatedById: actorId,
    },
  });

  logger.info('Subscription resumed', { subscriptionId: id });

  return updated;
}

export async function recordUsage(
  id: string,
  data: RecordUsageRequest,
  actorId: string
): Promise<any> {
  const subscription = await getSubscriptionById(id);
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  const { metricName, quantity, unitPrice = 0, timestamp, metadata } = data;

  // @ts-ignore
  const record = await prisma.usageRecord.create({
    data: {
      subscriptionId: id,
      metricName,
      quantity,
      unitPrice,
      total: quantity * unitPrice,
      recordedAt: timestamp || new Date(),
      billingPeriodStart: subscription.currentPeriodStart || new Date(),
      billingPeriodEnd: subscription.currentPeriodEnd || new Date(),
      metadata: metadata || null,
    },
  });

  logger.info('Usage recorded', { subscriptionId: id, metricName, quantity });

  return record;
}
