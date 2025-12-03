/**
 * ENTERPRISE BACKUPS & DR Router
 * Routes: /api/enterprise/backups
 */

import { Router } from 'express';
import * as backupsController from './backups.controller.js';

const router = Router();

router.get('/policies', backupsController.handleListPolicies);
router.post('/policies', backupsController.handleCreatePolicy);
router.delete('/policies/:id', backupsController.handleDeletePolicy);

router.get('/runs', backupsController.handleListBackupRuns);
router.post('/trigger', backupsController.handleTriggerBackup);

router.post('/restore', backupsController.handleRestoreBackup);
router.get('/restore-jobs', backupsController.handleListRestoreJobs);

export default router;
