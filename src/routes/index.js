import express from 'express';
import productRoutes from './productRoutes.js';
import invoiceRoutes from './invoiceRoutes.js';
import subscriptionRoutes from './subscriptionRoutes.js';
import serverRoutes from './serverRoutes.js';
import websiteRoutes from './websiteRoutes.js';
import dnsRoutes from './dnsRoutes.js';
import mailboxRoutes from './mailboxRoutes.js';
import databaseRoutes from './databaseRoutes.js';
import { metricsEndpoint } from '../middleware/metrics.js';

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
router.get('/metrics', metricsEndpoint);

// Billing API routes
router.use('/products', productRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/subscriptions', subscriptionRoutes);

// Hosting control panel API routes
router.use('/servers', serverRoutes);
router.use('/websites', websiteRoutes);
router.use('/dns', dnsRoutes);
router.use('/mailboxes', mailboxRoutes);
router.use('/databases', databaseRoutes);

export default router;
