/**
 * Billing Module Types - Enterprise-grade subscription & webhook management
 * 
 * Aligned with:
 * - Prisma schema (Subscription, Order, Product, Price)
 * - Stripe webhook events
 * - CloudPods provisioning flow
 * - Multi-tenant isolation
 * 
 * This module is the billing source of truth for CloudPods.
 */

import type { Subscription, Order, Product, Price, Customer } from '@prisma/client';

// ============================================
// SUBSCRIPTION STATUS CONSTANTS
// ============================================

export const SUBSCRIPTION_STATUSES = {
  INACTIVE: 'inactive',
  ACTIVE: 'active',
  TRIALING: 'trialing',
  PAST_DUE: 'past_due',
  CANCELLED: 'cancelled',
  SUSPENDED: 'suspended',
  EXPIRED: 'expired',
} as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[keyof typeof SUBSCRIPTION_STATUSES];

export const BILLING_CYCLES = {
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly',
} as const;

export type BillingCycle = (typeof BILLING_CYCLES)[keyof typeof BILLING_CYCLES];

// ============================================
// STRIPE EVENT TYPES
// ============================================

export const STRIPE_EVENTS = {
  // Checkout events
  CHECKOUT_SESSION_COMPLETED: 'checkout.session.completed',
  CHECKOUT_SESSION_EXPIRED: 'checkout.session.expired',
  // Subscription events
  SUBSCRIPTION_CREATED: 'customer.subscription.created',
  SUBSCRIPTION_UPDATED: 'customer.subscription.updated',
  SUBSCRIPTION_DELETED: 'customer.subscription.deleted',
  SUBSCRIPTION_TRIAL_WILL_END: 'customer.subscription.trial_will_end',
  // Invoice events
  INVOICE_PAID: 'invoice.paid',
  INVOICE_PAYMENT_SUCCEEDED: 'invoice.payment_succeeded',
  INVOICE_PAYMENT_FAILED: 'invoice.payment_failed',
  INVOICE_FINALIZED: 'invoice.finalized',
  // Customer events
  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_UPDATED: 'customer.updated',
} as const;

export type StripeEventType = (typeof STRIPE_EVENTS)[keyof typeof STRIPE_EVENTS];

// ============================================
// INPUT TYPES
// ============================================

/**
 * Input for creating a subscription from an order.
 */
export interface CreateSubscriptionFromOrderInput {
  /** Order that triggered the subscription */
  order: {
    id: string;
    tenantId: string;
    customerId: string;
    priceId: string | null;
    totalAmountCents: number;
    currency: string;
    metadata?: Record<string, unknown> | null;
  };
  /** Product code */
  productCode: string;
  /** Billing cycle */
  billingCycle: BillingCycle;
  /** External subscription ID (Stripe) - null for internal orders */
  externalSubscriptionId?: string | null;
  /** Optional domain for hosting products */
  domain?: string;
  /** Add-ons */
  addOns?: AddOnConfig[];
}

/**
 * Input for syncing subscription from webhook.
 */
export interface SyncSubscriptionFromWebhookInput {
  /** External subscription ID (required) */
  externalSubscriptionId: string;
  /** Event type */
  eventType: StripeEventType | string;
  /** Customer email for tenant resolution */
  customerEmail: string;
  /** Product/plan code */
  productCode?: string;
  /** Billing interval */
  billingCycle?: BillingCycle;
  /** Subscription status */
  status?: string;
  /** Price in cents */
  priceCents?: number;
  /** Currency */
  currency?: string;
  /** Quantity */
  quantity?: number;
  /** Period start */
  currentPeriodStart?: Date;
  /** Period end */
  currentPeriodEnd?: Date;
  /** Cancel at timestamp */
  cancelAt?: Date | null;
  /** Whether to cancel at period end */
  cancelAtPeriodEnd?: boolean;
  /** Domain for hosting */
  domain?: string;
  /** Add-ons */
  addOns?: AddOnConfig[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Input for activating a subscription.
 */
export interface ActivateSubscriptionInput {
  subscriptionId: string;
  tenantId: string;
}

/**
 * Input for cancelling a subscription.
 */
export interface CancelSubscriptionInput {
  subscriptionId: string;
  tenantId: string;
  immediate?: boolean;
  reason?: string;
}

/**
 * Input for scheduling cancellation.
 */
export interface ScheduleCancellationInput {
  subscriptionId: string;
  tenantId: string;
  cancelAt: Date;
  reason?: string;
}

/**
 * Input for updating billing cycle.
 */
export interface UpdateBillingCycleInput {
  subscriptionId: string;
  tenantId: string;
  newBillingCycle: BillingCycle;
}

/**
 * Input for plan upgrade.
 */
export interface UpgradePlanInput {
  subscriptionId: string;
  tenantId: string;
  newProductCode: string;
  newPriceId?: string;
  prorated?: boolean;
}

/**
 * Input for plan downgrade.
 */
export interface DowngradePlanInput {
  subscriptionId: string;
  tenantId: string;
  newProductCode: string;
  newPriceId?: string;
  effectiveAt?: 'immediately' | 'period_end';
}

// ============================================
// ADD-ON TYPES
// ============================================

/**
 * Add-on configuration.
 */
export interface AddOnConfig {
  code: string;
  name: string;
  quantity: number;
  priceCents: number;
  currency?: string;
}

/**
 * Add-ons stored in subscription.
 */
export interface SubscriptionAddOns {
  items: AddOnConfig[];
  totalCents: number;
}

// ============================================
// RESPONSE TYPES
// ============================================

/**
 * Subscription with relations.
 */
export interface SubscriptionWithRelations {
  id: string;
  tenantId: string;
  customerId: string | null;
  priceId: string | null;
  orderId: string | null;
  productId: string | null;
  productCode: string | null;
  planCode: string | null;
  billingCycle: string | null;
  status: string;
  startedAt: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date | null;
  renewsAt: Date | null;
  cancelAt: Date | null;
  cancelAtPeriodEnd: boolean;
  cancelledAt: Date | null;
  stripeSubscriptionId: string | null;
  externalSubscriptionId: string | null;
  quantity: number;
  price: number | null;
  currency: string;
  addOns: SubscriptionAddOns | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  customer?: {
    id: string;
    email: string;
    fullName: string | null;
  } | null;
  product?: {
    id: string;
    name: string;
    code: string | null;
    type: string;
  } | null;
}

/**
 * Subscriptions list response.
 */
export interface SubscriptionsListResponse {
  subscriptions: SubscriptionWithRelations[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

// ============================================
// QUERY TYPES
// ============================================

/**
 * Options for listing subscriptions.
 */
export interface ListSubscriptionsOptions {
  tenantId: string;
  customerId?: string;
  status?: SubscriptionStatus | SubscriptionStatus[];
  productCode?: string;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// WEBHOOK TYPES
// ============================================

/**
 * Processed webhook event record.
 */
export interface ProcessedWebhookEvent {
  eventId: string;
  eventType: string;
  processedAt: Date;
  subscriptionId?: string;
}

/**
 * Webhook processing result.
 */
export interface WebhookProcessingResult {
  success: boolean;
  eventId: string;
  eventType: string;
  subscriptionId?: string;
  jobId?: string;
  error?: string;
  alreadyProcessed?: boolean;
  message?: string;
}

/**
 * Stripe webhook payload (simplified).
 */
export interface StripeWebhookPayload {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      customer?: string;
      customer_email?: string;
      customer_details?: {
        email?: string;
      };
      subscription?: string;
      status?: string;
      current_period_start?: number;
      current_period_end?: number;
      cancel_at?: number | null;
      cancel_at_period_end?: boolean;
      items?: {
        data?: Array<{
          price?: {
            id?: string;
            unit_amount?: number;
            currency?: string;
            recurring?: {
              interval?: string;
            };
            metadata?: Record<string, string>;
          };
          quantity?: number;
        }>;
      };
      metadata?: Record<string, string>;
      amount_total?: number;
      currency?: string;
    };
  };
  created: number;
}

// ============================================
// AUDIT EVENT TYPES
// ============================================

export type BillingAuditEventType =
  | 'BILLING_EVENT_RECEIVED'
  | 'SUBSCRIPTION_CREATED'
  | 'SUBSCRIPTION_ACTIVATED'
  | 'SUBSCRIPTION_UPDATED'
  | 'SUBSCRIPTION_CANCELLED'
  | 'SUBSCRIPTION_RENEWED'
  | 'SUBSCRIPTION_SYNCED_FROM_PROVIDER'
  | 'SUBSCRIPTION_UPGRADE_REQUESTED'
  | 'SUBSCRIPTION_DOWNGRADE_REQUESTED'
  | 'SUBSCRIPTION_PAYMENT_SUCCEEDED'
  | 'SUBSCRIPTION_PAYMENT_FAILED'
  | 'CLOUDPOD_PROVISIONING_TRIGGERED';

// ============================================
// RE-EXPORTS
// ============================================

export type { Subscription, Order, Product, Price, Customer };
