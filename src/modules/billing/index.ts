/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * Billing Module Index - Exports all billing services and routes.
 */

export { default as subscriptionService } from './subscriptionService.js';
export { default as webhooks } from './webhooks.js';
export { default as routes } from './routes.js';

// Re-export key functions for convenient importing
export {
  createSubscriptionFromProviderEvent,
  getSubscriptionById,
  getTenantSubscriptions,
  getSubscriptionByExternalId,
  updateSubscriptionStatus,
  cancelSubscriptionAtPeriodEnd,
  changeSubscriptionPlan,
  renewSubscription,
  getProductByCode,
} from './subscriptionService.js';

export {
  handleBillingWebhook,
  verifyStripeSignature,
} from './webhooks.js';
