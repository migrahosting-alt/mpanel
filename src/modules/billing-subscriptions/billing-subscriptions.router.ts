/**
 * BILLING SUBSCRIPTIONS Router
 * Routes: /api/billing/subscriptions
 */

import { Router } from 'express';
import { authMiddleware, requireRole } from '../auth/index.js';
import * as billingSubscriptionsController from './billing-subscriptions.controller.js';

const router = Router();

router.get('/', authMiddleware, requireRole('BILLING'), billingSubscriptionsController.handleListSubscriptions);
router.get('/:id', authMiddleware, requireRole('BILLING'), billingSubscriptionsController.handleGetSubscription);
router.post('/', authMiddleware, requireRole('ADMIN'), billingSubscriptionsController.handleCreateSubscription);
router.put('/:id', authMiddleware, requireRole('ADMIN'), billingSubscriptionsController.handleUpdateSubscription);
router.post('/:id/cancel', authMiddleware, requireRole('ADMIN'), billingSubscriptionsController.handleCancelSubscription);
router.post('/:id/suspend', authMiddleware, requireRole('ADMIN'), billingSubscriptionsController.handleSuspendSubscription);
router.post('/:id/resume', authMiddleware, requireRole('ADMIN'), billingSubscriptionsController.handleResumeSubscription);
router.post('/:id/usage', authMiddleware, requireRole('ADMIN'), billingSubscriptionsController.handleRecordUsage);

export default router;
