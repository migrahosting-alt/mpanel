import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  createSubscription,
  getSubscriptions,
  getSubscription,
  cancelSubscription,
  suspendSubscription,
  reactivateSubscription,
  getPlans,
  createStripeSubscription,
  changePlan
} from '../controllers/subscriptionController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get available plans (public within authenticated users)
router.get('/plans', getPlans);

// Subscription management
router.post('/', createSubscription);
router.post('/stripe', createStripeSubscription); // Stripe-powered subscription
router.get('/', getSubscriptions);
router.get('/:id', getSubscription);
router.put('/:id/change-plan', changePlan); // Change plan (upgrade/downgrade)
router.post('/:id/cancel', cancelSubscription);
router.post('/:id/suspend', suspendSubscription);
router.post('/:id/reactivate', reactivateSubscription);

export default router;

