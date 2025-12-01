import { Router } from 'express';
import productsController from './products.controller.js';
import { authMiddleware, requireRole } from '../auth/auth.middleware.js';
import { UserRole } from '@prisma/client';

const router = Router();

// ============================================
// PUBLIC ROUTES (for marketing site)
// ============================================

/**
 * @route   GET /api/public/products
 * @desc    Get all active products with prices
 * @access  Public
 */
router.get('/public', productsController.getPublicProducts.bind(productsController));

// ============================================
// ADMIN ROUTES (authenticated)
// ============================================

/**
 * @route   GET /api/products
 * @desc    Get all products (admin)
 * @access  Private - Admin
 */
router.get('/', authMiddleware, productsController.getAllProducts.bind(productsController));

/**
 * @route   GET /api/products/:id
 * @desc    Get product by ID
 * @access  Private - Admin
 */
router.get('/:id', authMiddleware, productsController.getProductById.bind(productsController));

/**
 * @route   POST /api/products
 * @desc    Create new product
 * @access  Private - Admin
 */
router.post('/', authMiddleware, requireRole(UserRole.ADMIN), productsController.createProduct.bind(productsController));

/**
 * @route   PATCH /api/products/:id
 * @desc    Update product
 * @access  Private - Admin
 */
router.patch('/:id', authMiddleware, requireRole(UserRole.ADMIN), productsController.updateProduct.bind(productsController));

/**
 * @route   DELETE /api/products/:id
 * @desc    Delete product (soft delete)
 * @access  Private - Admin
 */
router.delete('/:id', authMiddleware, requireRole(UserRole.ADMIN), productsController.deleteProduct.bind(productsController));

/**
 * @route   POST /api/products/:id/prices
 * @desc    Create price for product
 * @access  Private - Admin
 */
router.post('/:id/prices', authMiddleware, requireRole(UserRole.ADMIN), productsController.createPrice.bind(productsController));

/**
 * @route   PATCH /api/prices/:id
 * @desc    Update price
 * @access  Private - Admin
 */
router.patch('/prices/:id', authMiddleware, requireRole(UserRole.ADMIN), productsController.updatePrice.bind(productsController));

export default router;
