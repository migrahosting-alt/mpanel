/**
 * MODULE_FILE_MANAGER Router
 * Routes: /api/hosting/files
 */

import { Router } from 'express';
import * as fileManagerController from './fileManager.controller.js';

const router = Router();

router.get('/tree', fileManagerController.handleBrowseFiles);
router.post('/operate', fileManagerController.handleFileOperation);

export default router;
