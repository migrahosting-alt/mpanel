import { Request, Response, NextFunction } from 'express';
import productsService from './products.service.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import logger from '../../config/logger.js';

export class ProductsController {
  /**
   * GET /api/public/products
   * Get all active products with prices (for marketing site)
   */
  async getPublicProducts(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const products = await productsService.getPublicProducts();
      res.json({ products });
    } catch (error) {
      logger.error('Get public products error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      next(error);
    }
  }

  /**
   * GET /api/products
   * Get all products (admin)
   */
  async getAllProducts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const products = await productsService.getAllProducts(req.user.tenantId);
      res.json({ products });
    } catch (error) {
      logger.error('Get all products error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      next(error);
    }
  }

  /**
   * GET /api/products/:id
   * Get product by ID
   */
  async getProductById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const product = await productsService.getProductById(id, req.user.tenantId);

      if (!product) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }

      res.json({ product });
    } catch (error) {
      logger.error('Get product by ID error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      next(error);
    }
  }

  /**
   * POST /api/products
   * Create new product
   */
  async createProduct(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { name, slug, type, description } = req.body;

      if (!name || !slug || !type) {
        res.status(400).json({
          error: 'Validation error',
          message: 'name, slug, and type are required',
        });
        return;
      }

      const product = await productsService.createProduct({
        name,
        slug,
        type,
        description,
        tenantId: req.user.tenantId,
      });

      res.status(201).json({ product });
    } catch (error) {
      logger.error('Create product error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      next(error);
    }
  }

  /**
   * PATCH /api/products/:id
   * Update product
   */
  async updateProduct(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const updateData = req.body;

      const product = await productsService.updateProduct(id, req.user.tenantId, updateData);

      res.json({ product });
    } catch (error) {
      logger.error('Update product error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      next(error);
    }
  }

  /**
   * DELETE /api/products/:id
   * Delete product (soft delete)
   */
  async deleteProduct(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      await productsService.deleteProduct(id, req.user.tenantId);

      res.json({ message: 'Product deleted successfully' });
    } catch (error) {
      logger.error('Delete product error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      next(error);
    }
  }

  /**
   * POST /api/products/:id/prices
   * Create price for product
   */
  async createPrice(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id: productId } = req.params;
      const { name, slug, interval, amountCents, currency, isPopular, limitsJson, stripeProductId, stripePriceId } = req.body;

      if (!name || !slug || !interval || amountCents === undefined) {
        res.status(400).json({
          error: 'Validation error',
          message: 'name, slug, interval, and amountCents are required',
        });
        return;
      }

      const price = await productsService.createPrice({
        productId,
        tenantId: req.user.tenantId,
        name,
        slug,
        interval,
        amountCents,
        currency,
        isPopular,
        limitsJson,
        stripeProductId,
        stripePriceId,
      });

      res.status(201).json({ price });
    } catch (error) {
      logger.error('Create price error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      next(error);
    }
  }

  /**
   * PATCH /api/prices/:id
   * Update price
   */
  async updatePrice(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const updateData = req.body;

      const price = await productsService.updatePrice(id, updateData);

      res.json({ price });
    } catch (error) {
      logger.error('Update price error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      next(error);
    }
  }
}

export default new ProductsController();
