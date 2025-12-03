/**
 * ENTERPRISE API MARKETPLACE Types
 * Catalog of internal/external API subscriptions
 */

export enum ApiType {
  INTERNAL = 'INTERNAL',
  EXTERNAL = 'EXTERNAL',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
}

export interface ApiListing {
  id: string;
  name: string;
  description: string;
  type: ApiType;
  baseUrl: string;
  pricing: {
    model: 'free' | 'usage' | 'subscription';
    pricePerRequest?: number;
    monthlyFee?: number;
  };
  documentation: string | null;
  createdAt: Date;
}

export interface ApiSubscription {
  id: string;
  tenantId: string;
  listingId: string;
  status: SubscriptionStatus;
  apiKey: string | null;
  usageThisMonth: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscribeToApiRequest {
  listingId: string;
}
