/**
 * Products Module Types - Enterprise-grade product & pricing management
 * 
 * Aligned with:
 * - Prisma schema (Product, Price models)
 * - Multi-tenant billing model
 * - Marketing site pricing API
 * - CloudPods provisioning flow
 * 
 * Products are GLOBAL (not per-tenant) but visibility controlled by isActive.
 */

import type { Product, Price } from '@prisma/client';

// ============================================
// PRODUCT TYPE CONSTANTS
// ============================================

export const PRODUCT_TYPES = {
  SHARED_HOSTING: 'SHARED_HOSTING',
  VPS: 'VPS',
  CLOUD_POD: 'CLOUD_POD',
  DOMAIN: 'DOMAIN',
  SSL: 'SSL',
  EMAIL: 'EMAIL',
  ADDON: 'ADDON',
  SERVICE: 'SERVICE',
} as const;

export type ProductType = (typeof PRODUCT_TYPES)[keyof typeof PRODUCT_TYPES];

export const BILLING_INTERVALS = {
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  SEMI_ANNUALLY: 'SEMI_ANNUALLY',
  YEARLY: 'YEARLY',
  BIENNIALLY: 'BIENNIALLY',
  TRIENNIALLY: 'TRIENNIALLY',
  ONE_TIME: 'ONE_TIME',
} as const;

export type BillingInterval = (typeof BILLING_INTERVALS)[keyof typeof BILLING_INTERVALS];

// ============================================
// INPUT TYPES
// ============================================

/**
 * Input for creating a new product.
 */
export interface CreateProductInput {
  /** Unique product code (e.g., 'cloudpod-starter') */
  code: string;
  /** Display name */
  name: string;
  /** Product description */
  description?: string;
  /** Product type */
  type: ProductType;
  /** Product slug for URLs */
  slug: string;
  /** Tenant ID (for tenant-specific products) */
  tenantId: string;
  /** Product metadata (features, limits, etc.) */
  metadata?: ProductMetadata;
}

/**
 * Input for updating a product.
 */
export interface UpdateProductInput {
  /** Display name */
  name?: string;
  /** Product description */
  description?: string;
  /** Product type */
  type?: ProductType;
  /** Product slug */
  slug?: string;
  /** Active status */
  isActive?: boolean;
  /** Product metadata */
  metadata?: ProductMetadata;
}

/**
 * Input for creating a price.
 */
export interface CreatePriceInput {
  /** Associated product ID */
  productId: string;
  /** Price name (e.g., 'Starter Monthly') */
  name: string;
  /** Price slug for URLs */
  slug: string;
  /** Billing interval */
  interval: BillingInterval;
  /** Amount in cents */
  amountCents: number;
  /** Currency code */
  currency?: string;
  /** Whether this is the popular/recommended price */
  isPopular?: boolean;
  /** Plan limits (storage, bandwidth, etc.) */
  limitsJson?: PriceLimits;
  /** Stripe product ID */
  stripeProductId?: string;
  /** Stripe price ID */
  stripePriceId?: string;
  /** Tenant ID */
  tenantId?: string;
}

/**
 * Input for updating a price.
 */
export interface UpdatePriceInput {
  /** Price name */
  name?: string;
  /** Price slug */
  slug?: string;
  /** Billing interval */
  interval?: BillingInterval;
  /** Amount in cents */
  amountCents?: number;
  /** Currency code */
  currency?: string;
  /** Popular flag */
  isPopular?: boolean;
  /** Active status */
  isActive?: boolean;
  /** Plan limits */
  limitsJson?: PriceLimits;
  /** Stripe product ID */
  stripeProductId?: string;
  /** Stripe price ID */
  stripePriceId?: string;
}

// ============================================
// METADATA TYPES
// ============================================

/**
 * Product metadata structure.
 */
export interface ProductMetadata {
  /** Product features list */
  features?: string[];
  /** Product category */
  category?: string;
  /** Display order */
  displayOrder?: number;
  /** Icon name or URL */
  icon?: string;
  /** Badge text (e.g., 'NEW', 'POPULAR') */
  badge?: string;
  /** Additional config */
  [key: string]: unknown;
}

/**
 * Price limits structure for hosting plans.
 */
export interface PriceLimits {
  /** Storage in MB */
  storageMb?: number;
  /** Bandwidth in MB per month */
  bandwidthMb?: number;
  /** Number of domains allowed */
  domains?: number;
  /** Number of email accounts */
  emails?: number;
  /** Number of databases */
  databases?: number;
  /** Number of FTP accounts */
  ftpAccounts?: number;
  /** Number of subdomains */
  subdomains?: number;
  /** Number of cron jobs */
  cronJobs?: number;
  /** Number of SSL certificates */
  sslCerts?: number;
  /** Whether SSH access is allowed */
  sshAccess?: boolean;
  /** Whether Node.js is supported */
  nodejs?: boolean;
  /** Whether Python is supported */
  python?: boolean;
  /** CPU cores (for VPS/CloudPod) */
  cpuCores?: number;
  /** RAM in MB (for VPS/CloudPod) */
  ramMb?: number;
  /** Additional limits */
  [key: string]: unknown;
}

// ============================================
// RESPONSE TYPES
// ============================================

/**
 * Price info in product response.
 */
export interface PriceInfo {
  id: string;
  name: string;
  slug: string;
  interval: string;
  amountCents: number;
  currency: string;
  isPopular: boolean;
  isActive: boolean;
  limitsJson: PriceLimits | null;
  stripeProductId: string | null;
  stripePriceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Product with prices response.
 */
export interface ProductWithPrices {
  id: string;
  tenantId: string;
  code: string | null;
  name: string;
  slug: string;
  type: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  prices: PriceInfo[];
}

/**
 * Product response for API.
 */
export interface ProductResponse {
  product: ProductWithPrices;
}

/**
 * Products list response.
 */
export interface ProductsListResponse {
  products: ProductWithPrices[];
  meta?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

/**
 * Plan pricing response (for marketing site).
 */
export interface PlanPricingResponse {
  code: string;
  name: string;
  description: string | null;
  type: string;
  prices: {
    interval: string;
    amountCents: number;
    currency: string;
    slug: string;
    isPopular: boolean;
    limits: PriceLimits | null;
  }[];
}

// ============================================
// QUERY TYPES
// ============================================

/**
 * Options for listing products.
 */
export interface ListProductsOptions {
  /** Filter by product type */
  type?: ProductType;
  /** Filter by active status */
  isActive?: boolean;
  /** Include inactive products */
  includeInactive?: boolean;
  /** Page number */
  page?: number;
  /** Page size */
  pageSize?: number;
  /** Sort field */
  sortBy?: 'name' | 'createdAt' | 'type';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Validation result for order.
 */
export interface ProductValidationResult {
  valid: boolean;
  product?: ProductWithPrices;
  price?: PriceInfo;
  error?: string;
}

// ============================================
// AUDIT EVENT TYPES
// ============================================

export type ProductAuditEventType =
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_DELETED'
  | 'PRICE_CREATED'
  | 'PRICE_UPDATED'
  | 'PRICE_DELETED';

// ============================================
// RE-EXPORTS
// ============================================

export type { Product, Price };
