/**
 * Products Router - Enterprise Routes with RBAC
 * 
 * Routes:
 * - GET /api/products/public         - List active products (public)
 * - GET /api/products/pricing/:code  - Get plan pricing (public)
 * - GET /api/products                - List all products (BILLING+)
 * - GET /api/products/:code          - Get product by code (BILLING+)
 * - POST /api/products               - Create product (ADMIN+)
 * - PATCH /api/products/:code        - Update product (ADMIN+)
 * - DELETE /api/products/:code       - Delete product (ADMIN+)
 * - POST /api/products/:code/prices  - Create price (ADMIN+)
 * - GET /api/prices/:id              - Get price (BILLING+)
 * - PATCH /api/prices/:id            - Update price (ADMIN+)
 * - DELETE /api/prices/:id           - Delete price (ADMIN+)
 * 
 * Role hierarchy: OWNER > ADMIN > BILLING > MEMBER > VIEWER
 */

import { Router } from 'express';
import productsController from './products.controller.js';
import { authMiddleware, requireRole } from '../auth/auth.middleware.js';

const router = Router();

// ============================================
// PUBLIC ROUTES (no auth required)
// ============================================

/**
 * @route   GET /api/products/public
 * @desc    List all active products with prices
 * @access  Public
 */
router.get(
  '/public',
  productsController.getPublicProducts.bind(productsController)
);

/**
 * @route   GET /api/products/pricing/:code
 * @desc    Get pricing info for a specific product
 * @access  Public
 */
router.get(
  '/pricing/:code',
  productsController.getPlanPricing.bind(productsController)
);

// ============================================
// AUTHENTICATED ROUTES
// ============================================

/**
 * @route   GET /api/products
 * @desc    List all products (including inactive)
 * @access  Private - BILLING+
 */
router.get(
  '/',
  authMiddleware,
  requireRole('BILLING'),
  productsController.listProducts.bind(productsController)
);

/**
 * @route   POST /api/products
 * @desc    Create a new product
 * @access  Private - ADMIN+
 */
router.post(
  '/',
  authMiddleware,
  requireRole('ADMIN'),
  productsController.createProduct.bind(productsController)
);

/**
 * @route   GET /api/products/:code
 * @desc    Get product by code
 * @access  Private - BILLING+
 */
router.get(
  '/:code',
  authMiddleware,
  requireRole('BILLING'),
  productsController.getProduct.bind(productsController)
);

/**
 * @route   PATCH /api/products/:code
 * @desc    Update product
 * @access  Private - ADMIN+
 */
router.patch(
  '/:code',
  authMiddleware,
  requireRole('ADMIN'),
  productsController.updateProduct.bind(productsController)
);

/**
 * @route   DELETE /api/products/:code
 * @desc    Delete product (soft delete)
 * @access  Private - ADMIN+
 */
router.delete(
  '/:code',
  authMiddleware,
  requireRole('ADMIN'),
  productsController.deleteProduct.bind(productsController)
);

/**
 * @route   POST /api/products/:code/prices
 * @desc    Create a price for product
 * @access  Private - ADMIN+
 */
router.post(
  '/:code/prices',
  authMiddleware,
  requireRole('ADMIN'),
  productsController.createPrice.bind(productsController)
);

// ============================================
// PRICE ROUTES
// ============================================

/**
 * @route   GET /api/prices/:id
 * @desc    Get price by ID
 * @access  Private - BILLING+
 */
router.get(
  '/prices/:id',
  authMiddleware,
  requireRole('BILLING'),
  productsController.getPrice.bind(productsController)
);

/**
 * @route   PATCH /api/prices/:id
 * @desc    Update price
 * @access  Private - ADMIN+
 */
router.patch(
  '/prices/:id',
  authMiddleware,
  requireRole('ADMIN'),
  productsController.updatePrice.bind(productsController)
);

/**
 * @route   DELETE /api/prices/:id
 * @desc    Delete price (soft delete)
 * @access  Private - ADMIN+
 */
router.delete(
  '/prices/:id',
  authMiddleware,
  requireRole('ADMIN'),
  productsController.deletePrice.bind(productsController)
);

export default router;
