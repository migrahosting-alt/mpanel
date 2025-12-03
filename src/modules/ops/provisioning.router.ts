import express from 'express';
import { authMiddleware } from '../auth/auth.middleware.js';
import { requirePlatformPermission } from '../../middleware/rbac.middleware.js';
import * as controller from './provisioning.controller.js';

const router = express.Router();

router.use(authMiddleware);
router.use(requirePlatformPermission());

// List provisioning jobs
router.get('/jobs', controller.listJobs);

// Get job details
router.get('/jobs/:id', controller.getJob);

// Queue statistics
router.get('/queues', controller.getQueueStats);

// Get queue details
router.get('/queues/:name', controller.getQueueDetails);

// Retry failed job
router.post('/jobs/:id/retry', controller.retryJob);

// Cancel job
router.post('/jobs/:id/cancel', controller.cancelJob);

// Worker health
router.get('/workers', controller.getWorkerHealth);

export default router;
