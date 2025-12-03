/**
 * MODULE_WEBSITES Router
 * Routes: /api/hosting/websites
 */

import { Router } from 'express';
import * as websitesController from './websites.controller.js';

const router = Router();

router.get('/', websitesController.handleListWebsites);
router.get('/:id', websitesController.handleGetWebsite);
router.post('/', websitesController.handleCreateWebsite);
router.patch('/:id', websitesController.handleUpdateWebsite);
router.post('/:id/deploy', websitesController.handleDeployWebsite);
router.post('/:id/ssl/issue', websitesController.handleIssueSsl);
router.delete('/:id', websitesController.handleDeleteWebsite);

export default router;
