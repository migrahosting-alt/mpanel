/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * API Router - Mounts all TypeScript module routers under /api/v1
 * 
 * API Namespaces (from spec):
 * - /api/v1/auth - Authentication
 * - /api/v1/products - Product catalog
 * - /api/v1/orders - Order management
 * - /api/v1/billing - Billing webhooks & subscriptions
 * - /api/v1/tenant/* - Tenant-scoped resources
 * - /api/v1/admin/* - Platform admin operations
 */

import { Router, type Router as RouterType } from 'express';
import authRouter from '../modules/auth/auth.router.js';
import productsRouter from '../modules/products/products.router.js';
import ordersRouter from '../modules/orders/orders.router.js';
import billingRouter from '../modules/billing/routes.js';

const router: RouterType = Router();

// ============================================
// PUBLIC ROUTES (no auth required)
// ============================================

// Auth routes (login, register, password reset, token refresh)
router.use('/auth', authRouter);

// Product catalog (public read, admin write)
router.use('/products', productsRouter);

// ============================================
// BILLING ROUTES (webhook endpoints)
// ============================================

// Billing webhooks from Stripe and other providers
// These need raw body for signature verification
router.use('/billing', billingRouter);

// ============================================
// AUTHENTICATED ROUTES
// ============================================

// Order management
router.use('/orders', ordersRouter);

// ============================================
// TENANT-SCOPED ROUTES
// Future: Mount under /api/v1/tenant/:tenantId/*
// ============================================

// TODO: Add tenant-scoped routes for:
// - /tenant/:tenantId/cloudpods
// - /tenant/:tenantId/subscriptions
// - /tenant/:tenantId/domains
// - /tenant/:tenantId/dns

// ============================================
// ADMIN ROUTES
// Future: Mount under /api/v1/admin/*
// ============================================

// TODO: Add admin routes for:
// - /admin/users
// - /admin/tenants
// - /admin/servers
// - /admin/provisioning
// - /admin/audit

export default router;
