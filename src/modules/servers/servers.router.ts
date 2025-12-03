/**
 * Servers Router - Platform server management
 */

import express from 'express';
import * as serversController from './servers.controller.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { requirePlatformPermission } from '../../middleware/rbac.middleware.js';

const router = express.Router();

router.use(authMiddleware);
router.use(requirePlatformPermission('platform:servers:manage'));

/**
 * GET /api/platform/servers
 */
router.get('/', serversController.listServers);

/**
 * POST /api/platform/servers
 */
router.post('/', serversController.createServer);

/**
 * PATCH /api/platform/servers/:id
 */
router.patch('/:id', serversController.updateServer);

/**
 * POST /api/platform/servers/:id/status
 */
router.post('/:id/status', serversController.changeStatus);

/**
 * POST /api/platform/servers/:id/test-connection
 */
router.post('/:id/test-connection', serversController.testConnection);

export default router;
