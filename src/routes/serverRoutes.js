import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
  createServer,
  getServers,
  getServer,
  updateServer,
  reportServerMetrics,
  getServerMetrics
} from '../controllers/serverController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.post('/', requireRole('admin', 'owner'), createServer);
router.get('/', getServers);
router.get('/:id', getServer);
router.put('/:id', requireRole('admin', 'owner'), updateServer);
router.post('/:id/metrics', reportServerMetrics);
router.get('/:id/metrics', getServerMetrics);

export default router;
