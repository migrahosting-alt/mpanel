/**
 * Subscription Service - Enterprise-grade Subscription Lifecycle Management
 * 
 * Aligned with:
 * - Prisma schema (Subscription, Order, Product, Price)
 * - Stripe webhook flow
 * - CloudPods provisioning pipeline
 * - Multi-tenant isolation
 * - Audit logging
 * 
 * This is the billing source of truth for CloudPods.
 * 
 * Key methods:
 * - createSubscriptionFromOrder: Create subscription after order is PAID
 * - syncSubscriptionFromWebhook: Handle Stripe webhook events
 * - activateSubscription: Activate subscription and trigger provisioning
 * - cancelSubscription: Cancel immediately or at period end
 * - scheduleCancellation: Schedule future cancellation
 * - updateBillingCycle: Change billing interval
 * - upgradePlan: Upgrade to higher tier
 * - downgradePlan: Downgrade to lower tier
 */

import { prisma } from '../../config/database.js';
import { Prisma } from '@prisma/client';
import { writeAuditEvent } from '../security/auditService.js';
import { enqueueCreateCloudPodJob } from '../provisioning/queue.js';
import logger from '../../config/logger.js';
import type {
  CreateSubscriptionFromOrderInput,
  SyncSubscriptionFromWebhookInput,
  ActivateSubscriptionInput,
  CancelSubscriptionInput,
  ScheduleCancellationInput,
  UpdateBillingCycleInput,
  UpgradePlanInput,
  DowngradePlanInput,
  ListSubscriptionsOptions,
  SubscriptionWithRelations,
  SubscriptionsListResponse,
  SubscriptionAddOns,
  BillingCycle,
} from './billing.types.js';
import {
  SUBSCRIPTION_STATUSES,
  BILLING_CYCLES,
  STRIPE_EVENTS,
} from './billing.types.js';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Standard includes for subscription queries.
 */
const subscriptionIncludes = {
  customer: {
    select: {
      id: true,
      email: true,
      fullName: true,
    },
  },
};

/**
 * Build subscription response with proper typing.
 */
function buildSubscriptionResponse(subscription: any): SubscriptionWithRelations {
  return {
    id: subscription.id,
    tenantId: subscription.tenantId,
    customerId: subscription.customerId,
    priceId: subscription.priceId,
    orderId: subscription.orderId,
    productId: subscription.productId,
    productCode: subscription.productCode,
    planCode: subscription.planCode,
    billingCycle: subscription.billingCycle,
    status: subscription.status,
    startedAt: subscription.startedAt,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    renewsAt: subscription.renewsAt,
    cancelAt: subscription.cancelAt,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    cancelledAt: subscription.cancelledAt,
    stripeSubscriptionId: subscription.stripeSubscriptionId,
    externalSubscriptionId: subscription.externalSubscriptionId,
    quantity: subscription.quantity,
    price: subscription.price ? Number(subscription.price) : null,
    currency: subscription.currency,
    addOns: subscription.addOns as SubscriptionAddOns | null,
    metadata: subscription.metadata as Record<string, unknown> | null,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
    customer: subscription.customer ?? null,
    product: subscription.product ?? null,
  };
}

/**
 * Calculate period end based on billing cycle.
 */
function calculatePeriodEnd(startDate: Date, billingCycle: BillingCycle): Date {
  const periodEnd = new Date(startDate);
  
  switch (billingCycle) {
    case BILLING_CYCLES.YEARLY:
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      break;
    case BILLING_CYCLES.QUARTERLY:
      periodEnd.setMonth(periodEnd.getMonth() + 3);
      break;
    case BILLING_CYCLES.MONTHLY:
    default:
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      break;
  }
  
  return periodEnd;
}

/**
 * Check if product is a hosting product that needs CloudPod provisioning.
 */
function isHostingProduct(productCode: string | null): boolean {
  if (!productCode) return false;
  const code = productCode.toLowerCase();
  return (
    code.includes('cloudpod') ||
    code.includes('hosting') ||
    code.includes('wordpress') ||
    code.includes('vps')
  );
}

// ============================================
// SUBSCRIPTION SERVICE CLASS
// ============================================

export class SubscriptionService {
  // ============================================
  // CORE METHODS
  // ============================================

  /**
   * Create subscription from a paid order.
   * This is called after order status becomes PAID.
   * 
   * Flow:
   * 1. Validate order and product
   * 2. Create subscription in INACTIVE state
   * 3. Emit SUBSCRIPTION_CREATED audit event
   * 
   * Note: Activation and provisioning are separate steps.
   */
  async createSubscriptionFromOrder(
    input: CreateSubscriptionFromOrderInput,
    actorUserId: string | null = null
  ): Promise<SubscriptionWithRelations> {
    const {
      order,
      productCode,
      billingCycle,
      externalSubscriptionId,
      domain,
      addOns,
    } = input;

    logger.info('Creating subscription from order', {
      orderId: order.id,
      tenantId: order.tenantId,
      productCode,
      billingCycle,
    });

    // Check for existing subscription for this order (idempotency)
    const existing = await prisma.subscription.findUnique({
      where: { orderId: order.id },
      include: subscriptionIncludes,
    });

    if (existing) {
      logger.info('Subscription already exists for order', {
        orderId: order.id,
        subscriptionId: existing.id,
      });
      return buildSubscriptionResponse(existing);
    }

    // Get product by code
    const product = await prisma.product.findUnique({
      where: { code: productCode },
    });

    if (!product) {
      throw new Error(`Product not found: ${productCode}`);
    }

    // Calculate period dates
    const now = new Date();
    const periodEnd = calculatePeriodEnd(now, billingCycle);

    // Build add-ons JSON
    const addOnsJson: SubscriptionAddOns | null = addOns?.length
      ? {
          items: addOns,
          totalCents: addOns.reduce((sum, a) => sum + a.priceCents * a.quantity, 0),
        }
      : null;

    // Build metadata
    const metadata: Record<string, unknown> = {
      ...(order.metadata ?? {}),
      domain: domain ?? null,
      source: 'order',
      createdFromOrderId: order.id,
    };

    // Create subscription
    const subscription = await prisma.subscription.create({
      data: {
        tenantId: order.tenantId,
        customerId: order.customerId,
        priceId: order.priceId,
        orderId: order.id,
        productId: product.id,
        productCode: product.code,
        planCode: product.code,
        billingCycle,
        status: SUBSCRIPTION_STATUSES.INACTIVE,
        startedAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        renewsAt: periodEnd,
        externalSubscriptionId: externalSubscriptionId ?? null,
        quantity: 1,
        price: order.totalAmountCents,
        currency: order.currency,
        addOns: addOnsJson ? (addOnsJson as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        metadata: metadata as Prisma.InputJsonValue,
      },
      include: subscriptionIncludes,
    });

    logger.info('Subscription created from order', {
      subscriptionId: subscription.id,
      orderId: order.id,
      productCode,
    });

    // Audit event
    await writeAuditEvent({
      actorUserId,
      tenantId: order.tenantId,
      type: 'SUBSCRIPTION_CREATED',
      metadata: {
        subscriptionId: subscription.id,
        orderId: order.id,
        productCode,
        billingCycle,
        source: 'order',
      },
    });

    return buildSubscriptionResponse(subscription);
  }

  /**
   * Sync subscription from Stripe webhook.
   * Handles all subscription lifecycle events from Stripe.
   * 
   * Idempotent: Uses externalSubscriptionId to find/create.
   */
  async syncSubscriptionFromWebhook(
    input: SyncSubscriptionFromWebhookInput,
    eventId: string
  ): Promise<SubscriptionWithRelations> {
    const {
      externalSubscriptionId,
      eventType,
      customerEmail,
      productCode,
      billingCycle,
      status,
      priceCents,
      currency,
      quantity,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAt,
      cancelAtPeriodEnd,
      domain,
      addOns,
      metadata,
    } = input;

    logger.info('Syncing subscription from webhook', {
      eventId,
      eventType,
      externalSubscriptionId,
      customerEmail,
    });

    // Find existing subscription by external ID
    let subscription = await prisma.subscription.findUnique({
      where: { externalSubscriptionId },
      include: subscriptionIncludes,
    });

    // Handle based on event type
    if (
      eventType === STRIPE_EVENTS.SUBSCRIPTION_CREATED ||
      eventType === STRIPE_EVENTS.CHECKOUT_SESSION_COMPLETED
    ) {
      if (subscription) {
        logger.info('Subscription already exists, updating', {
          subscriptionId: subscription.id,
          externalSubscriptionId,
        });
      } else {
        // Need to resolve tenant from customer email
        const customer = await prisma.customer.findFirst({
          where: { email: customerEmail.toLowerCase() },
          include: { tenant: true },
        });

        if (!customer) {
          throw new Error(`Customer not found for email: ${customerEmail}`);
        }

        // Get product
        const product = productCode
          ? await prisma.product.findUnique({ where: { code: productCode } })
          : null;

        const now = new Date();
        const periodEnd = currentPeriodEnd ?? calculatePeriodEnd(now, billingCycle ?? 'monthly');

        // Create new subscription
        subscription = await prisma.subscription.create({
          data: {
            tenantId: customer.tenantId,
            customerId: customer.id,
            productId: product?.id ?? null,
            productCode: product?.code ?? productCode ?? null,
            planCode: product?.code ?? productCode ?? null,
            billingCycle: billingCycle ?? 'monthly',
            status: status ?? SUBSCRIPTION_STATUSES.ACTIVE,
            startedAt: now,
            currentPeriodStart: currentPeriodStart ?? now,
            currentPeriodEnd: periodEnd,
            renewsAt: periodEnd,
            externalSubscriptionId,
            quantity: quantity ?? 1,
            price: priceCents ?? null,
            currency: currency ?? 'usd',
            cancelAt: cancelAt ?? null,
            cancelAtPeriodEnd: cancelAtPeriodEnd ?? false,
            metadata: {
              ...metadata,
              domain,
              source: 'stripe_webhook',
              webhookEventId: eventId,
            } as Prisma.InputJsonValue,
          },
          include: subscriptionIncludes,
        });

        logger.info('Subscription created from webhook', {
          subscriptionId: subscription.id,
          externalSubscriptionId,
        });

        // Audit
        await writeAuditEvent({
          actorUserId: null,
          tenantId: customer.tenantId,
          type: 'SUBSCRIPTION_SYNCED_FROM_PROVIDER',
          metadata: {
            subscriptionId: subscription.id,
            externalSubscriptionId,
            eventType,
            eventId,
          },
        });

        // Trigger provisioning for hosting products
        if (isHostingProduct(subscription.productCode)) {
          await this.triggerCloudPodProvisioning(subscription, domain ?? null);
        }

        return buildSubscriptionResponse(subscription);
      }
    }

    if (!subscription) {
      throw new Error(`Subscription not found: ${externalSubscriptionId}`);
    }

    // Update existing subscription based on event type
    const updateData: Prisma.SubscriptionUpdateInput = {
      updatedAt: new Date(),
    };

    if (status) {
      updateData.status = status;
    }
    if (currentPeriodStart) {
      updateData.currentPeriodStart = currentPeriodStart;
    }
    if (currentPeriodEnd) {
      updateData.currentPeriodEnd = currentPeriodEnd;
      updateData.renewsAt = currentPeriodEnd;
    }
    if (cancelAt !== undefined) {
      updateData.cancelAt = cancelAt;
    }
    if (cancelAtPeriodEnd !== undefined) {
      updateData.cancelAtPeriodEnd = cancelAtPeriodEnd;
    }
    if (priceCents !== undefined) {
      updateData.price = priceCents;
    }
    if (quantity !== undefined) {
      updateData.quantity = quantity;
    }

    // Handle cancellation
    if (eventType === STRIPE_EVENTS.SUBSCRIPTION_DELETED) {
      updateData.status = SUBSCRIPTION_STATUSES.CANCELLED;
      updateData.cancelledAt = new Date();
    }

    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: updateData,
      include: subscriptionIncludes,
    });

    // Audit event
    const auditType =
      eventType === STRIPE_EVENTS.SUBSCRIPTION_DELETED
        ? 'SUBSCRIPTION_CANCELLED'
        : 'SUBSCRIPTION_UPDATED';

    await writeAuditEvent({
      actorUserId: null,
      tenantId: subscription.tenantId,
      type: auditType,
      metadata: {
        subscriptionId: subscription.id,
        externalSubscriptionId,
        eventType,
        eventId,
        changes: updateData,
      },
    });

    logger.info('Subscription synced from webhook', {
      subscriptionId: subscription.id,
      eventType,
    });

    return buildSubscriptionResponse(updated);
  }

  /**
   * Activate a subscription.
   * This triggers CloudPod provisioning for hosting products.
   */
  async activateSubscription(
    input: ActivateSubscriptionInput,
    actorUserId: string | null = null
  ): Promise<SubscriptionWithRelations> {
    const { subscriptionId, tenantId } = input;

    logger.info('Activating subscription', { subscriptionId, tenantId });

    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        tenantId,
        deletedAt: null,
      },
      include: subscriptionIncludes,
    });

    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    if (subscription.status === SUBSCRIPTION_STATUSES.ACTIVE) {
      logger.info('Subscription already active', { subscriptionId });
      return buildSubscriptionResponse(subscription);
    }

    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: SUBSCRIPTION_STATUSES.ACTIVE,
        updatedAt: new Date(),
      },
      include: subscriptionIncludes,
    });

    // Audit
    await writeAuditEvent({
      actorUserId,
      tenantId,
      type: 'SUBSCRIPTION_ACTIVATED',
      metadata: {
        subscriptionId,
        previousStatus: subscription.status,
      },
    });

    // Trigger provisioning for hosting products
    const metadata = subscription.metadata as Record<string, unknown> | null;
    const domain = metadata?.domain as string | null;

    if (isHostingProduct(subscription.productCode)) {
      await this.triggerCloudPodProvisioning(updated, domain);
    }

    logger.info('Subscription activated', { subscriptionId });

    return buildSubscriptionResponse(updated);
  }

  /**
   * Cancel a subscription.
   */
  async cancelSubscription(
    input: CancelSubscriptionInput,
    actorUserId: string | null = null
  ): Promise<SubscriptionWithRelations> {
    const { subscriptionId, tenantId, immediate = false, reason } = input;

    logger.info('Cancelling subscription', {
      subscriptionId,
      tenantId,
      immediate,
      reason,
    });

    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        tenantId,
        deletedAt: null,
      },
    });

    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    const updateData: Prisma.SubscriptionUpdateInput = {
      updatedAt: new Date(),
    };

    if (immediate) {
      updateData.status = SUBSCRIPTION_STATUSES.CANCELLED;
      updateData.cancelledAt = new Date();
      updateData.cancelAt = new Date();
    } else {
      updateData.cancelAtPeriodEnd = true;
      updateData.cancelAt = subscription.currentPeriodEnd ?? subscription.renewsAt;
    }

    // Store reason in metadata
    if (reason) {
      const existingMetadata = (subscription.metadata as Record<string, unknown>) ?? {};
      updateData.metadata = {
        ...existingMetadata,
        cancellationReason: reason,
        cancellationRequestedAt: new Date().toISOString(),
      } as Prisma.InputJsonValue;
    }

    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: updateData,
      include: subscriptionIncludes,
    });

    // Audit
    await writeAuditEvent({
      actorUserId,
      tenantId,
      type: 'SUBSCRIPTION_CANCELLED',
      metadata: {
        subscriptionId,
        immediate,
        reason,
        cancelAt: updateData.cancelAt,
      },
    });

    logger.info('Subscription cancelled', { subscriptionId, immediate });

    return buildSubscriptionResponse(updated);
  }

  /**
   * Schedule cancellation for a specific date.
   */
  async scheduleCancellation(
    input: ScheduleCancellationInput,
    actorUserId: string | null = null
  ): Promise<SubscriptionWithRelations> {
    const { subscriptionId, tenantId, cancelAt, reason } = input;

    logger.info('Scheduling subscription cancellation', {
      subscriptionId,
      cancelAt,
    });

    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        tenantId,
        deletedAt: null,
      },
    });

    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    const existingMetadata = (subscription.metadata as Record<string, unknown>) ?? {};

    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        cancelAt,
        cancelAtPeriodEnd: false,
        metadata: {
          ...existingMetadata,
          scheduledCancellation: {
            date: cancelAt.toISOString(),
            reason,
            scheduledAt: new Date().toISOString(),
          },
        } as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
      include: subscriptionIncludes,
    });

    await writeAuditEvent({
      actorUserId,
      tenantId,
      type: 'SUBSCRIPTION_CANCELLED',
      metadata: {
        subscriptionId,
        scheduledCancelAt: cancelAt,
        reason,
      },
    });

    return buildSubscriptionResponse(updated);
  }

  /**
   * Update billing cycle.
   */
  async updateBillingCycle(
    input: UpdateBillingCycleInput,
    actorUserId: string | null = null
  ): Promise<SubscriptionWithRelations> {
    const { subscriptionId, tenantId, newBillingCycle } = input;

    logger.info('Updating subscription billing cycle', {
      subscriptionId,
      newBillingCycle,
    });

    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        tenantId,
        deletedAt: null,
      },
    });

    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    const oldBillingCycle = subscription.billingCycle;

    // Recalculate renewal date
    const newRenewsAt = calculatePeriodEnd(
      subscription.currentPeriodStart,
      newBillingCycle
    );

    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        billingCycle: newBillingCycle,
        renewsAt: newRenewsAt,
        currentPeriodEnd: newRenewsAt,
        updatedAt: new Date(),
      },
      include: subscriptionIncludes,
    });

    await writeAuditEvent({
      actorUserId,
      tenantId,
      type: 'SUBSCRIPTION_UPDATED',
      metadata: {
        subscriptionId,
        oldBillingCycle,
        newBillingCycle,
        newRenewsAt,
      },
    });

    return buildSubscriptionResponse(updated);
  }

  /**
   * Upgrade subscription to a higher tier plan.
   */
  async upgradePlan(
    input: UpgradePlanInput,
    actorUserId: string | null = null
  ): Promise<SubscriptionWithRelations> {
    const { subscriptionId, tenantId, newProductCode, newPriceId } = input;

    logger.info('Upgrading subscription plan', {
      subscriptionId,
      newProductCode,
    });

    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        tenantId,
        deletedAt: null,
      },
    });

    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    const newProduct = await prisma.product.findUnique({
      where: { code: newProductCode },
    });

    if (!newProduct) {
      throw new Error(`Product not found: ${newProductCode}`);
    }

    const oldProductCode = subscription.productCode;

    const updateData: Prisma.SubscriptionUpdateInput = {
      productId: newProduct.id,
      productCode: newProduct.code,
      planCode: newProduct.code,
      updatedAt: new Date(),
    };

    if (newPriceId) {
      const newPrice = await prisma.price.findUnique({
        where: { id: newPriceId },
      });
      if (newPrice) {
        updateData.price_rel = { connect: { id: newPrice.id } };
        updateData.price = newPrice.amountCents;
      }
    }

    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: updateData,
      include: subscriptionIncludes,
    });

    await writeAuditEvent({
      actorUserId,
      tenantId,
      type: 'SUBSCRIPTION_UPGRADE_REQUESTED',
      metadata: {
        subscriptionId,
        oldProductCode,
        newProductCode,
      },
    });

    // TODO: Enqueue scale job if resources changed

    return buildSubscriptionResponse(updated);
  }

  /**
   * Downgrade subscription to a lower tier plan.
   */
  async downgradePlan(
    input: DowngradePlanInput,
    actorUserId: string | null = null
  ): Promise<SubscriptionWithRelations> {
    const {
      subscriptionId,
      tenantId,
      newProductCode,
      newPriceId,
      effectiveAt = 'period_end',
    } = input;

    logger.info('Downgrading subscription plan', {
      subscriptionId,
      newProductCode,
      effectiveAt,
    });

    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        tenantId,
        deletedAt: null,
      },
    });

    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    const newProduct = await prisma.product.findUnique({
      where: { code: newProductCode },
    });

    if (!newProduct) {
      throw new Error(`Product not found: ${newProductCode}`);
    }

    const oldProductCode = subscription.productCode;
    const existingMetadata = (subscription.metadata as Record<string, unknown>) ?? {};

    if (effectiveAt === 'period_end') {
      // Schedule for end of period
      const updated = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          metadata: {
            ...existingMetadata,
            scheduledDowngrade: {
              newProductCode,
              newPriceId,
              effectiveAt: subscription.currentPeriodEnd?.toISOString(),
              scheduledAt: new Date().toISOString(),
            },
          } as Prisma.InputJsonValue,
          updatedAt: new Date(),
        },
        include: subscriptionIncludes,
      });

      await writeAuditEvent({
        actorUserId,
        tenantId,
        type: 'SUBSCRIPTION_DOWNGRADE_REQUESTED',
        metadata: {
          subscriptionId,
          oldProductCode,
          newProductCode,
          effectiveAt: subscription.currentPeriodEnd,
        },
      });

      return buildSubscriptionResponse(updated);
    }

    // Apply immediately
    const updateData: Prisma.SubscriptionUpdateInput = {
      productId: newProduct.id,
      productCode: newProduct.code,
      planCode: newProduct.code,
      updatedAt: new Date(),
    };

    if (newPriceId) {
      const newPrice = await prisma.price.findUnique({
        where: { id: newPriceId },
      });
      if (newPrice) {
        updateData.price_rel = { connect: { id: newPrice.id } };
        updateData.price = newPrice.amountCents;
      }
    }

    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: updateData,
      include: subscriptionIncludes,
    });

    await writeAuditEvent({
      actorUserId,
      tenantId,
      type: 'SUBSCRIPTION_DOWNGRADE_REQUESTED',
      metadata: {
        subscriptionId,
        oldProductCode,
        newProductCode,
        effectiveAt: 'immediately',
      },
    });

    return buildSubscriptionResponse(updated);
  }

  /**
   * Renew a subscription.
   */
  async renewSubscription(
    subscriptionId: string,
    tenantId: string
  ): Promise<SubscriptionWithRelations> {
    logger.info('Renewing subscription', { subscriptionId });

    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        tenantId,
        deletedAt: null,
      },
    });

    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    const now = new Date();
    const billingCycle = (subscription.billingCycle as BillingCycle) ?? 'monthly';
    const newRenewalDate = calculatePeriodEnd(now, billingCycle);

    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        currentPeriodStart: now,
        currentPeriodEnd: newRenewalDate,
        renewsAt: newRenewalDate,
        status: SUBSCRIPTION_STATUSES.ACTIVE,
        cancelAt: null,
        cancelAtPeriodEnd: false,
        updatedAt: now,
      },
      include: subscriptionIncludes,
    });

    await writeAuditEvent({
      actorUserId: null,
      tenantId: subscription.tenantId,
      type: 'SUBSCRIPTION_RENEWED',
      metadata: {
        subscriptionId,
        newRenewsAt: newRenewalDate,
      },
    });

    logger.info('Subscription renewed', { subscriptionId, newRenewalDate });

    return buildSubscriptionResponse(updated);
  }

  // ============================================
  // QUERY METHODS
  // ============================================

  /**
   * Get subscription by ID.
   */
  async getSubscriptionById(
    subscriptionId: string,
    tenantId: string
  ): Promise<SubscriptionWithRelations | null> {
    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        tenantId,
        deletedAt: null,
      },
      include: subscriptionIncludes,
    });

    if (!subscription) {
      return null;
    }

    return buildSubscriptionResponse(subscription);
  }

  /**
   * Get subscription by external ID.
   */
  async getSubscriptionByExternalId(
    externalSubscriptionId: string
  ): Promise<SubscriptionWithRelations | null> {
    const subscription = await prisma.subscription.findUnique({
      where: { externalSubscriptionId },
      include: subscriptionIncludes,
    });

    if (!subscription) {
      return null;
    }

    return buildSubscriptionResponse(subscription);
  }

  /**
   * List subscriptions with filters.
   */
  async listSubscriptions(
    options: ListSubscriptionsOptions
  ): Promise<SubscriptionsListResponse> {
    const {
      tenantId,
      customerId,
      status,
      productCode,
      includeInactive = false,
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    const where: Prisma.SubscriptionWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (customerId) {
      where.customerId = customerId;
    }

    if (status) {
      if (Array.isArray(status)) {
        where.status = { in: status };
      } else {
        where.status = status;
      }
    } else if (!includeInactive) {
      where.status = { not: SUBSCRIPTION_STATUSES.CANCELLED };
    }

    if (productCode) {
      where.productCode = productCode;
    }

    const total = await prisma.subscription.count({ where });

    const subscriptions = await prisma.subscription.findMany({
      where,
      include: subscriptionIncludes,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      subscriptions: subscriptions.map(buildSubscriptionResponse),
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  /**
   * Trigger CloudPod provisioning for a subscription.
   */
  private async triggerCloudPodProvisioning(
    subscription: any,
    domain: string | null
  ): Promise<string | null> {
    try {
      const job = await enqueueCreateCloudPodJob({
        tenantId: subscription.tenantId,
        subscriptionId: subscription.id,
        planCode: subscription.productCode ?? subscription.planCode ?? 'default',
        requestedDomain: domain ?? undefined,
        triggeredByUserId: 'SYSTEM',  // System-triggered provisioning
        source: 'billing_webhook',
      });

      await writeAuditEvent({
        actorUserId: null,
        tenantId: subscription.tenantId,
        type: 'CLOUDPOD_CREATE_REQUESTED',
        metadata: {
          subscriptionId: subscription.id,
          jobId: job.id,
          planCode: subscription.productCode,
          domain,
        },
      });

      logger.info('CloudPod provisioning triggered', {
        subscriptionId: subscription.id,
        jobId: job.id,
      });

      return job.id;
    } catch (error) {
      logger.error('Failed to trigger CloudPod provisioning', {
        subscriptionId: subscription.id,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return null;
    }
  }
}

// ============================================
// EXPORT
// ============================================

export default new SubscriptionService();
