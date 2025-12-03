/**
 * BILLING PRODUCTS Types
 * Central catalog of sellable items (CloudPods, add-ons, email, domains, etc.)
 */

export enum ProductCategory {
  CLOUDPOD = 'CLOUDPOD',
  ADDON = 'ADDON',
  EMAIL = 'EMAIL',
  DOMAIN = 'DOMAIN',
  SECURITY = 'SECURITY',
  BACKUP = 'BACKUP',
  SUPPORT = 'SUPPORT',
  OTHER = 'OTHER',
}

export enum BillingModel {
  ONE_TIME = 'ONE_TIME',
  RECURRING = 'RECURRING',
  USAGE_BASED = 'USAGE_BASED',
  USAGE_TIERED = 'USAGE_TIERED',
}

export enum BillingPeriod {
  NONE = 'NONE',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
  HOURLY = 'HOURLY',
}

export enum ProductStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DEPRECATED = 'DEPRECATED',
}

export enum ProductVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  BETA = 'BETA',
}

export interface Product {
  id: string;
  tenantId: string | null; // null = global catalog
  code: string; // CLOUDPOD_CORE_S, WP_ADDON_PRO
  name: string;
  description: string | null;
  category: ProductCategory;
  billingModel: BillingModel;
  billingPeriod: BillingPeriod | null;
  basePrice: number; // Decimal in DB
  currency: string; // USD, EUR
  status: ProductStatus;
  visibility: ProductVisibility;
  metadata: Record<string, any> | null;
  limits: Record<string, any> | null; // cpu/ram/disk/websites
  isBundle: boolean;
  allowedRegions: string[];
  setupFee: number | null;
  trialDays: number | null;
  sortOrder: number;
  stripePriceId: string | null;
  whmcsProductId: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  updatedById: string | null;
}

export interface ProductFeature {
  id: string;
  productId: string;
  name: string;
  value: string | null;
  displayOrder: number;
  isHighlight: boolean;
  createdAt: Date;
  sortOrder: number;
}

export interface ProductBundle {
  id: string;
  parentProductId: string;
  childProductId: string;
  quantity: number;
  discountPercent: number;
  isRequired: boolean;
  createdAt: Date;
}

export interface PriceOverride {
  id: string;
  productId: string;
  tenantId: string | null;
  region: string | null;
  currency: string | null;
  billingPeriod: BillingPeriod | null;
  overridePrice: number;
  validFrom: Date | null;
  validUntil: Date | null;
  reason: string | null;
  createdBy: string | null;
  createdAt: Date;
  status: string; // ACTIVE, PLANNED, EXPIRED
}

export interface CreateProductRequest {
  code: string;
  name: string;
  description?: string;
  category: ProductCategory;
  billingModel: BillingModel;
  billingPeriod?: BillingPeriod;
  basePrice: number;
  currency?: string;
  visibility?: ProductVisibility;
  metadata?: Record<string, any>;
  limits?: Record<string, any>;
  allowedRegions?: string[];
  setupFee?: number;
  trialDays?: number;
  stripePriceId?: string;
  whmcsProductId?: string;
}

export interface UpdateProductRequest {
  name?: string;
  description?: string;
  basePrice?: number;
  status?: ProductStatus;
  visibility?: ProductVisibility;
  metadata?: Record<string, any>;
  limits?: Record<string, any>;
  setupFee?: number;
  trialDays?: number;
}

export interface ProductPricingRequest {
  tenantId?: string;
  region?: string;
  currency?: string;
  billingPeriod?: BillingPeriod;
}

export interface ProductPricingResponse {
  productId: string;
  effectivePrice: number;
  currency: string;
  billingPeriod: BillingPeriod | null;
  hasOverride: boolean;
  setupFee: number;
  trialDays: number;
  breakdown: {
    basePrice: number;
    overridePrice: number | null;
    finalPrice: number;
  };
}
