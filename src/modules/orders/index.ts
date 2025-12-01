/**
 * Orders Module - Enterprise Order Management
 * 
 * This module handles order lifecycle:
 * - Order creation (admin, marketing webhook)
 * - Payment processing
 * - Order cancellation/failure
 * - Subscription creation
 * - Provisioning job creation
 * 
 * @module orders
 */

// Service
export { OrdersService, default as ordersService } from './orders.service.js';

// Controller
export { OrdersController, default as ordersController } from './orders.controller.js';

// Router
export { default as ordersRouter } from './orders.router.js';

// Types
export type {
  CreateOrderInput,
  CreateOrderFromWebhookInput,
  ProcessOrderInput,
  CancelOrderInput,
  FailOrderInput,
  ListOrdersOptions,
  OrderCreateResponse,
  OrderWithRelations,
  OrdersListResponse,
  OrderMetadata,
  JobInfo,
} from './orders.types.js';

export { ORDER_STATUSES } from './orders.types.js';
