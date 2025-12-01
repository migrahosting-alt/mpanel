import { prisma } from '../../config/database.js';
import type {
  ProductWithPrices,
  CreateProductRequest,
  CreatePriceRequest,
  UpdateProductRequest,
  UpdatePriceRequest,
} from './products.types.js';
import logger from '../../config/logger.js';

export class ProductsService {
  /**
   * Get all active products with prices (public endpoint)
   */
  async getPublicProducts(): Promise<ProductWithPrices[]> {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        prices: {
          some: {
            isActive: true,
          },
        },
      },
      include: {
        prices: {
          where: {
            isActive: true,
          },
          orderBy: [
            { isPopular: 'desc' },
            { amountCents: 'asc' },
          ],
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return products as ProductWithPrices[];
  }

  /**
   * Get all products (admin endpoint)
   */
  async getAllProducts(tenantId: string): Promise<ProductWithPrices[]> {
    const products = await prisma.product.findMany({
      where: {
        tenantId,
      },
      include: {
        prices: {
          orderBy: [
            { isPopular: 'desc' },
            { amountCents: 'asc' },
          ],
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return products as ProductWithPrices[];
  }

  /**
   * Get product by ID
   */
  async getProductById(productId: string, tenantId: string): Promise<ProductWithPrices | null> {
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        tenantId,
      },
      include: {
        prices: {
          orderBy: [
            { isPopular: 'desc' },
            { amountCents: 'asc' },
          ],
        },
      },
    });

    return product as ProductWithPrices | null;
  }

  /**
   * Get product by slug
   */
  async getProductBySlug(slug: string): Promise<ProductWithPrices | null> {
    const product = await prisma.product.findUnique({
      where: {
        slug,
      },
      include: {
        prices: {
          where: {
            isActive: true,
          },
          orderBy: [
            { isPopular: 'desc' },
            { amountCents: 'asc' },
          ],
        },
      },
    });

    return product as ProductWithPrices | null;
  }

  /**
   * Create new product
   */
  async createProduct(data: CreateProductRequest): Promise<ProductWithPrices> {
    const product = await prisma.product.create({
      data: {
        name: data.name,
        slug: data.slug,
        type: data.type,
        description: data.description,
        tenantId: data.tenantId,
      },
      include: {
        prices: true,
      },
    });

    logger.info('Product created', {
      productId: product.id,
      slug: product.slug,
      tenantId: data.tenantId,
    });

    return product as ProductWithPrices;
  }

  /**
   * Update product
   */
  async updateProduct(
    productId: string,
    tenantId: string,
    data: UpdateProductRequest
  ): Promise<ProductWithPrices> {
    const product = await prisma.product.update({
      where: {
        id: productId,
        tenantId,
      },
      data,
      include: {
        prices: true,
      },
    });

    logger.info('Product updated', {
      productId: product.id,
      tenantId,
    });

    return product as ProductWithPrices;
  }

  /**
   * Delete product (soft delete)
   */
  async deleteProduct(productId: string, tenantId: string): Promise<void> {
    await prisma.product.update({
      where: {
        id: productId,
        tenantId,
      },
      data: {
        isActive: false,
      },
    });

    logger.info('Product deleted', {
      productId,
      tenantId,
    });
  }

  /**
   * Create price for product
   */
  async createPrice(data: CreatePriceRequest): Promise<any> {
    const price = await prisma.price.create({
      data: {
        productId: data.productId,
        tenantId: data.tenantId,
        name: data.name,
        slug: data.slug,
        interval: data.interval,
        amountCents: data.amountCents,
        currency: data.currency || 'usd',
        isPopular: data.isPopular || false,
        limitsJson: data.limitsJson,
        stripeProductId: data.stripeProductId,
        stripePriceId: data.stripePriceId,
      },
    });

    logger.info('Price created', {
      priceId: price.id,
      productId: data.productId,
      tenantId: data.tenantId,
    });

    return price;
  }

  /**
   * Update price
   */
  async updatePrice(priceId: string, data: UpdatePriceRequest): Promise<any> {
    const price = await prisma.price.update({
      where: {
        id: priceId,
      },
      data,
    });

    logger.info('Price updated', {
      priceId: price.id,
    });

    return price;
  }

  /**
   * Get price by slug
   */
  async getPriceBySlug(slug: string): Promise<any> {
    return prisma.price.findUnique({
      where: {
        slug,
      },
      include: {
        product: true,
      },
    });
  }
}

export default new ProductsService();
