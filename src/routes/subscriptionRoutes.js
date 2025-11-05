import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  createSubscription,
  getSubscriptions,
  getSubscription,
  cancelSubscription,
  suspendSubscription,
  reactivateSubscription
} from '../controllers/subscriptionController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.post('/', createSubscription);
router.get('/', getSubscriptions);
router.get('/:id', getSubscription);
router.post('/:id/cancel', cancelSubscription);
router.post('/:id/suspend', suspendSubscription);
router.post('/:id/reactivate', reactivateSubscription);

export default router;
