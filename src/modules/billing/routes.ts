/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * Billing Routes - Webhook endpoints for payment providers.
 */

import { Router } from 'express';
import { handleBillingWebhook, verifyStripeSignature } from './webhooks.js';

const router = Router();

// ============================================
// WEBHOOK ROUTES
// ============================================

/**
 * POST /api/v1/billing/webhooks/stripe
 * 
 * Stripe webhook endpoint.
 * Note: Raw body middleware must be applied at app level for signature verification.
 */
router.post(
  '/webhooks/stripe',
  verifyStripeSignature(process.env.STRIPE_WEBHOOK_SECRET || ''),
  handleBillingWebhook
);

/**
 * POST /api/v1/billing/webhooks/generic
 * 
 * Generic webhook endpoint for testing or other providers.
 */
router.post('/webhooks/generic', handleBillingWebhook);

export default router;
