/**
 * BILLING PRODUCTS Service
 * Product catalog management with pricing resolution
 */

import prisma from '../../config/database.js';
import logger from '../../config/logger.js';
import type {
  Product,
  ProductFeature,
  ProductBundle,
  PriceOverride,
  CreateProductRequest,
  UpdateProductRequest,
  ProductPricingRequest,
  ProductPricingResponse,
  ProductCategory,
  ProductStatus,
  ProductVisibility,
} from './billing-products.types.js';

export async function listProducts(filters: {
  search?: string;
  category?: ProductCategory;
  status?: ProductStatus;
  visibility?: ProductVisibility;
  billingModel?: string;
  tenantId?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: Product[]; total: number }> {
  const {
    search,
    category,
    status,
    visibility,
    billingModel,
    tenantId,
    page = 1,
    pageSize = 50,
  } = filters;

  const where: any = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (category) where.category = category;
  if (status) where.status = status;
  if (visibility) where.visibility = visibility;
  if (billingModel) where.billingModel = billingModel;
  if (tenantId) where.OR = [{ tenantId }, { tenantId: null }]; // global + tenant-specific

  try {
    // @ts-ignore
    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.product.count({ where }),
    ]);

    return { items, total };
  } catch (error) {
    logger.error('Failed to list products', { error });
    return { items: [], total: 0 };
  }
}

export async function getProductById(id: string): Promise<Product | null> {
  try {
    // @ts-ignore
    const product = await prisma.product.findFirst({
      where: { id },
    });
    return product;
  } catch {
    return null;
  }
}

export async function getProductByCode(code: string): Promise<Product | null> {
  try {
    // @ts-ignore
    const product = await prisma.product.findFirst({
      where: { code },
    });
    return product;
  } catch {
    return null;
  }
}

export async function createProduct(
  data: CreateProductRequest,
  actorId: string
): Promise<Product> {
  const {
    code,
    name,
    description,
    category,
    billingModel,
    billingPeriod,
    basePrice,
    currency = 'USD',
    visibility = 'PUBLIC',
    metadata,
    limits,
    allowedRegions = [],
    setupFee,
    trialDays,
    stripePriceId,
    whmcsProductId,
  } = data;

  // Validate code uniqueness
  const existing = await getProductByCode(code);
  if (existing) {
    throw new Error(`Product with code ${code} already exists`);
  }

  // @ts-ignore
  const product = await prisma.product.create({
    data: {
      tenantId: null, // Global catalog
      code,
      name,
      description: description || null,
      category,
      billingModel,
      billingPeriod: billingPeriod || null,
      basePrice,
      currency,
      status: 'ACTIVE',
      visibility,
      metadata: metadata || null,
      limits: limits || null,
      isBundle: false,
      allowedRegions,
      setupFee: setupFee || null,
      trialDays: trialDays || null,
      sortOrder: 0,
      stripePriceId: stripePriceId || null,
      whmcsProductId: whmcsProductId || null,
      createdBy: actorId,
      updatedById: null,
    },
  });

  logger.info('Product created', { productId: product.id, code });

  return product;
}

export async function updateProduct(
  id: string,
  data: UpdateProductRequest,
  actorId: string
): Promise<Product> {
  const product = await getProductById(id);
  if (!product) {
    throw new Error('Product not found');
  }

  // @ts-ignore
  const updated = await prisma.product.update({
    where: { id },
    data: {
      ...data,
      updatedById: actorId,
    },
  });

  logger.info('Product updated', { productId: id, changes: Object.keys(data) });

  return updated;
}

export async function resolveProductPricing(
  productId: string,
  params: ProductPricingRequest
): Promise<ProductPricingResponse> {
  const product = await getProductById(productId);
  if (!product) {
    throw new Error('Product not found');
  }

  const { tenantId, region, currency, billingPeriod } = params;

  // Find applicable price override
  const where: any = {
    productId,
    status: 'ACTIVE',
  };

  if (tenantId) where.OR = [{ tenantId }, { tenantId: null }];
  if (region) where.OR = [...(where.OR || []), { region }, { region: null }];
  if (currency) where.currency = currency;
  if (billingPeriod) where.billingPeriod = billingPeriod;

  let priceOverride: PriceOverride | null = null;
  try {
    // @ts-ignore
    priceOverride = await prisma.priceOverride.findFirst({
      where,
      orderBy: [
        { tenantId: 'desc' }, // Tenant-specific first
        { region: 'desc' }, // Region-specific next
        { createdAt: 'desc' },
      ],
    });
  } catch {}

  const effectivePrice = priceOverride?.overridePrice ?? product.basePrice;

  return {
    productId: product.id,
    effectivePrice,
    currency: currency || product.currency,
    billingPeriod: billingPeriod || product.billingPeriod,
    hasOverride: !!priceOverride,
    setupFee: product.setupFee || 0,
    trialDays: product.trialDays || 0,
    breakdown: {
      basePrice: product.basePrice,
      overridePrice: priceOverride?.overridePrice || null,
      finalPrice: effectivePrice,
    },
  };
}

export async function getPublicCatalog(): Promise<Product[]> {
  try {
    // @ts-ignore
    const products = await prisma.product.findMany({
      where: {
        visibility: 'PUBLIC',
        status: 'ACTIVE',
        tenantId: null, // Only global products
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return products;
  } catch {
    return [];
  }
}

export async function getProductFeatures(productId: string): Promise<ProductFeature[]> {
  try {
    // @ts-ignore
    const features = await prisma.productFeature.findMany({
      where: { productId },
      orderBy: [{ sortOrder: 'asc' }, { displayOrder: 'asc' }],
    });
    return features;
  } catch {
    return [];
  }
}

export async function getProductBundles(productId: string): Promise<ProductBundle[]> {
  try {
    // @ts-ignore
    const bundles = await prisma.productBundle.findMany({
      where: { parentProductId: productId },
    });
    return bundles;
  } catch {
    return [];
  }
}
