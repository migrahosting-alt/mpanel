import { ProductType, PriceInterval } from '@prisma/client';

export interface ProductWithPrices {
  id: string;
  name: string;
  slug: string;
  type: ProductType;
  description: string | null;
  isActive: boolean;
  prices: PriceInfo[];
}

export interface PriceInfo {
  id: string;
  name: string;
  slug: string;
  interval: PriceInterval;
  amountCents: number;
  currency: string;
  isPopular: boolean;
  isActive: boolean;
  limitsJson: any;
  stripeProductId: string | null;
  stripePriceId: string | null;
}

export interface CreateProductRequest {
  name: string;
  slug: string;
  type: ProductType;
  description?: string;
  tenantId: string;
}

export interface CreatePriceRequest {
  productId: string;
  name: string;
  slug: string;
  interval: PriceInterval;
  amountCents: number;
  currency?: string;
  isPopular?: boolean;
  limitsJson?: any;
  stripeProductId?: string;
  stripePriceId?: string;
  tenantId: string;
}

export interface UpdateProductRequest {
  name?: string;
  slug?: string;
  type?: ProductType;
  description?: string;
  isActive?: boolean;
}

export interface UpdatePriceRequest {
  name?: string;
  slug?: string;
  interval?: PriceInterval;
  amountCents?: number;
  currency?: string;
  isPopular?: boolean;
  limitsJson?: any;
  isActive?: boolean;
  stripeProductId?: string;
  stripePriceId?: string;
}
