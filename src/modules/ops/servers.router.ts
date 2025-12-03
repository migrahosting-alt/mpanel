import express from 'express';
import { authMiddleware } from '../auth/auth.middleware.js';
import { requirePlatformPermission } from '../../middleware/rbac.middleware.js';
import * as controller from './servers.controller.js';

const router = express.Router();

router.use(authMiddleware);
router.use(requirePlatformPermission());

// List core servers
router.get('/', controller.listServers);

// Get server details
router.get('/:id', controller.getServer);

// Server metrics
router.get('/:id/metrics', controller.getServerMetrics);

// Server health check
router.post('/:id/health-check', controller.runHealthCheck);

// Restart service
router.post('/:id/restart/:service', controller.restartService);

// Guardian status
router.get('/:id/guardian', controller.getGuardianStatus);

export default router;
