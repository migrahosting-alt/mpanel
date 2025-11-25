// src/routes/securityRoutes.js
import express from 'express';
import {
  setupTwoFactor,
  enableTwoFactorAuth,
  disableTwoFactorAuth,
  verifyTwoFactorToken,
  getTwoFactorStatus,
  regenerateBackupCodesHandler,
  sendEmailVerification,
  verifyEmail,
  getActiveSessions,
  revokeSession,
  getAuditLogs,
} from '../controllers/securityController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * Two-Factor Authentication Routes
 */

// Get 2FA status
router.get('/2fa/status', authenticateToken, getTwoFactorStatus);

// Setup 2FA (get secret + QR code)
router.post('/2fa/setup', authenticateToken, setupTwoFactor);

// Enable 2FA (verify token and enable)
router.post('/2fa/enable', authenticateToken, enableTwoFactorAuth);

// Disable 2FA
router.post('/2fa/disable', authenticateToken, disableTwoFactorAuth);

// Verify 2FA token (used during login)
router.post('/2fa/verify', verifyTwoFactorToken);

// Regenerate backup codes
router.post('/2fa/backup-codes/regenerate', authenticateToken, regenerateBackupCodesHandler);

/**
 * Email Verification Routes
 */

// Send verification email
router.post('/email/send-verification', authenticateToken, sendEmailVerification);

// Verify email with token
router.post('/email/verify', verifyEmail);

/**
 * Session Management Routes
 */

// Get active sessions
router.get('/sessions', authenticateToken, getActiveSessions);

// Revoke session
router.delete('/sessions/:sessionId', authenticateToken, revokeSession);

/**
 * Audit Log Routes
 */

// Get audit logs
router.get('/audit-logs', authenticateToken, getAuditLogs);

export default router;

