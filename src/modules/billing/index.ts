/**
 * Billing Module - Enterprise Subscription & Webhook Management
 * 
 * Provides:
 * - Subscription lifecycle management (create, activate, cancel, upgrade, downgrade)
 * - Stripe webhook processing with idempotency
 * - CloudPod provisioning integration
 * - Multi-tenant isolation
 * - RBAC-protected routes
 * 
 * Key exports:
 * - SubscriptionService: Full subscription lifecycle management
 * - webhooks: Stripe webhook handlers
 * - routes: Express router with RBAC guards
 * - Types: All billing-related type definitions
 */

// ============================================
// SERVICE EXPORTS
// ============================================

export { SubscriptionService } from './subscriptionService.js';
export { default as subscriptionService } from './subscriptionService.js';

// ============================================
// WEBHOOK EXPORTS
// ============================================

export {
  handleStripeWebhook,
  handleGenericWebhook,
  handleBillingWebhook,
  verifyStripeSignature,
} from './webhooks.js';
export { default as webhooks } from './webhooks.js';

// ============================================
// ROUTES EXPORT
// ============================================

export { default as routes } from './routes.js';

// ============================================
// TYPE EXPORTS
// ============================================

export {
  // Status constants
  SUBSCRIPTION_STATUSES,
  BILLING_CYCLES,
  STRIPE_EVENTS,
  // Status types
  type SubscriptionStatus,
  type BillingCycle,
  type StripeEventType,
  // Input types
  type CreateSubscriptionFromOrderInput,
  type SyncSubscriptionFromWebhookInput,
  type ActivateSubscriptionInput,
  type CancelSubscriptionInput,
  type ScheduleCancellationInput,
  type UpdateBillingCycleInput,
  type UpgradePlanInput,
  type DowngradePlanInput,
  // Add-on types
  type AddOnConfig,
  type SubscriptionAddOns,
  // Response types
  type SubscriptionWithRelations,
  type SubscriptionsListResponse,
  type ListSubscriptionsOptions,
  // Webhook types
  type WebhookProcessingResult,
  type StripeWebhookPayload,
  type ProcessedWebhookEvent,
  // Audit types
  type BillingAuditEventType,
} from './billing.types.js';
