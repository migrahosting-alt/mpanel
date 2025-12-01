/**
 * Billing Routes - Enterprise Subscription & Webhook Management
 * 
 * Provides:
 * - Stripe webhook endpoint
 * - Generic webhook endpoint
 * - Subscription management (ADMIN only)
 * - Subscription queries (BILLING and above)
 * 
 * RBAC:
 * - Webhooks: Public (signature verified)
 * - GET subscriptions: BILLING, ADMIN, OWNER
 * - Mutations: ADMIN, OWNER
 */

import { Router, Request, Response, NextFunction } from 'express';
import { handleStripeWebhook, handleGenericWebhook } from './webhooks.js';
import { SubscriptionService } from './subscriptionService.js';
import { authMiddleware, requireRole } from '../auth/index.js';
import logger from '../../config/logger.js';

const router = Router();
const subscriptionService = new SubscriptionService();

// ============================================
// WEBHOOK ROUTES (Public - signature verified)
// ============================================

/**
 * POST /api/v1/billing/webhooks/stripe
 * 
 * Stripe webhook endpoint.
 * Note: Raw body middleware must be applied at app level for signature verification.
 */
router.post('/webhooks/stripe', handleStripeWebhook);

/**
 * POST /api/v1/billing/webhooks/generic
 * 
 * Generic webhook endpoint for testing or other providers.
 */
router.post('/webhooks/generic', handleGenericWebhook);

// ============================================
// SUBSCRIPTION QUERY ROUTES (BILLING+)
// ============================================

/**
 * GET /api/v1/billing/subscriptions
 * 
 * List subscriptions for the current tenant.
 * Requires: BILLING role or above
 */
router.get(
  '/subscriptions',
  authMiddleware,
  requireRole(['BILLING', 'ADMIN', 'OWNER']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).tenantId;
      const {
        customerId,
        status,
        productCode,
        includeInactive,
        page,
        pageSize,
        sortBy,
        sortOrder,
      } = req.query;

      const result = await subscriptionService.listSubscriptions({
        tenantId,
        customerId: customerId as string | undefined,
        status: status as any,  // Allow any status string from query
        productCode: productCode as string | undefined,
        includeInactive: includeInactive === 'true',
        page: page ? parseInt(page as string, 10) : undefined,
        pageSize: pageSize ? parseInt(pageSize as string, 10) : undefined,
        sortBy: sortBy as 'createdAt' | 'updatedAt' | 'status' | undefined,
        sortOrder: sortOrder as 'asc' | 'desc' | undefined,
      });

      res.json({
        data: result.subscriptions,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/billing/subscriptions/:id
 * 
 * Get a single subscription by ID.
 * Requires: BILLING role or above
 */
router.get(
  '/subscriptions/:id',
  authMiddleware,
  requireRole(['BILLING', 'ADMIN', 'OWNER']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).tenantId;
      const { id } = req.params;

      const subscription = await subscriptionService.getSubscriptionById(id, tenantId);

      if (!subscription) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Subscription not found',
          },
        });
        return;
      }

      res.json({ data: subscription });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// SUBSCRIPTION MUTATION ROUTES (ADMIN+)
// ============================================

/**
 * POST /api/v1/billing/subscriptions/:id/activate
 * 
 * Activate a subscription (triggers provisioning for hosting products).
 * Requires: ADMIN role or above
 */
router.post(
  '/subscriptions/:id/activate',
  authMiddleware,
  requireRole(['ADMIN', 'OWNER']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).tenantId;
      const userId = (req as any).userId;
      const { id } = req.params;

      const subscription = await subscriptionService.activateSubscription(
        { subscriptionId: id, tenantId },
        userId
      );

      logger.info('Subscription activated via API', {
        subscriptionId: id,
        userId,
      });

      res.json({ data: subscription });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/billing/subscriptions/:id/cancel
 * 
 * Cancel a subscription.
 * Requires: ADMIN role or above
 * 
 * Body:
 * - immediate: boolean (default: false)
 * - reason: string (optional)
 */
router.post(
  '/subscriptions/:id/cancel',
  authMiddleware,
  requireRole(['ADMIN', 'OWNER']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).tenantId;
      const userId = (req as any).userId;
      const { id } = req.params;
      const { immediate, reason } = req.body;

      const subscription = await subscriptionService.cancelSubscription(
        {
          subscriptionId: id,
          tenantId,
          immediate: immediate === true,
          reason,
        },
        userId
      );

      logger.info('Subscription cancelled via API', {
        subscriptionId: id,
        userId,
        immediate,
      });

      res.json({ data: subscription });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/billing/subscriptions/:id/billing-cycle
 * 
 * Update subscription billing cycle.
 * Requires: ADMIN role or above
 * 
 * Body:
 * - billingCycle: 'monthly' | 'quarterly' | 'yearly'
 */
router.patch(
  '/subscriptions/:id/billing-cycle',
  authMiddleware,
  requireRole(['ADMIN', 'OWNER']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).tenantId;
      const userId = (req as any).userId;
      const { id } = req.params;
      const { billingCycle } = req.body;

      if (!['monthly', 'quarterly', 'yearly'].includes(billingCycle)) {
        res.status(400).json({
          error: {
            code: 'INVALID_BILLING_CYCLE',
            message: 'billingCycle must be one of: monthly, quarterly, yearly',
          },
        });
        return;
      }

      const subscription = await subscriptionService.updateBillingCycle(
        {
          subscriptionId: id,
          tenantId,
          newBillingCycle: billingCycle,
        },
        userId
      );

      logger.info('Subscription billing cycle updated', {
        subscriptionId: id,
        userId,
        billingCycle,
      });

      res.json({ data: subscription });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/billing/subscriptions/:id/upgrade
 * 
 * Upgrade subscription to a higher tier plan.
 * Requires: ADMIN role or above
 * 
 * Body:
 * - newProductCode: string (required)
 * - newPriceId: string (optional)
 */
router.post(
  '/subscriptions/:id/upgrade',
  authMiddleware,
  requireRole(['ADMIN', 'OWNER']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).tenantId;
      const userId = (req as any).userId;
      const { id } = req.params;
      const { newProductCode, newPriceId } = req.body;

      if (!newProductCode) {
        res.status(400).json({
          error: {
            code: 'MISSING_PRODUCT_CODE',
            message: 'newProductCode is required',
          },
        });
        return;
      }

      const subscription = await subscriptionService.upgradePlan(
        {
          subscriptionId: id,
          tenantId,
          newProductCode,
          newPriceId,
        },
        userId
      );

      logger.info('Subscription upgraded', {
        subscriptionId: id,
        userId,
        newProductCode,
      });

      res.json({ data: subscription });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/billing/subscriptions/:id/downgrade
 * 
 * Downgrade subscription to a lower tier plan.
 * Requires: ADMIN role or above
 * 
 * Body:
 * - newProductCode: string (required)
 * - newPriceId: string (optional)
 * - effectiveAt: 'immediately' | 'period_end' (default: 'period_end')
 */
router.post(
  '/subscriptions/:id/downgrade',
  authMiddleware,
  requireRole(['ADMIN', 'OWNER']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).tenantId;
      const userId = (req as any).userId;
      const { id } = req.params;
      const { newProductCode, newPriceId, effectiveAt } = req.body;

      if (!newProductCode) {
        res.status(400).json({
          error: {
            code: 'MISSING_PRODUCT_CODE',
            message: 'newProductCode is required',
          },
        });
        return;
      }

      const subscription = await subscriptionService.downgradePlan(
        {
          subscriptionId: id,
          tenantId,
          newProductCode,
          newPriceId,
          effectiveAt: effectiveAt || 'period_end',
        },
        userId
      );

      logger.info('Subscription downgrade requested', {
        subscriptionId: id,
        userId,
        newProductCode,
        effectiveAt,
      });

      res.json({ data: subscription });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
