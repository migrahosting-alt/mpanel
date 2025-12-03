/**
 * ENTERPRISE KUBERNETES Router
 * Routes: /api/enterprise/kubernetes
 */

import { Router } from 'express';
import * as kubernetesController from './kubernetes.controller.js';

const router = Router();

router.get('/clusters', kubernetesController.handleListClusters);
router.post('/clusters', kubernetesController.handleRegisterCluster);
router.get('/clusters/:id/health', kubernetesController.handleGetClusterHealth);
router.delete('/clusters/:id', kubernetesController.handleDeleteCluster);

export default router;
