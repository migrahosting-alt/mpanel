/**
 * SECURITY CENTER Router
 * Routes: /api/security/*
 */

import { Router } from 'express';
import { authMiddleware, requireRole } from '../auth/index.js';
import * as securityCenterController from './security-center.controller.js';

const router = Router();

// User security profile (all authenticated users)
router.get('/me/profile', authMiddleware, securityCenterController.handleGetSecurityProfile);

// MFA endpoints (all authenticated users)
router.post('/me/mfa/enable', authMiddleware, securityCenterController.handleEnableMfa);
router.post('/me/mfa/confirm', authMiddleware, securityCenterController.handleConfirmMfa);
router.post('/me/mfa/disable', authMiddleware, securityCenterController.handleDisableMfa);

// Session management (all authenticated users)
router.get('/me/sessions', authMiddleware, securityCenterController.handleListSessions);
router.post('/me/sessions/:sessionId/revoke', authMiddleware, securityCenterController.handleRevokeSession);
router.post('/me/sessions/revoke-all', authMiddleware, securityCenterController.handleRevokeAllSessions);

// API tokens (all authenticated users)
router.get('/tokens', authMiddleware, securityCenterController.handleListApiTokens);
router.post('/tokens', authMiddleware, securityCenterController.handleCreateApiToken);
router.post('/tokens/:tokenId/revoke', authMiddleware, securityCenterController.handleRevokeApiToken);

// Security events (Admin only)
router.get('/events', authMiddleware, requireRole('ADMIN'), securityCenterController.handleListSecurityEvents);

// Tenant security policy (Admin only)
router.get('/policy', authMiddleware, requireRole('ADMIN'), securityCenterController.handleGetSecurityPolicy);
router.put('/policy', authMiddleware, requireRole('ADMIN'), securityCenterController.handleUpdateSecurityPolicy);

export default router;
