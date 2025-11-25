// src/routes/sslRoutes.js
import express from 'express';
import * as sslController from '../controllers/sslController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/ssl - List all SSL certificates
router.get('/', sslController.getCertificates);

// GET /api/ssl/stats - Get SSL statistics (admin only)
router.get('/stats', requireRole('admin'), sslController.getSSLStats);

// GET /api/ssl/:id - Get single SSL certificate
router.get('/:id', sslController.getCertificate);

// POST /api/ssl/issue - Issue new Let's Encrypt certificate
router.post('/issue', sslController.issueCertificate);

// POST /api/ssl/upload - Upload custom SSL certificate
router.post('/upload', sslController.uploadCertificate);

// POST /api/ssl/:id/renew - Renew certificate
router.post('/:id/renew', sslController.renewCertificate);

// PUT /api/ssl/:id/auto-renew - Toggle auto-renewal
router.put('/:id/auto-renew', sslController.toggleAutoRenew);

// DELETE /api/ssl/:id - Revoke/delete certificate
router.delete('/:id', sslController.deleteCertificate);

export default router;

