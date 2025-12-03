/**
 * ENTERPRISE SSL CERTIFICATES Router
 * Routes: /api/enterprise/ssl
 */

import { Router } from 'express';
import * as sslController from './ssl.controller.js';

const router = Router();

router.get('/certificates', sslController.handleListCertificates);
router.get('/certificates/:id', sslController.handleGetCertificate);
router.post('/certificates/issue', sslController.handleIssueCertificate);
router.post('/certificates/upload-custom', sslController.handleUploadCustom);
router.post('/certificates/:id/renew', sslController.handleRenewCertificate);
router.delete('/certificates/:id', sslController.handleDeleteCertificate);

export default router;
