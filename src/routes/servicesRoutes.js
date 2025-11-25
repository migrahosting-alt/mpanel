// src/routes/servicesRoutes.js
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getServices,
  getService,
  createService,
  updateService,
  deleteService,
  getServiceStats,
} from '../controllers/servicesController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Service CRUD routes
router.get('/', getServices);
router.get('/stats', getServiceStats); // Admin only, checked in controller
router.get('/:id', getService);
router.post('/', createService);
router.put('/:id', updateService);
router.delete('/:id', deleteService);

export default router;

