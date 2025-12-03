import express from 'express';
import authRoutes from './authRoutes.js';
import productRoutes from './productRoutes.js';
import invoiceRoutes from './invoiceRoutes.js';
import subscriptionRoutes from './subscriptionRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import servicesRoutes from './servicesRoutes.js';
import checkoutRoutes from './checkoutRoutes.js';
import emailPreferencesRoutes from './emailPreferencesRoutes.js';
import sslRoutes from './sslRoutes.js';
import dnsZoneRoutes from './dnsZoneRoutes.js';
import backupRoutes from './backupRoutes.js';
// import monitoringRoutes from './monitoringRoutes.js';  // Temporarily disabled
import appInstallerRoutes from './appInstallerRoutes.js';
import apiKeyRoutes from './apiKeyRoutes.js';
import serverRoutes from './serverRoutes.js';
import websiteRoutes from './websiteRoutes.js';
import dnsRoutes from './dnsRoutes.js';
import mailboxRoutes from './mailboxRoutes.js';
import databaseRoutes from './databaseRoutes.js';
import domainRoutes from './domainRoutes.js';
import domainRegistrationRoutes from './domainRegistrationRoutes.js';
import domainPricingRoutes from './domainPricingRoutes.js';
import guardianRoutes from './guardianRoutes.js';
import emailRoutes from './emailRoutes.js';
import fileRoutes from './fileRoutes.js';
import databaseMgmtRoutes from './databaseMgmtRoutes.js';
import customerRoutes from './customerRoutes.js';
import userRoutes from './userRoutes.js';
import filesRoutes from './files.js';
import dnsManagementRoutes from './dns.js';
import databasesRoutes from './databases.js';
import emailManagementRoutes from './email.js';
import aiRoutes from './ai.js';
import securityRoutes from './securityRoutes.js';
// import performanceRoutes from './performanceRoutes.js';  // Temporarily disabled
// import analyticsRoutes from './analyticsRoutes.js';  // Temporarily disabled
import brandingRoutes from './brandingRoutes.js';
import premiumToolsRoutes from './premiumToolsRoutes.js';
import provisioningRoutes from './provisioningRoutes.js';
import deploymentRoutes from './deploymentRoutes.js';
import roleRoutes from './roleRoutes.js';
import clientRoutes from './clientRoutes.js';
import websocketRoutes from './websocketRoutes.js';
import aiAPIRoutes from './aiRoutes.js';
import twoFactorRoutes from './twoFactorRoutes.js';
import serverlessFunctionRoutes from './serverlessFunctionRoutes.js';
import advancedBillingRoutes from './advancedBillingRoutes.js';
import containerRegistryRoutes from './containerRegistryRoutes.js';
import emailMarketingRoutes from './emailMarketingRoutes.js';
import multiDatabaseRoutes from './multiDatabaseRoutes.js';
import migrationRoutes from './migrationRoutes.js';
import importRoutes from './importRoutes.js';
// import complianceRoutes from './complianceRoutes.js';  // Temporarily disabled
// Temporarily disabled routes with module issues
// import performanceRoutes from './performanceRoutes.js';
// import analyticsRoutes from './analyticsRoutes.js';
// const supportRoutes = require('./supportRoutes');
// const kubernetesRoutes = require('./kubernetesRoutes');
// const integrationsRoutes = require('./integrationsRoutes');
// const whiteLabelRoutes = require('./whiteLabelRoutes');
// const cdnRoutes = require('./cdnRoutes');
// const advancedDnsRoutes = require('./advancedDnsRoutes');
// const enhancedBackupRoutes = require('./enhancedBackupRoutes');
// const { metricsEndpoint } = require('../middleware/metrics');
import publicRoutes from './publicRoutes.js';
import serviceManagementRoutes from './serviceManagementRoutes.js';
import systemHealthRoutes from './systemHealthRoutes.js';

// Enterprise Features (Phase 2024-11-17)
import notificationPreferencesRoutes from './notificationPreferencesRoutes.js';
import csatRoutes from './csatRoutes.js';
import referralRoutes from './referralRoutes.js';
import knowledgeBaseRoutes from './knowledgeBaseRoutes.js';
import sessionRoutes from './sessionRoutes.js';
import whiteLabelRoutes from './whiteLabelRoutes.js';
import marketingRoutes from './marketingRoutes.js';
import marketingApiRoutes from './marketingApiRoutes.js';
import adminCronRoutes from './adminCronRoutes.js';
import hrRoutes from './hrRoutes.js';
import planAccessRoutes from './planAccessRoutes.js';
import addonRoutes from './addonRoutes.js';
import cloudPodRoutes from './cloudPodRoutes.js';
import adminDashboardRoutes from './adminDashboardRoutes.js';

// TypeScript API Routes (Administration modules + new features)
import tsApiRoutes from './ts-api.js';

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || 'v1',
    features: ['billing', 'hosting', 'dns', 'email', 'databases']
  });
});

// Metrics endpoint for Prometheus
// router.get('/metrics', metricsEndpoint);  // Temporarily disabled

// Public routes (no auth required)
router.use('/public', publicRoutes);

// System health & diagnostics (no auth required)
router.use('/system', systemHealthRoutes);

// Auth routes (login, register, password reset)
router.use('/auth', authRoutes);

// Billing API routes
router.use('/products', productRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/services', servicesRoutes);
router.use('/checkout', checkoutRoutes);
router.use('/email-preferences', emailPreferencesRoutes);

  // Phase 6: Advanced Features
  router.use('/ssl', sslRoutes);
  router.use('/dns-zones', dnsZoneRoutes);
  router.use('/backups', backupRoutes);
  // router.use('/monitoring', monitoringRoutes);  // Temporarily disabled
  router.use('/app-installer', appInstallerRoutes);
  router.use('/api-keys', apiKeyRoutes);// Hosting control panel API routes
router.use('/servers', serverRoutes);
router.use('/websites', websiteRoutes);
router.use('/dns', dnsRoutes);
router.use('/mailboxes', mailboxRoutes);
router.use('/databases', databaseRoutes);

// Phase 1 - Core Hosting Features
router.use('/domains', domainRoutes);
router.use('/domain-registration', domainRegistrationRoutes);
router.use('/domain-pricing', domainPricingRoutes);
router.use('/guardian', guardianRoutes);
router.use('/email', emailRoutes);
router.use('/files', fileRoutes);
router.use('/database-mgmt', databaseMgmtRoutes);

// Customer management
router.use('/customers', customerRoutes);

// User management (admin only)
router.use('/users', userRoutes);

// Phase 2 - Enhanced Management Features
router.use('/file-manager', filesRoutes);
router.use('/dns-management', dnsManagementRoutes);
router.use('/db-management', databasesRoutes);
router.use('/email-management', emailManagementRoutes);

// AI Features (legacy)
router.use('/ai', aiRoutes);

// AI-powered features (GPT-4/Claude integration)
router.use('/ai-api', aiAPIRoutes);

// WebSocket management
router.use('/websocket', websocketRoutes);

// Two-Factor Authentication
router.use('/2fa', twoFactorRoutes);

// Serverless Functions Platform
router.use('/serverless', serverlessFunctionRoutes);

// Advanced Billing (usage-based, payment plans, quotes)
router.use('/billing', advancedBillingRoutes);

// Container Registry (Docker images, vulnerability scanning)
router.use('/registry', containerRegistryRoutes);

// Email Marketing (campaigns, drip, A/B testing)
router.use('/email-marketing', emailMarketingRoutes);

// Multi-Database Management (MySQL, MongoDB, Redis, etc.)
router.use('/multi-db', multiDatabaseRoutes);

// Compliance & Audit System (SOC2, ISO27001, GDPR, HIPAA, PCI DSS)
// router.use('/compliance', complianceRoutes);  // Temporarily disabled

// Advanced Support System (Ticketing, Live Chat, Knowledge Base, SLA)
// router.use('/support', supportRoutes);  // Temporarily disabled

// Kubernetes Auto-Scaling (HPA, VPA, multi-region failover)
// router.use('/kubernetes', kubernetesRoutes);  // Temporarily disabled

// Security features (2FA, email verification, sessions, audit logs)
router.use('/security', securityRoutes);

// Phase 7: Performance & Monitoring
// router.use('/performance', performanceRoutes);  // Temporarily disabled

// Phase 8: Advanced Analytics & Reporting
// router.use('/analytics', analyticsRoutes);  // Temporarily disabled

// Phase 8: White-label & Branding
router.use('/branding', brandingRoutes);

// Premium Tools (Integrations, SEO, One-Click Installers, AI Builder)
router.use('/premium', premiumToolsRoutes);

// Data Migration from WHMCS & CyberPanel
router.use('/migrations', migrationRoutes);

// Quick Import API (trigger from browser)
router.use('/import', importRoutes);

// Automated Provisioning System
router.use('/provisioning', provisioningRoutes);

// One-Click Deployments (RBAC protected)
router.use('/deployments', deploymentRoutes);

// Role & Permission Management (Super Admin only)
router.use('/roles', roleRoutes);

// Client Portal API (Client role only)
router.use('/client', clientRoutes);

// API Marketplace & Integrations Hub
// router.use('/integrations', integrationsRoutes);  // Temporarily disabled

// White-Label & Reseller Platform
// router.use('/white-label', whiteLabelRoutes);  // Temporarily disabled

// Multi-Region CDN Management
// router.use('/cdn', cdnRoutes);  // Temporarily disabled

// Advanced DNS Management
// router.use('/advanced-dns', advancedDnsRoutes);  // Temporarily disabled

// Enhanced Backup & Disaster Recovery
// router.use('/enhanced-backups', enhancedBackupRoutes);  // Temporarily disabled

// Enterprise Features (Phase 2024-11-17)
router.use('/notification-preferences', notificationPreferencesRoutes);
router.use('/surveys', csatRoutes);
router.use('/referrals', referralRoutes);
router.use('/kb', knowledgeBaseRoutes);
router.use('/sessions', sessionRoutes);
router.use('/white-label', whiteLabelRoutes);
router.use('/marketing', marketingApiRoutes);  // Marketing website integration API
router.use('/marketing-internal', marketingRoutes);  // Internal marketing routes
router.use('/admin/cron', adminCronRoutes);
router.use('/admin', adminDashboardRoutes);  // Enterprise Admin Dashboard

// HR & Employee Management System
router.use('/hr', hrRoutes);

// Client Plan Access & Subscription Management
router.use('/plans', planAccessRoutes);

// Service Management (SSL, Backups, Email, Migration, Domain Transfer)
router.use('/service-management', serviceManagementRoutes);

// Add-ons API (single source of truth for all add-on products)
router.use('/addons', addonRoutes);

// Cloud Pods API (isolated container hosting)
router.use('/cloud-pods', cloudPodRoutes);

// ============================================
// TYPESCRIPT API ROUTES
// ============================================
// Mount all TypeScript-based API routes (Administration, Ops, Security)
// These include: /admin/*, /ops/*, /security/*, /guardian/*, /provisioning/*
router.use('/', tsApiRoutes);

export default router;

