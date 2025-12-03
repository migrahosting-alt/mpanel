/**
 * ENTERPRISE CDN MANAGEMENT Router
 * Routes: /api/enterprise/cdn
 */

import { Router } from 'express';
import * as cdnController from './cdn.controller.js';

const router = Router();

router.get('/distributions', cdnController.handleListDistributions);
router.post('/distributions', cdnController.handleCreateDistribution);
router.delete('/distributions/:id', cdnController.handleDeleteDistribution);
router.post('/distributions/:distributionId/purge', cdnController.handlePurgeCache);

export default router;
