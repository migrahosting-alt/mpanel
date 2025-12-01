import { Router } from 'express';
import ordersController from './orders.controller.js';
import { authMiddleware } from '../auth/auth.middleware.js';

const router = Router();

/**
 * @route   POST /api/orders
 * @desc    Create order from marketing site (internal webhook)
 * @access  Internal (requires x-internal-key header)
 */
router.post('/', ordersController.createOrder.bind(ordersController));

/**
 * @route   GET /api/orders
 * @desc    Get all orders
 * @access  Private - Admin
 */
router.get('/', authMiddleware, ordersController.getAllOrders.bind(ordersController));

/**
 * @route   GET /api/orders/:id
 * @desc    Get order by ID
 * @access  Private - Admin
 */
router.get('/:id', authMiddleware, ordersController.getOrderById.bind(ordersController));

export default router;
