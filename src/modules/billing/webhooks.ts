/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * Billing Webhook Handler - Processes payment provider events.
 * 
 * Flow: Stripe webhook → Create/link User & Tenant → Create Subscription → 
 *       Create CloudPod record → Enqueue provisioning job
 */

import { Request, Response } from 'express';
import { getOrCreateUserForEmail } from '../users/userService.js';
import { getOrCreateTenantForUser } from '../tenants/tenantService.js';
import { createSubscriptionFromProviderEvent } from './subscriptionService.js';
import { enqueueCreateCloudPodJob } from '../provisioning/queue.js';
import { writeAuditEvent } from '../security/auditService.js';
import logger from '../../config/logger.js';
import Stripe from 'stripe';

// ============================================
// TYPES
// ============================================

interface BillingWebhookPayload {
  eventType: string;
  payload: {
    customerEmail: string;
    planCode: string;
    billingCycle: 'monthly' | 'yearly';
    externalSubscriptionId: string;
    domain?: string;
    addOns?: string[];
    customerId?: string;
    amount?: number;
    currency?: string;
  };
}

// ============================================
// MAIN WEBHOOK HANDLER
// ============================================

/**
 * Handle billing webhook from payment provider.
 * This is the main entry point for the checkout → provisioning flow.
 * 
 * Supports:
 * - subscription_activated: New subscription paid and active
 * - subscription_updated: Plan change, renewal
 * - subscription_cancelled: Subscription cancelled
 * - payment_failed: Payment attempt failed
 */
export async function handleBillingWebhook(req: Request, res: Response) {
  const requestId = (req as any).id || crypto.randomUUID();
  
  try {
    const { eventType, payload } = req.body as BillingWebhookPayload;

    logger.info('Billing webhook received', {
      eventType,
      requestId,
      externalSubscriptionId: payload?.externalSubscriptionId,
    });

    // Route to appropriate handler
    switch (eventType) {
      case 'subscription_activated':
      case 'checkout.session.completed':
        return await handleSubscriptionActivated(payload, requestId, res);

      case 'subscription_updated':
      case 'customer.subscription.updated':
        return await handleSubscriptionUpdated(payload, requestId, res);

      case 'subscription_cancelled':
      case 'customer.subscription.deleted':
        return await handleSubscriptionCancelled(payload, requestId, res);

      case 'payment_failed':
      case 'invoice.payment_failed':
        return await handlePaymentFailed(payload, requestId, res);

      default:
        // Acknowledge unknown events without error
        logger.debug('Unhandled webhook event type', { eventType, requestId });
        return res.status(200).json({ received: true, handled: false });
    }
  } catch (err: unknown) {
    const error = err as Error;
    logger.error('Error handling billing webhook', {
      error: error?.message,
      stack: error?.stack,
      requestId,
    });

    // Return 500 so provider retries
    return res.status(500).json({
      error: {
        code: 'WEBHOOK_PROCESSING_FAILED',
        message: 'Failed to process webhook',
      },
      meta: { requestId },
    });
  }
}

// ============================================
// EVENT HANDLERS
// ============================================

/**
 * Handle new subscription activation.
 * This triggers the full onboarding flow:
 * 1. Create/get User
 * 2. Create/get Tenant  
 * 3. Create Subscription
 * 4. Enqueue CloudPod provisioning job
 */
async function handleSubscriptionActivated(
  payload: BillingWebhookPayload['payload'],
  requestId: string,
  res: Response
) {
  const {
    customerEmail,
    planCode,
    billingCycle,
    externalSubscriptionId,
    domain,
    addOns,
    amount,
    currency,
  } = payload;

  if (!customerEmail || !planCode || !externalSubscriptionId) {
    return res.status(400).json({
      error: {
        code: 'INVALID_PAYLOAD',
        message: 'Missing required fields: customerEmail, planCode, externalSubscriptionId',
      },
      meta: { requestId },
    });
  }

  // 1) Get or create User
  const user = await getOrCreateUserForEmail(customerEmail, {
    source: 'billing_webhook',
    emailVerified: true, // They paid, so email is verified
  });

  // 2) Get or create Tenant
  const tenant = await getOrCreateTenantForUser(user);

  // 3) Create Subscription
  const subscription = await createSubscriptionFromProviderEvent({
    tenantId: tenant.id,
    planCode,
    billingCycle,
    externalSubscriptionId,
    addOns,
    price: amount,
    currency,
  });

  // 4) Enqueue CloudPod provisioning job (for hosting products)
  const isHostingProduct = planCode.includes('cloudpod') || 
                          planCode.includes('hosting') ||
                          planCode.includes('wordpress');

  let jobId: string | null = null;

  if (isHostingProduct) {
    const job = await enqueueCreateCloudPodJob({
      tenantId: tenant.id,
      subscriptionId: subscription.id,
      planCode,
      requestedDomain: domain,
      addOns,
      triggeredByUserId: user.id,
      source: 'billing_webhook',
    });
    jobId = job.id;
  }

  // 5) Emit audit event
  await writeAuditEvent({
    actorUserId: user.id,
    tenantId: tenant.id,
    type: 'SUBSCRIPTION_CREATED',
    requestId,
    metadata: {
      subscriptionId: subscription.id,
      externalSubscriptionId,
      planCode,
      jobId,
      source: 'billing_webhook',
    },
  });

  logger.info('Billing webhook processed: subscription_activated', {
    userId: user.id,
    tenantId: tenant.id,
    subscriptionId: subscription.id,
    jobId,
    requestId,
  });

  return res.status(200).json({
    data: {
      ok: true,
      userId: user.id,
      tenantId: tenant.id,
      subscriptionId: subscription.id,
      jobId,
    },
    meta: { requestId },
  });
}

/**
 * Handle subscription update (plan change, etc).
 */
async function handleSubscriptionUpdated(
  payload: BillingWebhookPayload['payload'],
  requestId: string,
  res: Response
) {
  const { externalSubscriptionId, planCode } = payload;

  if (!externalSubscriptionId) {
    return res.status(400).json({
      error: {
        code: 'INVALID_PAYLOAD',
        message: 'Missing externalSubscriptionId',
      },
      meta: { requestId },
    });
  }

  // Find existing subscription
  const { getSubscriptionByExternalId, changeSubscriptionPlan } = await import('./subscriptionService.js');
  
  const subscription = await getSubscriptionByExternalId(externalSubscriptionId);

  if (!subscription) {
    logger.warn('Subscription not found for update', {
      externalSubscriptionId,
      requestId,
    });
    return res.status(200).json({ received: true, found: false });
  }

  // Update plan if changed
  if (planCode && planCode !== subscription.planCode) {
    await changeSubscriptionPlan(subscription.id, planCode, null as any);
    
    // TODO: Enqueue scale job if resources changed
  }

  await writeAuditEvent({
    actorUserId: null,
    tenantId: subscription.tenantId,
    type: 'SUBSCRIPTION_UPDATED',
    requestId,
    metadata: {
      subscriptionId: subscription.id,
      externalSubscriptionId,
      changes: { planCode },
    },
  });

  logger.info('Billing webhook processed: subscription_updated', {
    subscriptionId: subscription.id,
    requestId,
  });

  return res.status(200).json({
    data: { ok: true, subscriptionId: subscription.id },
    meta: { requestId },
  });
}

/**
 * Handle subscription cancellation.
 */
async function handleSubscriptionCancelled(
  payload: BillingWebhookPayload['payload'],
  requestId: string,
  res: Response
) {
  const { externalSubscriptionId } = payload;

  if (!externalSubscriptionId) {
    return res.status(400).json({
      error: {
        code: 'INVALID_PAYLOAD',
        message: 'Missing externalSubscriptionId',
      },
      meta: { requestId },
    });
  }

  const { getSubscriptionByExternalId, updateSubscriptionStatus } = await import('./subscriptionService.js');
  
  const subscription = await getSubscriptionByExternalId(externalSubscriptionId);

  if (!subscription) {
    logger.warn('Subscription not found for cancellation', {
      externalSubscriptionId,
      requestId,
    });
    return res.status(200).json({ received: true, found: false });
  }

  await updateSubscriptionStatus(subscription.id, 'CANCELLED');

  // TODO: Enqueue CloudPod suspension/deletion job based on policy

  await writeAuditEvent({
    actorUserId: null,
    tenantId: subscription.tenantId,
    type: 'SUBSCRIPTION_CANCELLED',
    requestId,
    severity: 'warning',
    metadata: {
      subscriptionId: subscription.id,
      externalSubscriptionId,
      source: 'billing_webhook',
    },
  });

  logger.info('Billing webhook processed: subscription_cancelled', {
    subscriptionId: subscription.id,
    requestId,
  });

  return res.status(200).json({
    data: { ok: true, subscriptionId: subscription.id },
    meta: { requestId },
  });
}

/**
 * Handle payment failure.
 */
async function handlePaymentFailed(
  payload: BillingWebhookPayload['payload'],
  requestId: string,
  res: Response
) {
  const { externalSubscriptionId, customerEmail } = payload;

  const { getSubscriptionByExternalId } = await import('./subscriptionService.js');
  
  const subscription = externalSubscriptionId
    ? await getSubscriptionByExternalId(externalSubscriptionId)
    : null;

  await writeAuditEvent({
    actorUserId: null,
    tenantId: subscription?.tenantId ?? null,
    type: 'INVOICE_FAILED',
    requestId,
    severity: 'warning',
    metadata: {
      subscriptionId: subscription?.id,
      externalSubscriptionId,
      customerEmail,
    },
  });

  // TODO: Send payment failed email
  // TODO: Schedule suspension if repeated failures

  logger.warn('Billing webhook processed: payment_failed', {
    subscriptionId: subscription?.id,
    customerEmail,
    requestId,
  });

  return res.status(200).json({
    data: { ok: true, handled: true },
    meta: { requestId },
  });
}

// ============================================
// STRIPE SIGNATURE VERIFICATION
// ============================================

/**
 * Verify Stripe webhook signature.
 * Use this middleware before handleBillingWebhook for Stripe webhooks.
 */
export function verifyStripeSignature(
  webhookSecret: string
): (req: Request, res: Response, next: () => void) => void {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2024-11-20.acacia',
  });

  return (req: Request, res: Response, next: () => void) => {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      logger.warn('Missing Stripe signature');
      return res.status(400).json({ error: 'Missing signature' });
    }

    try {
      // Note: req.body must be the raw body for signature verification
      const event = stripe.webhooks.constructEvent(
        (req as any).rawBody || req.body,
        signature,
        webhookSecret
      );

      // Attach parsed event to request
      (req as any).stripeEvent = event;
      
      // Transform to our format
      req.body = {
        eventType: event.type,
        payload: extractPayloadFromStripeEvent(event),
      };

      next();
    } catch (err: unknown) {
      const error = err as Error;
      logger.error('Stripe signature verification failed', {
        error: error.message,
      });
      return res.status(400).json({ error: 'Invalid signature' });
    }
  };
}

/**
 * Extract our payload format from a Stripe event.
 */
function extractPayloadFromStripeEvent(event: Stripe.Event): BillingWebhookPayload['payload'] {
  const data = event.data.object as any;

  return {
    customerEmail: data.customer_email || data.customer_details?.email || '',
    planCode: data.metadata?.plan_code || data.items?.data?.[0]?.price?.metadata?.plan_code || '',
    billingCycle: data.items?.data?.[0]?.plan?.interval === 'year' ? 'yearly' : 'monthly',
    externalSubscriptionId: data.subscription || data.id || '',
    domain: data.metadata?.domain,
    addOns: data.metadata?.addOns ? JSON.parse(data.metadata.addOns) : undefined,
    customerId: data.customer,
    amount: data.amount_total ? data.amount_total / 100 : undefined,
    currency: data.currency?.toUpperCase(),
  };
}

export default {
  handleBillingWebhook,
  verifyStripeSignature,
};
