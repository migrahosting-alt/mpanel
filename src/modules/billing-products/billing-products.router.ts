/**
 * BILLING PRODUCTS Router
 * Routes: /api/billing/products
 */

import { Router } from 'express';
import { authMiddleware, requireRole } from '../auth/index.js';
import * as billingProductsController from './billing-products.controller.js';

const router = Router();

// Public catalog (no auth required)
router.get('/catalog/public', billingProductsController.handleGetPublicCatalog);

// Product management
router.get('/', authMiddleware, requireRole('BILLING'), billingProductsController.handleListProducts);
router.get('/:id', authMiddleware, requireRole('BILLING'), billingProductsController.handleGetProduct);
router.post('/', authMiddleware, requireRole('ADMIN'), billingProductsController.handleCreateProduct);
router.put('/:id', authMiddleware, requireRole('ADMIN'), billingProductsController.handleUpdateProduct);

// Pricing resolution
router.get('/:id/pricing', authMiddleware, requireRole('BILLING'), billingProductsController.handleGetProductPricing);

export default router;
