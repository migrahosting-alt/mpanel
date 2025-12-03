/**
 * ENTERPRISE WHITE-LABEL Router
 * Routes: /api/enterprise/white-label
 */

import { Router } from 'express';
import * as whiteLabelController from './white-label.controller.js';

const router = Router();

router.get('/config', whiteLabelController.handleGetConfig);
router.put('/config', whiteLabelController.handleUpdateConfig);
router.post('/assets', whiteLabelController.handleUploadAsset);

export default router;
