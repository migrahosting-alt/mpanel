/**
 * MODULE_DATABASES Router
 * Routes: /api/hosting/databases
 */

import { Router } from 'express';
import * as databasesController from './databases.controller.js';

const router = Router();

router.get('/', databasesController.handleListDatabases);
router.get('/:id', databasesController.handleGetDatabase);
router.post('/', databasesController.handleCreateDatabase);
router.delete('/:id', databasesController.handleDeleteDatabase);

export default router;
