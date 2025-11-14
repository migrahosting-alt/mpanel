// src/routes/appInstallerRoutes.js
import express from 'express';
import * as appInstallerController from '../controllers/appInstallerController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Template routes
router.get('/templates', appInstallerController.getTemplates);

// Installation routes
router.get('/', appInstallerController.getInstalled);
router.get('/:id', appInstallerController.getInstallation);
router.post('/install', appInstallerController.install);
router.delete('/:id', appInstallerController.uninstall);
router.put('/:id', appInstallerController.update);

export default router;
