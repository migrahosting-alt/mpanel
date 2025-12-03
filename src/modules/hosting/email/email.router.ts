/**
 * MODULE_EMAIL Router
 * Routes: /api/hosting/email
 */

import { Router } from 'express';
import * as emailController from './email.controller.js';

const router = Router();

router.get('/domains', emailController.handleListEmailDomains);
router.post('/domains', emailController.handleCreateEmailDomain);
router.get('/domains/:emailDomainId/accounts', emailController.handleListEmailAccounts);
router.post('/domains/:emailDomainId/accounts', emailController.handleCreateEmailAccount);

export default router;
