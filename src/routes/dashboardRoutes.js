// src/routes/dashboardRoutes.js
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getDashboardStats,
  getServiceHealth,
  getUpcomingRenewals,
  getQuickActions
} from '../controllers/dashboardController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Dashboard endpoints
router.get('/stats', getDashboardStats);
router.get('/service-health', getServiceHealth);
router.get('/renewals', getUpcomingRenewals);
router.get('/quick-actions', getQuickActions);

export default router;
