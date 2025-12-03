/**
 * CLOUDPODS Router
 * Routes: /api/cloudpods
 */

import { Router } from 'express';
import { authMiddleware, requireRole } from '../auth/index.js';
import * as cloudpodsController from './cloudpods.controller.js';

const router = Router();

router.get('/', authMiddleware, requireRole('MEMBER'), cloudpodsController.handleListCloudPods);
router.get('/:id', authMiddleware, requireRole('MEMBER'), cloudpodsController.handleGetCloudPod);
router.post('/', authMiddleware, requireRole('ADMIN'), cloudpodsController.handleCreateCloudPod);
router.put('/:id', authMiddleware, requireRole('ADMIN'), cloudpodsController.handleUpdateCloudPod);
router.post('/:id/resize', authMiddleware, requireRole('ADMIN'), cloudpodsController.handleResizeCloudPod);
router.post('/:id/suspend', authMiddleware, requireRole('ADMIN'), cloudpodsController.handleSuspendCloudPod);
router.post('/:id/resume', authMiddleware, requireRole('ADMIN'), cloudpodsController.handleResumeCloudPod);
router.delete('/:id', authMiddleware, requireRole('ADMIN'), cloudpodsController.handleDeleteCloudPod);

export default router;
