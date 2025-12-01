/**
 * Products Module - Enterprise Product & Pricing Management
 * 
 * This module handles:
 * - Product CRUD operations
 * - Price management
 * - Public pricing API (for marketing site)
 * - Product validation for orders
 * - Stripe integration preparation
 * 
 * @module products
 */

// Service
export { ProductsService, default as productsService } from './products.service.js';

// Controller
export { ProductsController, default as productsController } from './products.controller.js';

// Router
export { default as productsRouter } from './products.router.js';

// Types
export type {
  CreateProductInput,
  UpdateProductInput,
  CreatePriceInput,
  UpdatePriceInput,
  ListProductsOptions,
  ProductWithPrices,
  ProductsListResponse,
  ProductResponse,
  PlanPricingResponse,
  ProductValidationResult,
  PriceInfo,
  PriceLimits,
  ProductMetadata,
  ProductType,
  BillingInterval,
  ProductAuditEventType,
} from './products.types.js';

export { PRODUCT_TYPES, BILLING_INTERVALS } from './products.types.js';
