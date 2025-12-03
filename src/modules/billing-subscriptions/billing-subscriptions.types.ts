/**
 * BILLING SUBSCRIPTIONS Types
 * Recurring service management with CloudPod integration
 */

export enum SubscriptionStatus {
  PENDING_ACTIVATION = 'PENDING_ACTIVATION',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED',
}

export enum BillingPeriod {
  NONE = 'NONE',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
  HOURLY = 'HOURLY',
}

export interface Subscription {
  id: string;
  tenantId: string;
  productId: string;
  externalRef: string | null; // CloudPod ID, VM ID, etc
  planCode: string;
  status: SubscriptionStatus;
  startDate: Date | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  billingPeriod: BillingPeriod;
  quantity: number;
  currency: string;
  pricePerUnit: number;
  discountPercent: number;
  discountAmount: number;
  nextBillingDate: Date | null;
  cancelAt: Date | null;
  cancelledAt: Date | null;
  autoRenew: boolean;
  trialEndsAt: Date | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
  createdById: string | null;
  updatedById: string | null;
}

export interface SubscriptionAddon {
  id: string;
  subscriptionId: string;
  productId: string;
  quantity: number;
  pricePerUnit: number;
  addedAt: Date;
  removedAt: Date | null;
  metadata: Record<string, any> | null;
}

export interface UsageRecord {
  id: string;
  subscriptionId: string;
  metricName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  recordedAt: Date;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  metadata: Record<string, any> | null;
  createdAt: Date;
}

export interface CreateSubscriptionRequest {
  tenantId: string;
  productId: string;
  planCode: string;
  quantity?: number;
  billingPeriod: BillingPeriod;
  autoRenew?: boolean;
  startDate?: Date;
  trialDays?: number;
  metadata?: Record<string, any>;
  cloudPodConfig?: {
    name: string;
    region: string;
    initialDomain?: string;
  };
}

export interface UpdateSubscriptionRequest {
  quantity?: number;
  autoRenew?: boolean;
  metadata?: Record<string, any>;
}

export interface CancelSubscriptionRequest {
  cancelAt: 'IMMEDIATE' | 'END_OF_TERM';
  reason?: string;
}

export interface RecordUsageRequest {
  metricName: string;
  quantity: number;
  unitPrice?: number;
  timestamp?: Date;
  metadata?: Record<string, any>;
}
