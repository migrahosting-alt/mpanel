/**
 * BILLING PRODUCTS Controller
 */

import type { Request, Response, NextFunction } from 'express';
import * as billingProductsService from './billing-products.service.js';
import type {
  CreateProductRequest,
  UpdateProductRequest,
  ProductPricingRequest,
} from './billing-products.types.js';

export async function handleListProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const filters = {
      search: req.query.search as string,
      category: req.query.category as any,
      status: req.query.status as any,
      visibility: req.query.visibility as any,
      billingModel: req.query.billingModel as string,
      tenantId: req.query.tenantId as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 50,
    };

    const result = await billingProductsService.listProducts(filters);
    return res.json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleGetProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const product = await billingProductsService.getProductById(id);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Include features and bundles
    const [features, bundles] = await Promise.all([
      billingProductsService.getProductFeatures(id),
      billingProductsService.getProductBundles(id),
    ]);

    return res.json({ ...product, features, bundles });
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleCreateProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const data: CreateProductRequest = req.body;
    const actorId = (req as any).user?.id || 'system';
    
    const product = await billingProductsService.createProduct(data, actorId);
    return res.status(201).json(product);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleUpdateProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const data: UpdateProductRequest = req.body;
    const actorId = (req as any).user?.id || 'system';
    
    const product = await billingProductsService.updateProduct(id, data, actorId);
    return res.json(product);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleGetProductPricing(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const params: ProductPricingRequest = {
      tenantId: req.query.tenantId as string,
      region: req.query.region as string,
      currency: req.query.currency as string,
      billingPeriod: req.query.billingPeriod as any,
    };
    
    const pricing = await billingProductsService.resolveProductPricing(id, params);
    return res.json(pricing);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleGetPublicCatalog(req: Request, res: Response, next: NextFunction) {
  try {
    const products = await billingProductsService.getPublicCatalog();
    return res.json(products);
  } catch (error) {
    return next(error);
    next(error);
  }
}
