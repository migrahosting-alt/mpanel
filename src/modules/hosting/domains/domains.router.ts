/**
 * MODULE_DOMAINS Router
 * Routes: /api/hosting/domains
 */

import { Router } from 'express';
import * as domainsController from './domains.controller.js';

const router = Router();

router.get('/', domainsController.handleListDomains);
router.get('/:id', domainsController.handleGetDomain);
router.post('/import', domainsController.handleImportDomain);
router.post('/register', domainsController.handleRegisterDomain);

export default router;
