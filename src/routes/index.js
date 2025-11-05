import express from 'express';
import productRoutes from './productRoutes.js';
import invoiceRoutes from './invoiceRoutes.js';
import subscriptionRoutes from './subscriptionRoutes.js';
import { metricsEndpoint } from '../middleware/metrics.js';

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || 'v1'
  });
});

// Metrics endpoint for Prometheus
router.get('/metrics', metricsEndpoint);

// API routes
router.use('/products', productRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/subscriptions', subscriptionRoutes);

export default router;
