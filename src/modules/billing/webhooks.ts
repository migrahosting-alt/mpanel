/**
 * Billing Webhooks - Enterprise-grade Stripe Webhook Handler
 * 
 * Features:
 * - Full Stripe event support
 * - Idempotency via event ID tracking
 * - Multi-tenant resolution
 * - CloudPod provisioning trigger
 * - Comprehensive audit logging
 * - Error handling with proper responses
 * 
 * Stripe Events Handled:
 * - checkout.session.completed
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.payment_succeeded
 * - invoice.payment_failed
 * - customer.subscription.trial_will_end
 */

import type { Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import { writeAuditEvent } from '../security/auditService.js';
import { SubscriptionService } from './subscriptionService.js';
import {
  STRIPE_EVENTS,
  SUBSCRIPTION_STATUSES,
  type WebhookProcessingResult,
  type SyncSubscriptionFromWebhookInput,
} from './billing.types.js';

// ============================================
// STRIPE CLIENT
// ============================================

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-02-24.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

// Subscription service instance
const subscriptionService = new SubscriptionService();

// ============================================
// IDEMPOTENCY
// ============================================

/**
 * In-memory cache for processed webhook events.
 * This provides short-term deduplication (within process lifetime).
 * For production, consider using Redis for distributed deduplication.
 */
const processedEvents = new Map<string, Date>();
const MAX_CACHE_SIZE = 10000;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Check if webhook event has already been processed.
 * Uses in-memory cache for fast lookups.
 */
async function isEventProcessed(eventId: string): Promise<boolean> {
  // Clean old entries periodically
  if (processedEvents.size > MAX_CACHE_SIZE) {
    const now = Date.now();
    const entries = Array.from(processedEvents.entries());
    for (const [id, timestamp] of entries) {
      if (now - timestamp.getTime() > CACHE_TTL_MS) {
        processedEvents.delete(id);
      }
    }
  }
  
  return processedEvents.has(eventId);
}

/**
 * Mark webhook event as processed.
 */
async function markEventProcessed(
  eventId: string,
  eventType: string,
  _payload: unknown,
  success: boolean,
  _error?: string
): Promise<void> {
  // Add to cache
  processedEvents.set(eventId, new Date());
  
  // Log for debugging
  logger.debug('Webhook event marked as processed', {
    eventId,
    eventType,
    success,
  });
}

// ============================================
// SIGNATURE VERIFICATION
// ============================================

/**
 * Verify Stripe webhook signature.
 */
export function verifyStripeSignature(
  rawBody: Buffer | string,
  signature: string
): Stripe.Event {
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }

  try {
    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Stripe signature verification failed', { error: message });
    throw new Error(`Webhook signature verification failed: ${message}`);
  }
}

// ============================================
// EVENT HANDLERS
// ============================================

/**
 * Handle checkout.session.completed event.
 * This is when a customer completes checkout.
 */
async function handleCheckoutSessionCompleted(
  event: Stripe.Event,
  session: Stripe.Checkout.Session
): Promise<WebhookProcessingResult> {
  logger.info('Processing checkout.session.completed', {
    eventId: event.id,
    sessionId: session.id,
    customerEmail: session.customer_email,
  });

  // Get subscription ID from session
  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

  if (!subscriptionId) {
    logger.info('No subscription in checkout session, skipping', {
      sessionId: session.id,
    });
    return {
      success: true,
      eventId: event.id,
      eventType: event.type,
      message: 'No subscription in session',
    };
  }

  // Get full subscription from Stripe
  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price.product'],
  });

  // Extract product code from metadata or product name
  const item = stripeSubscription.items.data[0];
  const price = item?.price;
  const product = price?.product as Stripe.Product | undefined;
  const productCode =
    (session.metadata?.productCode as string) ||
    (product?.metadata?.code as string) ||
    product?.name?.toLowerCase().replace(/\s+/g, '-') ||
    'unknown';

  // Build sync input
  const syncInput: SyncSubscriptionFromWebhookInput = {
    externalSubscriptionId: subscriptionId,
    eventType: STRIPE_EVENTS.CHECKOUT_SESSION_COMPLETED,
    customerEmail: session.customer_email || '',
    productCode,
    billingCycle: price?.recurring?.interval === 'year' ? 'yearly' : 'monthly',
    status: mapStripeStatus(stripeSubscription.status),
    priceCents: price?.unit_amount ?? undefined,
    currency: price?.currency ?? 'usd',
    quantity: item?.quantity ?? 1,
    currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
    currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    domain: (session.metadata?.domain as string) || undefined,
    metadata: {
      stripeSessionId: session.id,
      stripeCustomerId:
        typeof session.customer === 'string' ? session.customer : session.customer?.id,
    },
  };

  await subscriptionService.syncSubscriptionFromWebhook(syncInput, event.id);

  return {
    success: true,
    eventId: event.id,
    eventType: event.type,
    subscriptionId,
  };
}

/**
 * Handle customer.subscription.created event.
 */
async function handleSubscriptionCreated(
  event: Stripe.Event,
  subscription: Stripe.Subscription
): Promise<WebhookProcessingResult> {
  logger.info('Processing customer.subscription.created', {
    eventId: event.id,
    subscriptionId: subscription.id,
  });

  // Get customer email
  const customer =
    typeof subscription.customer === 'string'
      ? await stripe.customers.retrieve(subscription.customer)
      : subscription.customer;

  if (!customer || customer.deleted) {
    throw new Error(`Customer not found or deleted: ${subscription.customer}`);
  }

  const customerEmail = (customer as Stripe.Customer).email || '';

  // Extract product info
  const item = subscription.items.data[0];
  const price = item?.price;
  const product = price?.product as Stripe.Product | string;
  const productId = typeof product === 'string' ? product : product?.id;

  let productCode = 'unknown';
  if (typeof product !== 'string' && product?.metadata?.code) {
    productCode = product.metadata.code;
  } else if (productId) {
    const stripeProduct = await stripe.products.retrieve(productId);
    productCode = stripeProduct.metadata?.code || stripeProduct.name?.toLowerCase().replace(/\s+/g, '-') || 'unknown';
  }

  const syncInput: SyncSubscriptionFromWebhookInput = {
    externalSubscriptionId: subscription.id,
    eventType: STRIPE_EVENTS.SUBSCRIPTION_CREATED,
    customerEmail,
    productCode,
    billingCycle: price?.recurring?.interval === 'year' ? 'yearly' : 'monthly',
    status: mapStripeStatus(subscription.status),
    priceCents: price?.unit_amount ?? undefined,
    currency: price?.currency ?? 'usd',
    quantity: item?.quantity ?? 1,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    metadata: {
      stripeCustomerId:
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id,
    },
  };

  await subscriptionService.syncSubscriptionFromWebhook(syncInput, event.id);

  return {
    success: true,
    eventId: event.id,
    eventType: event.type,
    subscriptionId: subscription.id,
  };
}

/**
 * Handle customer.subscription.updated event.
 */
async function handleSubscriptionUpdated(
  event: Stripe.Event,
  subscription: Stripe.Subscription
): Promise<WebhookProcessingResult> {
  logger.info('Processing customer.subscription.updated', {
    eventId: event.id,
    subscriptionId: subscription.id,
    status: subscription.status,
  });

  // Check if we have this subscription
  const existingSub = await subscriptionService.getSubscriptionByExternalId(
    subscription.id
  );

  if (!existingSub) {
    logger.warn('Subscription not found for update, will create', {
      externalSubscriptionId: subscription.id,
    });
    // Treat as create
    return handleSubscriptionCreated(event, subscription);
  }

  const item = subscription.items.data[0];
  const price = item?.price;

  const syncInput: SyncSubscriptionFromWebhookInput = {
    externalSubscriptionId: subscription.id,
    eventType: STRIPE_EVENTS.SUBSCRIPTION_UPDATED,
    customerEmail: '', // Not needed for update
    status: mapStripeStatus(subscription.status),
    priceCents: price?.unit_amount ?? undefined,
    quantity: item?.quantity ?? 1,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAt: subscription.cancel_at
      ? new Date(subscription.cancel_at * 1000)
      : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };

  await subscriptionService.syncSubscriptionFromWebhook(syncInput, event.id);

  return {
    success: true,
    eventId: event.id,
    eventType: event.type,
    subscriptionId: subscription.id,
  };
}

/**
 * Handle customer.subscription.deleted event.
 */
async function handleSubscriptionDeleted(
  event: Stripe.Event,
  subscription: Stripe.Subscription
): Promise<WebhookProcessingResult> {
  logger.info('Processing customer.subscription.deleted', {
    eventId: event.id,
    subscriptionId: subscription.id,
  });

  const syncInput: SyncSubscriptionFromWebhookInput = {
    externalSubscriptionId: subscription.id,
    eventType: STRIPE_EVENTS.SUBSCRIPTION_DELETED,
    customerEmail: '',
    status: SUBSCRIPTION_STATUSES.CANCELLED,
  };

  await subscriptionService.syncSubscriptionFromWebhook(syncInput, event.id);

  return {
    success: true,
    eventId: event.id,
    eventType: event.type,
    subscriptionId: subscription.id,
  };
}

/**
 * Handle invoice.payment_succeeded event.
 * Used to confirm subscription renewal.
 */
async function handleInvoicePaymentSucceeded(
  event: Stripe.Event,
  invoice: Stripe.Invoice
): Promise<WebhookProcessingResult> {
  logger.info('Processing invoice.payment_succeeded', {
    eventId: event.id,
    invoiceId: invoice.id,
  });

  const subscriptionId =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id;

  if (!subscriptionId) {
    logger.info('No subscription in invoice, skipping', {
      invoiceId: invoice.id,
    });
    return {
      success: true,
      eventId: event.id,
      eventType: event.type,
      message: 'No subscription in invoice',
    };
  }

  // Find subscription
  const existingSub = await subscriptionService.getSubscriptionByExternalId(
    subscriptionId
  );

  if (!existingSub) {
    logger.warn('Subscription not found for invoice payment', {
      subscriptionId,
    });
    return {
      success: true,
      eventId: event.id,
      eventType: event.type,
      message: 'Subscription not found',
    };
  }

  // If this is a renewal (not first invoice), update renewal date
  if (invoice.billing_reason === 'subscription_cycle') {
    await subscriptionService.renewSubscription(existingSub.id, existingSub.tenantId);
  }

  // Ensure subscription is active
  if (existingSub.status !== SUBSCRIPTION_STATUSES.ACTIVE) {
    const syncInput: SyncSubscriptionFromWebhookInput = {
      externalSubscriptionId: subscriptionId,
      eventType: STRIPE_EVENTS.INVOICE_PAYMENT_SUCCEEDED,
      customerEmail: '',
      status: SUBSCRIPTION_STATUSES.ACTIVE,
    };

    await subscriptionService.syncSubscriptionFromWebhook(syncInput, event.id);
  }

  return {
    success: true,
    eventId: event.id,
    eventType: event.type,
    subscriptionId,
  };
}

/**
 * Handle invoice.payment_failed event.
 */
async function handleInvoicePaymentFailed(
  event: Stripe.Event,
  invoice: Stripe.Invoice
): Promise<WebhookProcessingResult> {
  logger.info('Processing invoice.payment_failed', {
    eventId: event.id,
    invoiceId: invoice.id,
  });

  const subscriptionId =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id;

  if (!subscriptionId) {
    return {
      success: true,
      eventId: event.id,
      eventType: event.type,
      message: 'No subscription in invoice',
    };
  }

  const existingSub = await subscriptionService.getSubscriptionByExternalId(
    subscriptionId
  );

  if (!existingSub) {
    return {
      success: true,
      eventId: event.id,
      eventType: event.type,
      message: 'Subscription not found',
    };
  }

  // Update to past_due status
  const syncInput: SyncSubscriptionFromWebhookInput = {
    externalSubscriptionId: subscriptionId,
    eventType: STRIPE_EVENTS.INVOICE_PAYMENT_FAILED,
    customerEmail: '',
    status: SUBSCRIPTION_STATUSES.PAST_DUE,
  };

  await subscriptionService.syncSubscriptionFromWebhook(syncInput, event.id);

  // Send notification (could emit an event here)
  logger.warn('Payment failed for subscription', {
    subscriptionId: existingSub.id,
    tenantId: existingSub.tenantId,
  });

  // Audit event
  await writeAuditEvent({
    actorUserId: null,
    tenantId: existingSub.tenantId,
    type: 'BILLING_EVENT',
    metadata: {
      event: 'payment_failed',
      subscriptionId: existingSub.id,
      invoiceId: invoice.id,
      amountDue: invoice.amount_due,
    },
  });

  return {
    success: true,
    eventId: event.id,
    eventType: event.type,
    subscriptionId,
  };
}

/**
 * Handle customer.subscription.trial_will_end event.
 */
async function handleTrialWillEnd(
  event: Stripe.Event,
  subscription: Stripe.Subscription
): Promise<WebhookProcessingResult> {
  logger.info('Processing customer.subscription.trial_will_end', {
    eventId: event.id,
    subscriptionId: subscription.id,
    trialEnd: subscription.trial_end,
  });

  const existingSub = await subscriptionService.getSubscriptionByExternalId(
    subscription.id
  );

  if (!existingSub) {
    return {
      success: true,
      eventId: event.id,
      eventType: event.type,
      message: 'Subscription not found',
    };
  }

  // Log audit event for trial ending
  await writeAuditEvent({
    actorUserId: null,
    tenantId: existingSub.tenantId,
    type: 'BILLING_EVENT',
    metadata: {
      event: 'trial_will_end',
      subscriptionId: existingSub.id,
      trialEnd: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
    },
  });

  // TODO: Send notification email about trial ending

  return {
    success: true,
    eventId: event.id,
    eventType: event.type,
    subscriptionId: subscription.id,
  };
}

// ============================================
// STATUS MAPPING
// ============================================

/**
 * Map Stripe subscription status to our status.
 */
function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): string {
  switch (stripeStatus) {
    case 'active':
      return SUBSCRIPTION_STATUSES.ACTIVE;
    case 'trialing':
      return SUBSCRIPTION_STATUSES.TRIALING;
    case 'past_due':
      return SUBSCRIPTION_STATUSES.PAST_DUE;
    case 'canceled':
      return SUBSCRIPTION_STATUSES.CANCELLED;
    case 'unpaid':
      return SUBSCRIPTION_STATUSES.SUSPENDED;
    case 'incomplete':
    case 'incomplete_expired':
      return SUBSCRIPTION_STATUSES.INACTIVE;
    case 'paused':
      return SUBSCRIPTION_STATUSES.SUSPENDED;
    default:
      return SUBSCRIPTION_STATUSES.INACTIVE;
  }
}

// ============================================
// MAIN HANDLER
// ============================================

/**
 * Main Stripe webhook handler.
 * 
 * @example Express route:
 * app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);
 */
export async function handleStripeWebhook(
  req: Request,
  res: Response
): Promise<void> {
  const signature = req.headers['stripe-signature'] as string;

  if (!signature) {
    logger.warn('Missing Stripe signature');
    res.status(400).json({ error: 'Missing signature' });
    return;
  }

  let event: Stripe.Event;

  try {
    event = verifyStripeSignature(req.body, signature);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Webhook signature verification failed', { error: message });
    res.status(400).json({ error: message });
    return;
  }

  logger.info('Received Stripe webhook', {
    eventId: event.id,
    eventType: event.type,
  });

  // Idempotency check
  if (await isEventProcessed(event.id)) {
    logger.info('Webhook event already processed', { eventId: event.id });
    res.status(200).json({ received: true, duplicate: true });
    return;
  }

  let result: WebhookProcessingResult;

  try {
    switch (event.type) {
      case STRIPE_EVENTS.CHECKOUT_SESSION_COMPLETED:
        result = await handleCheckoutSessionCompleted(
          event,
          event.data.object as Stripe.Checkout.Session
        );
        break;

      case STRIPE_EVENTS.SUBSCRIPTION_CREATED:
        result = await handleSubscriptionCreated(
          event,
          event.data.object as Stripe.Subscription
        );
        break;

      case STRIPE_EVENTS.SUBSCRIPTION_UPDATED:
        result = await handleSubscriptionUpdated(
          event,
          event.data.object as Stripe.Subscription
        );
        break;

      case STRIPE_EVENTS.SUBSCRIPTION_DELETED:
        result = await handleSubscriptionDeleted(
          event,
          event.data.object as Stripe.Subscription
        );
        break;

      case STRIPE_EVENTS.INVOICE_PAYMENT_SUCCEEDED:
        result = await handleInvoicePaymentSucceeded(
          event,
          event.data.object as Stripe.Invoice
        );
        break;

      case STRIPE_EVENTS.INVOICE_PAYMENT_FAILED:
        result = await handleInvoicePaymentFailed(
          event,
          event.data.object as Stripe.Invoice
        );
        break;

      case STRIPE_EVENTS.SUBSCRIPTION_TRIAL_WILL_END:
        result = await handleTrialWillEnd(
          event,
          event.data.object as Stripe.Subscription
        );
        break;

      default:
        logger.info('Unhandled webhook event type', { type: event.type });
        result = {
          success: true,
          eventId: event.id,
          eventType: event.type,
          message: 'Event type not handled',
        };
    }

    // Mark as processed
    await markEventProcessed(event.id, event.type, event.data.object, true);

    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Webhook processing error', {
      eventId: event.id,
      eventType: event.type,
      error: message,
    });

    // Mark as failed
    await markEventProcessed(event.id, event.type, event.data.object, false, message);

    // Still return 200 to prevent Stripe retries for handled errors
    // Return 500 only for unexpected errors
    res.status(500).json({
      success: false,
      eventId: event.id,
      eventType: event.type,
      error: message,
    });
  }
}

/**
 * Generic webhook handler for non-Stripe providers.
 */
export async function handleGenericWebhook(
  req: Request,
  res: Response
): Promise<void> {
  const { provider, eventType, payload } = req.body;

  logger.info('Received generic webhook', { provider, eventType });

  // Log the event
  await writeAuditEvent({
    actorUserId: null,
    tenantId: null,
    type: 'BILLING_EVENT',
    metadata: {
      provider,
      eventType,
      payload,
    },
  });

  res.status(200).json({ received: true });
}

/**
 * Legacy handler - kept for backward compatibility.
 * Routes to appropriate new handler based on request structure.
 */
export async function handleBillingWebhook(
  req: Request,
  res: Response
): Promise<void> {
  // Check if this is a Stripe webhook
  const stripeSignature = req.headers['stripe-signature'];
  
  if (stripeSignature) {
    return handleStripeWebhook(req, res);
  }
  
  // Generic webhook
  return handleGenericWebhook(req, res);
}

// ============================================
// EXPORTS
// ============================================

export default {
  handleBillingWebhook,
  handleStripeWebhook,
  handleGenericWebhook,
  verifyStripeSignature,
};
