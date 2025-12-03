/**
 * MODULE_SERVERS Router
 * Routes: /api/hosting/servers
 */

import { Router } from 'express';
import * as serversController from './servers.controller.js';
// import { requirePlatformPermission } from '../../../middleware/rbac.js';

const router = Router();

// List servers
router.get('/', serversController.handleListServers);

// Get server by ID
router.get('/:id', serversController.handleGetServer);

// Create server
router.post('/', serversController.handleCreateServer);

// Server actions (reboot, shutdown, etc)
router.post('/:id/actions', serversController.handleServerAction);

// Delete server
router.delete('/:id', serversController.handleDeleteServer);

export default router;
