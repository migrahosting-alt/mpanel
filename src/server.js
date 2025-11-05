import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import cron from 'node-cron';

import logger from './config/logger.js';
import { metricsMiddleware } from './middleware/metrics.js';
import routes from './routes/index.js';
import BillingService from './services/BillingService.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api', limiter);

// Metrics collection
app.use(metricsMiddleware);

// API routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'MPanel API',
    version: process.env.API_VERSION || 'v1',
    description: 'Multi-tenant Billing and Hosting Management Platform',
    documentation: '/api/docs',
    health: '/api/health',
    metrics: '/api/metrics'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Scheduled tasks
if (process.env.NODE_ENV === 'production') {
  // Run recurring billing daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    logger.info('Running scheduled recurring billing task');
    try {
      // Get tenant ID from environment or database
      const tenantId = process.env.DEFAULT_TENANT_ID;
      if (tenantId) {
        await BillingService.processRecurringBilling(tenantId);
      }
    } catch (error) {
      logger.error('Error in recurring billing task:', error);
    }
  });

  logger.info('Scheduled tasks initialized');
}

// Start server
app.listen(PORT, () => {
  logger.info(`MPanel API server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`API Version: ${process.env.API_VERSION || 'v1'}`);
});

export default app;
