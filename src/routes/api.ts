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
// TODO: Re-enable once guardianSecurity module is ready
// import guardianSecurityRouter from '../modules/guardian-security/guardianSecurity.router.js';
import serversRouter from '../modules/ops/servers.router.js';
import opsProvisioningRouter from '../modules/ops/provisioning.router.js';
import opsOverviewRouter from '../modules/ops/overview.router.js';
import rbacRouter from '../modules/security/rbac.router.js';
import shieldRouter from '../modules/security/shield.router.js';
import tenantProvisioningRouter from '../modules/provisioning/provisioning.router.js';

// HOSTING modules (8 modules total)
import hostingServersRouter from '../modules/hosting/servers/servers.router.js';
import hostingServerMetricsRouter from '../modules/hosting/server-metrics/serverMetrics.router.js';
import hostingWebsitesRouter from '../modules/hosting/websites/websites.router.js';
import hostingDomainsRouter from '../modules/hosting/domains/domains.router.js';
import hostingDnsRouter from '../modules/hosting/dns/dns.router.js';
import hostingEmailRouter from '../modules/hosting/email/email.router.js';
import hostingFileManagerRouter from '../modules/hosting/file-manager/fileManager.router.js';
import hostingDatabasesRouter from '../modules/hosting/databases/databases.router.js';

// ENTERPRISE modules (14 modules total)
import enterpriseSslRouter from '../modules/enterprise/ssl/ssl.router.js';
import enterpriseApiKeysRouter from '../modules/enterprise/api-keys/api-keys.router.js';
import enterpriseAppInstallerRouter from '../modules/enterprise/app-installer/app-installer.router.js';
import enterpriseBackupsRouter from '../modules/enterprise/backups/backups.router.js';
import enterpriseAiRouter from '../modules/enterprise/ai/ai.router.js';
import enterpriseWebSocketRouter from '../modules/enterprise/websocket/websocket.router.js';
import enterpriseGraphQLRouter from '../modules/enterprise/graphql/graphql.router.js';
import enterpriseMonitoringRouter from '../modules/enterprise/monitoring/monitoring.router.js';
import enterpriseCdnRouter from '../modules/enterprise/cdn/cdn.router.js';
import enterpriseKubernetesRouter from '../modules/enterprise/kubernetes/kubernetes.router.js';
import enterpriseAnalyticsRouter from '../modules/enterprise/analytics/analytics.router.js';
import enterpriseWhiteLabelRouter from '../modules/enterprise/white-label/white-label.router.js';
import enterpriseApiMarketplaceRouter from '../modules/enterprise/api-marketplace/api-marketplace.router.js';
import enterprisePremiumToolsRouter from '../modules/enterprise/premium-tools/premium-tools.router.js';

// BILLING modules (3 modules)
import billingProductsRouter from '../modules/billing-products/billing-products.router.js';
import billingInvoicesRouter from '../modules/billing-invoices/billing-invoices.router.js';
import billingSubscriptionsRouter from '../modules/billing-subscriptions/billing-subscriptions.router.js';

// SECURITY module
import securityCenterRouter from '../modules/security-center/security-center.router.js';

// CLOUDPODS module
import cloudpodsRouter from '../modules/cloudpods/cloudpods.router.js';

// OPS module
import opsOverviewNewRouter from '../modules/ops-overview/ops-overview.router.js';

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
// TODO: Re-enable once module is ready
// router.use('/guardian/security', guardianSecurityRouter);

// Provisioning (CloudPods + Jobs) - tenant-scoped
router.use('/provisioning', tenantProvisioningRouter);

// ============================================
// BILLING ROUTES
// ============================================

// Billing: Products (catalog, pricing, bundles)
router.use('/billing/products', billingProductsRouter);

// Billing: Invoices (issue, pay, void)
router.use('/billing/invoices', billingInvoicesRouter);

// Billing: Subscriptions (recurring services, CloudPod billing)
router.use('/billing/subscriptions', billingSubscriptionsRouter);

// ============================================
// SECURITY CENTER ROUTES
// ============================================

// Security: User profiles, MFA, sessions, API tokens
router.use('/security', securityCenterRouter);

// ============================================
// CLOUDPODS ROUTES
// ============================================

// CloudPods: Provision, resize, suspend, delete
router.use('/cloudpods', cloudpodsRouter);

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

// Ops: Overview (operational dashboard - LEGACY)
router.use('/ops/overview', opsOverviewRouter);

// Ops: Platform Health Overview (NEW - real data aggregation)
router.use('/ops/platform-overview', opsOverviewNewRouter);

// ============================================
// SECURITY ROUTES
// ============================================

// Security: RBAC (role management)
router.use('/security/rbac', rbacRouter);

// Security: Migra Shield (Zero Trust + WAF)
router.use('/security/shield', shieldRouter);

// ============================================
// HOSTING ROUTES
// ============================================

// Hosting: Servers (CloudPods, VPS, dedicated, physical nodes)
router.use('/hosting/servers', hostingServersRouter);

// Hosting: Server Metrics (live/historical performance data)
router.use('/hosting/server-metrics', hostingServerMetricsRouter);

// Hosting: Websites (vhosts, web apps, WordPress, Node, static)
router.use('/hosting/websites', hostingWebsitesRouter);

// Hosting: Domains (registration, transfer, management)
router.use('/hosting/domains', hostingDomainsRouter);

// Hosting: DNS (PowerDNS zones & records)
router.use('/hosting/dns', hostingDnsRouter);

// Hosting: Email (mailboxes on mail-core)
router.use('/hosting/email', hostingEmailRouter);

// Hosting: File Manager (browser-based file access)
router.use('/hosting/files', hostingFileManagerRouter);

// Hosting: Databases (MySQL/PostgreSQL management)
router.use('/hosting/databases', hostingDatabasesRouter);

// ============================================
// ENTERPRISE ROUTES
// ============================================

// Enterprise: SSL Certificates (Let's Encrypt + custom, auto-renewal)
router.use('/enterprise/ssl', enterpriseSslRouter);

// Enterprise: API Keys & Webhooks (programmatic access with HMAC)
router.use('/enterprise/api-keys', enterpriseApiKeysRouter);

// Enterprise: App Installer (one-click WordPress/Joomla/Drupal/etc)
router.use('/enterprise/app-installer', enterpriseAppInstallerRouter);

// Enterprise: Backups & DR (policies, runs, restore jobs)
router.use('/enterprise/backups', enterpriseBackupsRouter);

// Enterprise: AI Features (centralized AI config, usage metering)
router.use('/enterprise/ai', enterpriseAiRouter);

// Enterprise: WebSocket (real-time notifications, job updates)
router.use('/enterprise/websocket', enterpriseWebSocketRouter);

// Enterprise: GraphQL (single endpoint with complexity limits)
router.use('/enterprise/graphql', enterpriseGraphQLRouter);

// Enterprise: Monitoring & Alerts (HTTP/TCP/PING checks, alert policies)
router.use('/enterprise/monitoring', enterpriseMonitoringRouter);

// Enterprise: CDN Management (distributions, cache purging)
router.use('/enterprise/cdn', enterpriseCdnRouter);

// Enterprise: Kubernetes (cluster registration, health checks)
router.use('/enterprise/kubernetes', enterpriseKubernetesRouter);

// Enterprise: Analytics (BI dashboards, data sources)
router.use('/enterprise/analytics', enterpriseAnalyticsRouter);

// Enterprise: White-Label (reseller branding overrides)
router.use('/enterprise/white-label', enterpriseWhiteLabelRouter);

// Enterprise: API Marketplace (subscription management)
router.use('/enterprise/api-marketplace', enterpriseApiMarketplaceRouter);

// Enterprise: Premium Tools (33 integrations, SEO, installers, AI builder)
router.use('/enterprise/premium-tools', enterprisePremiumToolsRouter);

export default router;
