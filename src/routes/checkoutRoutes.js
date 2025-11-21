// src/routes/checkoutRoutes.js
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  createCheckoutSession,
  getCheckoutSession,
  handleCheckoutSuccess,
  getOrders,
  getOrder,
} from '../controllers/checkoutController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Checkout routes
router.post('/create-session', createCheckoutSession);
router.get('/session/:sessionId', getCheckoutSession);
router.post('/success', handleCheckoutSuccess);

// Order routes
router.get('/orders', getOrders);
router.get('/orders/:id', getOrder);

export default router;

