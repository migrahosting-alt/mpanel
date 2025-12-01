/**
 * Database Enum Types (String Unions)
 * 
 * The Prisma schema uses varchar columns (not native enums) for flexibility
 * with legacy JS code. These TypeScript string unions provide type safety
 * while allowing the DB to store plain strings.
 * 
 * NOTE: Do NOT import these from '@prisma/client' - they don't exist there.
 */

// ============================================
// USER & AUTH
// ============================================

/** User roles for RBAC */
export type UserRole = 
  | 'super_admin'
  | 'admin'
  | 'support'
  | 'billing'
  | 'read_only'
  | 'customer'
  | 'ADMIN'    // Legacy uppercase
  | 'CUSTOMER' // Legacy uppercase
  | 'SUPER_ADMIN';

export const UserRole = {
  SUPER_ADMIN: 'super_admin' as UserRole,
  ADMIN: 'admin' as UserRole,
  SUPPORT: 'support' as UserRole,
  BILLING: 'billing' as UserRole,
  READ_ONLY: 'read_only' as UserRole,
  CUSTOMER: 'customer' as UserRole,
} as const;

// ============================================
// PRODUCTS & PRICING
// ============================================

/** Product types */
export type ProductType =
  | 'SHARED_HOSTING'
  | 'VPS'
  | 'CLOUD_POD'
  | 'DOMAIN'
  | 'ADDON'
  | 'SERVICE';

export const ProductType = {
  SHARED_HOSTING: 'SHARED_HOSTING' as ProductType,
  VPS: 'VPS' as ProductType,
  CLOUD_POD: 'CLOUD_POD' as ProductType,
  DOMAIN: 'DOMAIN' as ProductType,
  ADDON: 'ADDON' as ProductType,
  SERVICE: 'SERVICE' as ProductType,
} as const;

/** Price billing intervals */
export type PriceInterval =
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'SEMI_ANNUALLY'
  | 'YEARLY'
  | 'BIENNIALLY'
  | 'TRIENNIALLY'
  | 'ONE_TIME';

export const PriceInterval = {
  MONTHLY: 'MONTHLY' as PriceInterval,
  QUARTERLY: 'QUARTERLY' as PriceInterval,
  SEMI_ANNUALLY: 'SEMI_ANNUALLY' as PriceInterval,
  YEARLY: 'YEARLY' as PriceInterval,
  BIENNIALLY: 'BIENNIALLY' as PriceInterval,
  TRIENNIALLY: 'TRIENNIALLY' as PriceInterval,
  ONE_TIME: 'ONE_TIME' as PriceInterval,
} as const;

// ============================================
// ORDERS & SUBSCRIPTIONS
// ============================================

/** Order status */
export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'FAILED';

export const OrderStatus = {
  PENDING: 'PENDING' as OrderStatus,
  PAID: 'PAID' as OrderStatus,
  CANCELLED: 'CANCELLED' as OrderStatus,
  REFUNDED: 'REFUNDED' as OrderStatus,
  FAILED: 'FAILED' as OrderStatus,
} as const;

/** Subscription status */
export type SubscriptionStatus =
  | 'INACTIVE'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELLED'
  | 'SUSPENDED'
  | 'EXPIRED';

export const SubscriptionStatus = {
  INACTIVE: 'INACTIVE' as SubscriptionStatus,
  ACTIVE: 'ACTIVE' as SubscriptionStatus,
  PAST_DUE: 'PAST_DUE' as SubscriptionStatus,
  CANCELLED: 'CANCELLED' as SubscriptionStatus,
  SUSPENDED: 'SUSPENDED' as SubscriptionStatus,
  EXPIRED: 'EXPIRED' as SubscriptionStatus,
} as const;

// ============================================
// JOBS & PROVISIONING
// ============================================

/** Job types for provisioning */
export type JobType =
  | 'PROVISION_DNS'
  | 'PROVISION_HOSTING'
  | 'PROVISION_MAIL'
  | 'PROVISION_VPS'
  | 'PROVISION_CLOUDPOD'
  | 'BACKUP'
  | 'RESTORE'
  | 'MAINTENANCE';

export const JobType = {
  PROVISION_DNS: 'PROVISION_DNS' as JobType,
  PROVISION_HOSTING: 'PROVISION_HOSTING' as JobType,
  PROVISION_MAIL: 'PROVISION_MAIL' as JobType,
  PROVISION_VPS: 'PROVISION_VPS' as JobType,
  PROVISION_CLOUDPOD: 'PROVISION_CLOUDPOD' as JobType,
  BACKUP: 'BACKUP' as JobType,
  RESTORE: 'RESTORE' as JobType,
  MAINTENANCE: 'MAINTENANCE' as JobType,
} as const;

/** Job status */
export type JobStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED'
  | 'DEAD';

export const JobStatus = {
  PENDING: 'PENDING' as JobStatus,
  RUNNING: 'RUNNING' as JobStatus,
  SUCCESS: 'SUCCESS' as JobStatus,
  FAILED: 'FAILED' as JobStatus,
  DEAD: 'DEAD' as JobStatus,
} as const;

// ============================================
// DOMAINS
// ============================================

/** Domain status */
export type DomainStatus =
  | 'PENDING_SETUP'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'SUSPENDED'
  | 'TRANSFERRED';

export const DomainStatus = {
  PENDING_SETUP: 'PENDING_SETUP' as DomainStatus,
  ACTIVE: 'ACTIVE' as DomainStatus,
  EXPIRED: 'EXPIRED' as DomainStatus,
  SUSPENDED: 'SUSPENDED' as DomainStatus,
  TRANSFERRED: 'TRANSFERRED' as DomainStatus,
} as const;
