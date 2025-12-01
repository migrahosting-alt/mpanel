/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * Orders Module Types - Enterprise-grade order management with multi-tenant support.
 * 
 * Schema Alignment: Matches prisma/schema.prisma Order model (stripe_orders table)
 */

import type { Order, Customer, Price, Product, Subscription, Job } from '@prisma/client';
import type { OrderStatus, SubscriptionStatus, JobType, JobStatus } from '../../types/db-enums.js';

// ============================================
// ORDER STATUS CONSTANTS
// ============================================

export const ORDER_STATUSES = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
} as const;

// ============================================
// INPUT TYPES
// ============================================

/**
 * Input for creating a new order.
 * Supports both internal (admin) and webhook (marketing site) creation.
 */
export interface CreateOrderInput {
  /** Tenant ID - required for multi-tenant isolation */
  tenantId: string;
  /** Customer ID - optional for admin-generated orders */
  customerId?: string;
  /** Customer email - required if customerId not provided */
  customerEmail?: string;
  /** Customer name - used when creating new customer */
  customerName?: string;
  /** Customer phone */
  customerPhone?: string;
  /** Price ID (UUID) - for direct price reference */
  priceId?: string;
  /** Price slug - alternative to priceId */
  priceSlug?: string;
  /** Product code - for product lookup */
  productCode?: string;
  /** Order quantity */
  quantity?: number;
  /** Total amount in cents */
  totalAmountCents: number;
  /** Currency code */
  currency?: string;
  /** Stripe payment intent ID */
  stripePaymentIntentId?: string;
  /** Stripe checkout session ID */
  stripeSessionId?: string;
  /** External order ID (from other systems) */
  externalOrderId?: string;
  /** Additional metadata */
  metadata?: OrderMetadata;
  /** Optional notes */
  notes?: string;
}

/**
 * Input for webhook-based order creation (from marketing site).
 * Uses tenant slug and price slug for lookup.
 */
export interface CreateOrderFromWebhookInput {
  /** Tenant slug */
  tenantSlug: string;
  /** Customer info */
  customer: {
    email: string;
    fullName?: string;
    phone?: string;
  };
  /** Price slug */
  priceSlug: string;
  /** Total amount in cents */
  totalAmountCents: number;
  /** Currency */
  currency?: string;
  /** Stripe payment intent ID */
  stripePaymentIntentId?: string;
  /** Stripe session ID */
  stripeSessionId?: string;
  /** Metadata including domain */
  metadata?: OrderMetadata;
}

/**
 * Order metadata structure.
 */
export interface OrderMetadata {
  /** Domain for hosting orders */
  domain?: string;
  /** Notes */
  notes?: string;
  /** Provisioning type */
  provisioningType?: string;
  /** Source of order */
  source?: 'marketing_site' | 'admin_panel' | 'api' | 'stripe_webhook';
  /** Any additional fields */
  [key: string]: unknown;
}

/**
 * Input for processing an order payment.
 */
export interface ProcessOrderInput {
  /** Order ID */
  orderId: string;
  /** Tenant ID */
  tenantId: string;
  /** Stripe payment intent ID */
  stripePaymentIntentId?: string;
  /** Stripe session ID */
  stripeSessionId?: string;
  /** Processing notes */
  notes?: string;
}

/**
 * Input for cancelling an order.
 */
export interface CancelOrderInput {
  /** Order ID */
  orderId: string;
  /** Tenant ID */
  tenantId: string;
  /** Cancellation reason */
  reason?: string;
}

/**
 * Input for marking an order as failed.
 */
export interface FailOrderInput {
  /** Order ID */
  orderId: string;
  /** Tenant ID */
  tenantId: string;
  /** Failure reason */
  reason: string;
  /** Error details */
  errorDetails?: Record<string, unknown>;
}

// ============================================
// RESPONSE TYPES
// ============================================

/**
 * Job info in order response.
 */
export interface JobInfo {
  id: string;
  type: JobType;
  status: JobStatus;
}

/**
 * Response for order creation.
 */
export interface OrderCreateResponse {
  orderId: string;
  status: OrderStatus;
  subscriptionId?: string;
  customerId: string;
  totalAmountCents: number;
  currency: string;
  jobs: JobInfo[];
  createdAt: Date;
}

/**
 * Customer info in order response.
 */
export interface OrderCustomerInfo {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
}

/**
 * Product info in order response.
 */
export interface OrderProductInfo {
  id: string;
  name: string;
  type: string;
  code: string | null;
}

/**
 * Price info in order response.
 */
export interface OrderPriceInfo {
  id: string;
  name: string;
  slug: string;
  interval: string;
  amountCents: number;
  product: OrderProductInfo;
}

/**
 * Subscription info in order response.
 */
export interface OrderSubscriptionInfo {
  id: string;
  status: string;
  startedAt: Date;
  currentPeriodEnd: Date | null;
}

/**
 * Full order response with relations.
 */
export interface OrderWithRelations {
  id: string;
  tenantId: string;
  customerId: string;
  priceId: string | null;
  status: string;
  totalAmountCents: number;
  currency: string;
  stripePaymentIntentId: string | null;
  stripeSessionId: string | null;
  externalOrderId: string | null;
  metadata: OrderMetadata | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  customer: OrderCustomerInfo;
  price: OrderPriceInfo | null;
  subscription: OrderSubscriptionInfo | null;
  jobs: JobInfo[];
}

/**
 * Paginated orders response.
 */
export interface OrdersListResponse {
  orders: OrderWithRelations[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

/**
 * Single order response.
 */
export interface OrderResponse {
  order: OrderWithRelations;
}

// ============================================
// QUERY TYPES
// ============================================

/**
 * Options for listing orders.
 */
export interface ListOrdersOptions {
  /** Tenant ID (required) */
  tenantId: string;
  /** Filter by customer ID */
  customerId?: string;
  /** Filter by status (string or array of strings matching ORDER_STATUSES) */
  status?: string | string[];
  /** Start date filter */
  startDate?: Date;
  /** End date filter */
  endDate?: Date;
  /** Page number (1-indexed) */
  page?: number;
  /** Page size */
  pageSize?: number;
  /** Sort field */
  sortBy?: 'createdAt' | 'updatedAt' | 'totalAmountCents';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// AUDIT EVENT TYPES (for type safety)
// ============================================

export type OrderAuditEventType =
  | 'ORDER_CREATED'
  | 'ORDER_PAID'
  | 'ORDER_FAILED'
  | 'ORDER_CANCELLED'
  | 'ORDER_REFUNDED';

// ============================================
// RE-EXPORTS FOR CONVENIENCE
// ============================================

export type { Order, Customer, Price, Product, Subscription, Job };
export { OrderStatus, SubscriptionStatus, JobType, JobStatus };
