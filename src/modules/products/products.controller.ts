/**
 * Products Controller - Enterprise-grade HTTP handlers
 * 
 * Endpoints:
 * - GET /api/products/public     - List active products (public, for marketing)
 * - GET /api/products            - List all products (BILLING+)
 * - GET /api/products/:code      - Get product by code (BILLING+)
 * - GET /api/products/pricing/:code - Get plan pricing (public)
 * - POST /api/products           - Create product (ADMIN+)
 * - PATCH /api/products/:code    - Update product (ADMIN+)
 * - DELETE /api/products/:code   - Delete product (ADMIN+)
 * - POST /api/products/:code/prices - Create price (ADMIN+)
 * - PATCH /api/prices/:id        - Update price (ADMIN+)
 * - DELETE /api/prices/:id       - Delete price (ADMIN+)
 * 
 * Products are global, not per-tenant. Visibility controlled by isActive.
 */

import type { Request, Response, NextFunction } from 'express';
import productsService from './products.service.js';
import type {
  CreateProductInput,
  UpdateProductInput,
  CreatePriceInput,
  UpdatePriceInput,
  ListProductsOptions,
  ProductType,
  BillingInterval,
} from './products.types.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import logger from '../../config/logger.js';

// ============================================
// PRODUCTS CONTROLLER
// ============================================

export class ProductsController {
  // ============================================
  // PUBLIC ENDPOINTS
  // ============================================

  /**
   * GET /api/products/public
   * List all active products with prices (for marketing site).
   * No authentication required.
   */
  async getPublicProducts(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const options: ListProductsOptions = {
        isActive: true,
        includeInactive: false,
      };

      // Optional type filter
      if (req.query.type) {
        options.type = req.query.type as ProductType;
      }

      const result = await productsService.listProducts(options);

      res.json({
        success: true,
        data: result.products,
        meta: result.meta,
      });
    } catch (error) {
      logger.error('Get public products error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      next(error);
    }
  }

  /**
   * GET /api/products/pricing/:code
   * Get pricing info for a specific plan (for marketing site).
   * No authentication required.
   */
  async getPlanPricing(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { code } = req.params;

      const pricing = await productsService.getPlanPricing(code);

      if (!pricing) {
        res.status(404).json({
          error: 'Not found',
          message: `Product not found: ${code}`,
        });
        return;
      }

      res.json({
        success: true,
        data: pricing,
      });
    } catch (error) {
      logger.error('Get plan pricing error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      next(error);
    }
  }

  // ============================================
  // AUTHENTICATED ENDPOINTS
  // ============================================

  /**
   * GET /api/products
   * List all products (including inactive for admin).
   * Requires BILLING+ role.
   */
  async listProducts(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const options: ListProductsOptions = {
        includeInactive: true, // Admin can see inactive
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 50,
        sortBy: (req.query.sortBy as 'name' | 'createdAt' | 'type') ?? 'createdAt',
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') ?? 'asc',
      };

      if (req.query.type) {
        options.type = req.query.type as ProductType;
      }

      if (req.query.isActive !== undefined) {
        options.isActive = req.query.isActive === 'true';
      }

      const result = await productsService.listProducts(options);

      res.json({
        success: true,
        data: result.products,
        meta: result.meta,
      });
    } catch (error) {
      logger.error('List products error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      next(error);
    }
  }

  /**
   * GET /api/products/:code
   * Get product by code.
   * Requires BILLING+ role.
   */
  async getProduct(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { code } = req.params;

      const product = await productsService.getProductByCode(code);

      if (!product) {
        res.status(404).json({
          error: 'Not found',
          message: `Product not found: ${code}`,
        });
        return;
      }

      res.json({
        success: true,
        data: product,
      });
    } catch (error) {
      logger.error('Get product error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      next(error);
    }
  }

  /**
   * POST /api/products
   * Create a new product.
   * Requires ADMIN+ role.
   */
  async createProduct(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { tenantId, userId } = req.user;
      const body = req.body as Partial<CreateProductInput>;

      // Validate required fields
      if (!body.code || !body.name || !body.slug || !body.type) {
        res.status(400).json({
          error: 'Validation error',
          message: 'code, name, slug, and type are required',
        });
        return;
      }

      const input: CreateProductInput = {
        code: body.code,
        name: body.name,
        slug: body.slug,
        type: body.type as ProductType,
        description: body.description,
        tenantId,
        metadata: body.metadata,
      };

      const product = await productsService.createProduct(input, userId);

      res.status(201).json({
        success: true,
        data: product,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          res.status(409).json({ error: 'Conflict', message: error.message });
          return;
        }
      }

      logger.error('Create product error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      next(error);
    }
  }

  /**
   * PATCH /api/products/:code
   * Update a product.
   * Requires ADMIN+ role.
   */
  async updateProduct(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { code } = req.params;
      const { tenantId, userId } = req.user;
      const body = req.body as Partial<UpdateProductInput>;

      const input: UpdateProductInput = {
        name: body.name,
        slug: body.slug,
        type: body.type as ProductType | undefined,
        description: body.description,
        isActive: body.isActive,
        metadata: body.metadata,
      };

      const product = await productsService.updateProduct(
        code,
        input,
        userId,
        tenantId
      );

      res.json({
        success: true,
        data: product,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({ error: 'Not found', message: error.message });
          return;
        }
        if (error.message.includes('already in use')) {
          res.status(409).json({ error: 'Conflict', message: error.message });
          return;
        }
      }

      logger.error('Update product error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      next(error);
    }
  }

  /**
   * DELETE /api/products/:code
   * Delete a product (soft delete).
   * Requires ADMIN+ role.
   */
  async deleteProduct(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { code } = req.params;
      const { tenantId, userId } = req.user;

      await productsService.deleteProduct(code, userId, tenantId);

      res.json({
        success: true,
        message: 'Product deleted successfully',
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({ error: 'Not found', message: error.message });
          return;
        }
      }

      logger.error('Delete product error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      next(error);
    }
  }

  // ============================================
  // PRICE ENDPOINTS
  // ============================================

  /**
   * POST /api/products/:code/prices
   * Create a price for a product.
   * Requires ADMIN+ role.
   */
  async createPrice(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { code } = req.params;
      const { tenantId, userId } = req.user;
      const body = req.body as Partial<CreatePriceInput>;

      // Get product by code to get productId
      const product = await productsService.getProductByCode(code);
      if (!product) {
        res.status(404).json({
          error: 'Not found',
          message: `Product not found: ${code}`,
        });
        return;
      }

      // Validate required fields
      if (!body.name || !body.slug || !body.interval || body.amountCents === undefined) {
        res.status(400).json({
          error: 'Validation error',
          message: 'name, slug, interval, and amountCents are required',
        });
        return;
      }

      const input: CreatePriceInput = {
        productId: product.id,
        name: body.name,
        slug: body.slug,
        interval: body.interval as BillingInterval,
        amountCents: body.amountCents,
        currency: body.currency ?? 'usd',
        isPopular: body.isPopular ?? false,
        limitsJson: body.limitsJson,
        stripeProductId: body.stripeProductId,
        stripePriceId: body.stripePriceId,
        tenantId,
      };

      const price = await productsService.createPrice(input, userId, tenantId);

      res.status(201).json({
        success: true,
        data: price,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          res.status(409).json({ error: 'Conflict', message: error.message });
          return;
        }
      }

      logger.error('Create price error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      next(error);
    }
  }

  /**
   * PATCH /api/prices/:id
   * Update a price.
   * Requires ADMIN+ role.
   */
  async updatePrice(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const { tenantId, userId } = req.user;
      const body = req.body as Partial<UpdatePriceInput>;

      const input: UpdatePriceInput = {
        name: body.name,
        slug: body.slug,
        interval: body.interval as BillingInterval | undefined,
        amountCents: body.amountCents,
        currency: body.currency,
        isPopular: body.isPopular,
        isActive: body.isActive,
        limitsJson: body.limitsJson,
        stripeProductId: body.stripeProductId,
        stripePriceId: body.stripePriceId,
      };

      const price = await productsService.updatePrice(id, input, userId, tenantId);

      res.json({
        success: true,
        data: price,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({ error: 'Not found', message: error.message });
          return;
        }
        if (error.message.includes('already in use')) {
          res.status(409).json({ error: 'Conflict', message: error.message });
          return;
        }
      }

      logger.error('Update price error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      next(error);
    }
  }

  /**
   * DELETE /api/prices/:id
   * Delete a price (soft delete).
   * Requires ADMIN+ role.
   */
  async deletePrice(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const { tenantId, userId } = req.user;

      await productsService.deletePrice(id, userId, tenantId);

      res.json({
        success: true,
        message: 'Price deleted successfully',
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({ error: 'Not found', message: error.message });
          return;
        }
      }

      logger.error('Delete price error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      next(error);
    }
  }

  /**
   * GET /api/prices/:id
   * Get a price by ID.
   * Requires BILLING+ role.
   */
  async getPrice(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;

      const price = await productsService.getPriceById(id);

      if (!price) {
        res.status(404).json({
          error: 'Not found',
          message: `Price not found: ${id}`,
        });
        return;
      }

      res.json({
        success: true,
        data: price,
      });
    } catch (error) {
      logger.error('Get price error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      next(error);
    }
  }
}

// ============================================
// EXPORT
// ============================================

export default new ProductsController();
