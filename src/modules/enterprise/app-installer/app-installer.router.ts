/**
 * ENTERPRISE APP INSTALLER Router
 * Routes: /api/enterprise/app-installer
 */

import { Router } from 'express';
import * as appInstallerController from './app-installer.controller.js';

const router = Router();

router.get('/templates', appInstallerController.handleListTemplates);
router.get('/templates/:slug', appInstallerController.handleGetTemplate);
router.get('/installations', appInstallerController.handleListInstallations);
router.get('/installations/:id', appInstallerController.handleGetInstallation);
router.post('/installations', appInstallerController.handleInstallApp);
router.delete('/installations/:id', appInstallerController.handleDeleteInstallation);

export default router;
