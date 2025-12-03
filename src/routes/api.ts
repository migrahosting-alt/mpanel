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
import usersRouter from '../modules/users/users.router.js';
import customersRouter from '../modules/customers/customers.router.js';
import guardianRouter from '../modules/guardian/guardian.router.js';
import guardianSecurityRouter from '../modules/guardian-security/guardianSecurity.router.js';
import serversRouter from '../modules/ops/servers.router.js';
import opsProvisioningRouter from '../modules/ops/provisioning.router.js';
import rbacRouter from '../modules/security/rbac.router.js';
import shieldRouter from '../modules/security/shield.router.js';
import tenantProvisioningRouter from '../modules/provisioning/provisioning.router.js';

const router: RouterType = Router();

// Temporary debug endpoint to verify TypeScript router wiring
router.get('/__debug', (_req, res) => {
	res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

// Users management (tenant-scoped)
router.use('/users', usersRouter);

// Guardian AI (posture management + security automation)
router.use('/guardian', guardianRouter);

// Guardian Security (agent ingestion + findings/remediation)
router.use('/guardian/security', guardianSecurityRouter);

// Provisioning (CloudPods + Jobs) - tenant-scoped
router.use('/provisioning', tenantProvisioningRouter);

// ============================================
// ADMINISTRATION ROUTES
// ============================================

// Admin: Customers (business view of tenants)
router.use('/admin/customers', customersRouter);

// ============================================
// OPERATIONS ROUTES
// ============================================

// Ops: Server Management (core nodes 100-220)
router.use('/ops/servers', serversRouter);

// Ops: Provisioning (queue orchestration)
router.use('/ops/provisioning', opsProvisioningRouter);

// ============================================
// SECURITY ROUTES
// ============================================

// Security: RBAC (role management)
router.use('/security/rbac', rbacRouter);

// Security: Migra Shield (Zero Trust + WAF)
router.use('/security/shield', shieldRouter);

export default router;
