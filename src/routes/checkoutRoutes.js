// src/routes/checkoutRoutes.js
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  createCheckoutSession,
  getCheckoutSession,
  handleCheckoutSuccess,
} from '../controllers/checkoutController.js';

const router = express.Router();

// Public checkout routes (no auth required for marketing site)
router.post('/create-session', createCheckoutSession);
router.get('/session/:sessionId', getCheckoutSession);
router.post('/success', handleCheckoutSuccess);

export default router;

