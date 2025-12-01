/**
 * Products Service - Enterprise-grade Product & Pricing Management
 * 
 * Aligned with:
 * - Prisma schema (Product, Price models)
 * - Multi-tenant billing model (products are global, visibility by isActive)
 * - Marketing site pricing API
 * - CloudPods provisioning flow
 * - Stripe integration
 * 
 * Key methods:
 * - listProducts: List all products (with filters)
 * - getProductByCode: Get product by unique code
 * - getProductBySlug: Get product by URL slug
 * - getPlanPricing: Get pricing info for marketing site
 * - validateProductForOrder: Validate product/price for order creation
 * - createProduct, updateProduct, deleteProduct: Admin CRUD
 * - createPrice, updatePrice, deletePrice: Price management
 */

import { prisma } from '../../config/database.js';
import { Prisma } from '@prisma/client';
import { writeAuditEvent } from '../security/auditService.js';
import logger from '../../config/logger.js';
import type {
  CreateProductInput,
  UpdateProductInput,
  CreatePriceInput,
  UpdatePriceInput,
  ListProductsOptions,
  ProductWithPrices,
  ProductsListResponse,
  PlanPricingResponse,
  ProductValidationResult,
  PriceInfo,
  PriceLimits,
} from './products.types.js';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Standard includes for product queries.
 */
const productIncludes = {
  prices: {
    orderBy: [
      { isPopular: 'desc' as const },
      { amountCents: 'asc' as const },
    ],
  },
};

/**
 * Build product response with proper typing.
 */
function buildProductResponse(product: any): ProductWithPrices {
  return {
    id: product.id,
    tenantId: product.tenantId,
    code: product.code,
    name: product.name,
    slug: product.slug,
    type: product.type,
    description: product.description,
    isActive: product.isActive,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    prices: (product.prices ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      interval: p.interval,
      amountCents: p.amountCents,
      currency: p.currency,
      isPopular: p.isPopular,
      isActive: p.isActive,
      limitsJson: p.limitsJson as PriceLimits | null,
      stripeProductId: p.stripeProductId,
      stripePriceId: p.stripePriceId,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
  };
}

// ============================================
// PRODUCTS SERVICE CLASS
// ============================================

export class ProductsService {
  // ============================================
  // PUBLIC METHODS
  // ============================================

  /**
   * List all products with optional filters.
   * Public products are those with isActive=true.
   */
  async listProducts(options: ListProductsOptions = {}): Promise<ProductsListResponse> {
    const {
      type,
      isActive,
      includeInactive = false,
      page = 1,
      pageSize = 50,
      sortBy = 'createdAt',
      sortOrder = 'asc',
    } = options;

    // Build where clause
    const where: Prisma.ProductWhereInput = {};

    if (type) {
      where.type = type;
    }

    if (!includeInactive) {
      where.isActive = isActive ?? true;
    } else if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // Get total count
    const total = await prisma.product.count({ where });

    // Get products with prices
    const products = await prisma.product.findMany({
      where,
      include: {
        prices: {
          where: includeInactive ? undefined : { isActive: true },
          orderBy: [{ isPopular: 'desc' }, { amountCents: 'asc' }],
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      products: products.map(buildProductResponse),
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Get product by unique code.
   */
  async getProductByCode(code: string): Promise<ProductWithPrices | null> {
    const product = await prisma.product.findUnique({
      where: { code },
      include: {
        prices: {
          where: { isActive: true },
          orderBy: [{ isPopular: 'desc' }, { amountCents: 'asc' }],
        },
      },
    });

    if (!product) {
      return null;
    }

    return buildProductResponse(product);
  }

  /**
   * Get product by slug.
   */
  async getProductBySlug(slug: string): Promise<ProductWithPrices | null> {
    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        prices: {
          where: { isActive: true },
          orderBy: [{ isPopular: 'desc' }, { amountCents: 'asc' }],
        },
      },
    });

    if (!product) {
      return null;
    }

    return buildProductResponse(product);
  }

  /**
   * Get product by ID.
   */
  async getProductById(
    productId: string,
    tenantId?: string
  ): Promise<ProductWithPrices | null> {
    const where: Prisma.ProductWhereInput = { id: productId };
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const product = await prisma.product.findFirst({
      where,
      include: productIncludes,
    });

    if (!product) {
      return null;
    }

    return buildProductResponse(product);
  }

  /**
   * Get pricing info for a plan (for marketing site).
   */
  async getPlanPricing(planCode: string): Promise<PlanPricingResponse | null> {
    const product = await this.getProductByCode(planCode);

    if (!product || !product.isActive) {
      return null;
    }

    return {
      code: product.code ?? planCode,
      name: product.name,
      description: product.description,
      type: product.type,
      prices: product.prices
        .filter((p) => p.isActive)
        .map((p) => ({
          interval: p.interval,
          amountCents: p.amountCents,
          currency: p.currency,
          slug: p.slug,
          isPopular: p.isPopular,
          limits: p.limitsJson,
        })),
    };
  }

  /**
   * Validate product and price for order creation.
   */
  async validateProductForOrder(
    code: string,
    billingInterval: string
  ): Promise<ProductValidationResult> {
    const product = await this.getProductByCode(code);

    if (!product) {
      return { valid: false, error: `Product not found: ${code}` };
    }

    if (!product.isActive) {
      return { valid: false, error: `Product is inactive: ${code}` };
    }

    // Find matching price by interval
    const price = product.prices.find(
      (p) => p.interval.toUpperCase() === billingInterval.toUpperCase() && p.isActive
    );

    if (!price) {
      return {
        valid: false,
        error: `No active price found for interval: ${billingInterval}`,
      };
    }

    return {
      valid: true,
      product,
      price,
    };
  }

  /**
   * Get price by slug.
   */
  async getPriceBySlug(slug: string): Promise<PriceInfo | null> {
    const price = await prisma.price.findUnique({
      where: { slug },
      include: { product: true },
    });

    if (!price) {
      return null;
    }

    return {
      id: price.id,
      name: price.name,
      slug: price.slug,
      interval: price.interval,
      amountCents: price.amountCents,
      currency: price.currency,
      isPopular: price.isPopular,
      isActive: price.isActive,
      limitsJson: price.limitsJson as PriceLimits | null,
      stripeProductId: price.stripeProductId,
      stripePriceId: price.stripePriceId,
      createdAt: price.createdAt,
      updatedAt: price.updatedAt,
    };
  }

  /**
   * Get price by ID.
   */
  async getPriceById(priceId: string): Promise<PriceInfo | null> {
    const price = await prisma.price.findUnique({
      where: { id: priceId },
    });

    if (!price) {
      return null;
    }

    return {
      id: price.id,
      name: price.name,
      slug: price.slug,
      interval: price.interval,
      amountCents: price.amountCents,
      currency: price.currency,
      isPopular: price.isPopular,
      isActive: price.isActive,
      limitsJson: price.limitsJson as PriceLimits | null,
      stripeProductId: price.stripeProductId,
      stripePriceId: price.stripePriceId,
      createdAt: price.createdAt,
      updatedAt: price.updatedAt,
    };
  }

  // ============================================
  // ADMIN METHODS
  // ============================================

  /**
   * Create a new product.
   * Requires ADMIN+ role.
   */
  async createProduct(
    input: CreateProductInput,
    actorUserId: string
  ): Promise<ProductWithPrices> {
    const { code, name, slug, type, description, tenantId, metadata } = input;

    logger.info('Creating product', { code, name, type, tenantId });

    // Check for duplicate code or slug
    const existing = await prisma.product.findFirst({
      where: {
        OR: [{ code }, { slug }],
      },
    });

    if (existing) {
      if (existing.code === code) {
        throw new Error(`Product with code already exists: ${code}`);
      }
      throw new Error(`Product with slug already exists: ${slug}`);
    }

    const product = await prisma.product.create({
      data: {
        tenantId,
        code,
        name,
        slug,
        type,
        description: description ?? null,
        isActive: true,
      },
      include: productIncludes,
    });

    // Audit event
    await writeAuditEvent({
      actorUserId,
      tenantId,
      type: 'PRODUCT_CREATED',
      metadata: {
        productId: product.id,
        code,
        name,
        type,
      },
    });

    logger.info('Product created', { productId: product.id, code });

    return buildProductResponse(product);
  }

  /**
   * Update a product.
   * Requires ADMIN+ role.
   */
  async updateProduct(
    code: string,
    input: UpdateProductInput,
    actorUserId: string,
    tenantId: string
  ): Promise<ProductWithPrices> {
    logger.info('Updating product', { code, updates: Object.keys(input) });

    // Find product by code
    const existing = await prisma.product.findUnique({
      where: { code },
    });

    if (!existing) {
      throw new Error(`Product not found: ${code}`);
    }

    // Check slug uniqueness if changing
    if (input.slug && input.slug !== existing.slug) {
      const slugExists = await prisma.product.findUnique({
        where: { slug: input.slug },
      });
      if (slugExists) {
        throw new Error(`Slug already in use: ${input.slug}`);
      }
    }

    const product = await prisma.product.update({
      where: { code },
      data: {
        name: input.name,
        slug: input.slug,
        type: input.type,
        description: input.description,
        isActive: input.isActive,
      },
      include: productIncludes,
    });

    // Audit event
    await writeAuditEvent({
      actorUserId,
      tenantId,
      type: 'PRODUCT_UPDATED',
      metadata: {
        productId: product.id,
        code,
        changes: input,
      },
    });

    logger.info('Product updated', { productId: product.id, code });

    return buildProductResponse(product);
  }

  /**
   * Delete a product (soft delete - sets isActive=false).
   * Requires ADMIN+ role.
   */
  async deleteProduct(
    code: string,
    actorUserId: string,
    tenantId: string
  ): Promise<void> {
    logger.info('Deleting product', { code });

    const existing = await prisma.product.findUnique({
      where: { code },
    });

    if (!existing) {
      throw new Error(`Product not found: ${code}`);
    }

    await prisma.product.update({
      where: { code },
      data: { isActive: false },
    });

    // Also deactivate all prices
    await prisma.price.updateMany({
      where: { productId: existing.id },
      data: { isActive: false },
    });

    // Audit event
    await writeAuditEvent({
      actorUserId,
      tenantId,
      type: 'PRODUCT_DELETED',
      metadata: {
        productId: existing.id,
        code,
      },
    });

    logger.info('Product deleted', { productId: existing.id, code });
  }

  // ============================================
  // PRICE MANAGEMENT
  // ============================================

  /**
   * Create a new price for a product.
   * Requires ADMIN+ role.
   */
  async createPrice(
    input: CreatePriceInput,
    actorUserId: string,
    tenantId: string
  ): Promise<PriceInfo> {
    const {
      productId,
      name,
      slug,
      interval,
      amountCents,
      currency = 'usd',
      isPopular = false,
      limitsJson,
      stripeProductId,
      stripePriceId,
    } = input;

    logger.info('Creating price', { productId, name, slug, interval });

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error(`Product not found: ${productId}`);
    }

    // Check slug uniqueness
    const slugExists = await prisma.price.findUnique({
      where: { slug },
    });

    if (slugExists) {
      throw new Error(`Price slug already exists: ${slug}`);
    }

    const price = await prisma.price.create({
      data: {
        productId,
        tenantId: tenantId ?? null,
        name,
        slug,
        interval,
        amountCents,
        currency,
        isPopular,
        isActive: true,
        limitsJson: limitsJson ? (limitsJson as Prisma.InputJsonValue) : Prisma.JsonNull,
        stripeProductId: stripeProductId ?? null,
        stripePriceId: stripePriceId ?? null,
      },
    });

    // Audit event
    await writeAuditEvent({
      actorUserId,
      tenantId,
      type: 'PRICE_CREATED',
      metadata: {
        priceId: price.id,
        productId,
        slug,
        interval,
        amountCents,
      },
    });

    logger.info('Price created', { priceId: price.id, slug });

    return {
      id: price.id,
      name: price.name,
      slug: price.slug,
      interval: price.interval,
      amountCents: price.amountCents,
      currency: price.currency,
      isPopular: price.isPopular,
      isActive: price.isActive,
      limitsJson: price.limitsJson as PriceLimits | null,
      stripeProductId: price.stripeProductId,
      stripePriceId: price.stripePriceId,
      createdAt: price.createdAt,
      updatedAt: price.updatedAt,
    };
  }

  /**
   * Update a price.
   * Requires ADMIN+ role.
   */
  async updatePrice(
    priceId: string,
    input: UpdatePriceInput,
    actorUserId: string,
    tenantId: string
  ): Promise<PriceInfo> {
    logger.info('Updating price', { priceId, updates: Object.keys(input) });

    const existing = await prisma.price.findUnique({
      where: { id: priceId },
    });

    if (!existing) {
      throw new Error(`Price not found: ${priceId}`);
    }

    // Check slug uniqueness if changing
    if (input.slug && input.slug !== existing.slug) {
      const slugExists = await prisma.price.findUnique({
        where: { slug: input.slug },
      });
      if (slugExists) {
        throw new Error(`Slug already in use: ${input.slug}`);
      }
    }

    const updateData: Prisma.PriceUpdateInput = {
      name: input.name,
      slug: input.slug,
      interval: input.interval,
      amountCents: input.amountCents,
      currency: input.currency,
      isPopular: input.isPopular,
      isActive: input.isActive,
      stripeProductId: input.stripeProductId,
      stripePriceId: input.stripePriceId,
    };

    if (input.limitsJson !== undefined) {
      updateData.limitsJson = input.limitsJson
        ? (input.limitsJson as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }

    const price = await prisma.price.update({
      where: { id: priceId },
      data: updateData,
    });

    // Audit event
    await writeAuditEvent({
      actorUserId,
      tenantId,
      type: 'PRICE_UPDATED',
      metadata: {
        priceId,
        changes: input,
      },
    });

    logger.info('Price updated', { priceId });

    return {
      id: price.id,
      name: price.name,
      slug: price.slug,
      interval: price.interval,
      amountCents: price.amountCents,
      currency: price.currency,
      isPopular: price.isPopular,
      isActive: price.isActive,
      limitsJson: price.limitsJson as PriceLimits | null,
      stripeProductId: price.stripeProductId,
      stripePriceId: price.stripePriceId,
      createdAt: price.createdAt,
      updatedAt: price.updatedAt,
    };
  }

  /**
   * Delete a price (soft delete).
   * Requires ADMIN+ role.
   */
  async deletePrice(
    priceId: string,
    actorUserId: string,
    tenantId: string
  ): Promise<void> {
    logger.info('Deleting price', { priceId });

    const existing = await prisma.price.findUnique({
      where: { id: priceId },
    });

    if (!existing) {
      throw new Error(`Price not found: ${priceId}`);
    }

    await prisma.price.update({
      where: { id: priceId },
      data: { isActive: false },
    });

    // Audit event
    await writeAuditEvent({
      actorUserId,
      tenantId,
      type: 'PRICE_DELETED',
      metadata: {
        priceId,
        slug: existing.slug,
      },
    });

    logger.info('Price deleted', { priceId });
  }
}

// ============================================
// EXPORT
// ============================================

export default new ProductsService();
