// src/routes/adminDashboardRoutes.js
// Enterprise Admin Dashboard Routes
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getAdminDashboard } from '../controllers/adminDashboardController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/admin/dashboard - Complete admin dashboard data
router.get('/dashboard', getAdminDashboard);

export default router;
