// src/routes/backupRoutes.js
import express from 'express';
import * as backupController from '../controllers/backupController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Backup routes
router.get('/', backupController.getBackups);
router.get('/:id', backupController.getBackup);
router.post('/', backupController.createBackup);
router.post('/:id/restore', backupController.restoreBackup);
router.delete('/:id', backupController.deleteBackup);

// Schedule routes
router.get('/schedules/list', backupController.getSchedules);
router.post('/schedules', backupController.createSchedule);
router.put('/schedules/:id', backupController.updateSchedule);
router.delete('/schedules/:id', backupController.deleteSchedule);

export default router;

