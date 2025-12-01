/**
 * Orders Router - Enterprise Routes with RBAC
 * 
 * Routes:
 * - POST /api/orders           - Create order (ADMIN+)
 * - POST /api/orders/webhook   - Marketing site webhook (internal key)
 * - GET /api/orders            - List orders (BILLING+)
 * - GET /api/orders/:id        - Get order (BILLING+)
 * - POST /api/orders/:id/pay   - Process payment (ADMIN+)
 * - POST /api/orders/:id/cancel - Cancel order (ADMIN+)
 * - POST /api/orders/:id/fail  - Mark failed (ADMIN+)
 * 
 * Role hierarchy: OWNER > ADMIN > BILLING > MEMBER > VIEWER
 */

import { Router } from 'express';
import ordersController from './orders.controller.js';
import { authMiddleware, requireRole } from '../auth/auth.middleware.js';

const router = Router();

// ============================================
// WEBHOOK ROUTE (Internal)
// ============================================

/**
 * @route   POST /api/orders/webhook
 * @desc    Create order from marketing site (internal webhook)
 * @access  Internal (requires x-internal-key header)
 */
router.post(
  '/webhook',
  ordersController.createOrderFromWebhook.bind(ordersController)
);

// ============================================
// AUTHENTICATED ROUTES
// ============================================

/**
 * @route   POST /api/orders
 * @desc    Create a new order
 * @access  Private - ADMIN+ (ADMIN, OWNER)
 */
router.post(
  '/',
  authMiddleware,
  requireRole('ADMIN'),
  ordersController.createOrder.bind(ordersController)
);

/**
 * @route   GET /api/orders
 * @desc    List orders with pagination
 * @access  Private - BILLING+ (BILLING, ADMIN, OWNER)
 */
router.get(
  '/',
  authMiddleware,
  requireRole('BILLING'),
  ordersController.listOrders.bind(ordersController)
);

/**
 * @route   GET /api/orders/:id
 * @desc    Get single order by ID
 * @access  Private - BILLING+ (BILLING, ADMIN, OWNER)
 */
router.get(
  '/:id',
  authMiddleware,
  requireRole('BILLING'),
  ordersController.getOrder.bind(ordersController)
);

/**
 * @route   POST /api/orders/:id/pay
 * @desc    Process order payment (mark as PAID)
 * @access  Private - ADMIN+ (ADMIN, OWNER)
 */
router.post(
  '/:id/pay',
  authMiddleware,
  requireRole('ADMIN'),
  ordersController.processOrderPayment.bind(ordersController)
);

/**
 * @route   POST /api/orders/:id/cancel
 * @desc    Cancel an order
 * @access  Private - ADMIN+ (ADMIN, OWNER)
 */
router.post(
  '/:id/cancel',
  authMiddleware,
  requireRole('ADMIN'),
  ordersController.cancelOrder.bind(ordersController)
);

/**
 * @route   POST /api/orders/:id/fail
 * @desc    Mark order as failed
 * @access  Private - ADMIN+ (ADMIN, OWNER)
 */
router.post(
  '/:id/fail',
  authMiddleware,
  requireRole('ADMIN'),
  ordersController.failOrder.bind(ordersController)
);

export default router;
