/**
 * 2FA Routes - Two-Factor Authentication endpoints
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import twoFactorAuth from '../services/twoFactorAuth.js';
const router = express.Router();

/**
 * Setup TOTP (Google Authenticator)
 */
router.post('/totp/setup', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;

    const result = await twoFactorAuth.generateTOTP(userId, userEmail);

    res.json({
      success: true,
      message: 'Scan QR code with your authenticator app',
      ...result
    });
  } catch (error) {
    logger.error('TOTP setup error:', error);
    res.status(500).json({ error: 'Failed to setup 2FA' });
  }
});

/**
 * Verify and enable TOTP
 */
router.post('/totp/verify', authenticateToken, async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification code required' });
    }

    const result = await twoFactorAuth.verifyAndEnableTOTP(req.user.id, token);

    res.json(result);
  } catch (error) {
    logger.error('TOTP verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * Send SMS verification code
 */
router.post('/sms/send', authenticateToken, async (req, res) => {
  try {
    const { phone_number } = req.body;

    if (!phone_number) {
      return res.status(400).json({ error: 'Phone number required' });
    }

    const result = await twoFactorAuth.sendSMSCode(req.user.id, phone_number);

    res.json(result);
  } catch (error) {
    logger.error('SMS send error:', error);
    res.status(500).json({ error: 'Failed to send SMS' });
  }
});

/**
 * Verify SMS code
 */
router.post('/sms/verify', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Verification code required' });
    }

    const result = await twoFactorAuth.verifySMSCode(req.user.id, code);

    res.json(result);
  } catch (error) {
    logger.error('SMS verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * Generate new backup codes
 */
router.post('/backup-codes/generate', authenticateToken, async (req, res) => {
  try {
    const codes = await twoFactorAuth.generateBackupCodes(req.user.id);

    res.json({
      success: true,
      message: 'Save these codes in a safe place. Each can only be used once.',
      codes
    });
  } catch (error) {
    logger.error('Backup codes generation error:', error);
    res.status(500).json({ error: 'Failed to generate backup codes' });
  }
});

/**
 * Disable 2FA
 */
router.post('/disable', authenticateToken, async (req, res) => {
  try {
    const { password, method = 'totp' } = req.body;

    // Verify password before disabling
    if (!password) {
      return res.status(400).json({ error: 'Password required to disable 2FA' });
    }

    // TODO: Verify password
    const result = await twoFactorAuth.disable2FA(req.user.id, method);

    res.json({
      success: true,
      message: '2FA disabled successfully'
    });
  } catch (error) {
    logger.error('2FA disable error:', error);
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

/**
 * Get 2FA status
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const status = await twoFactorAuth.is2FAEnabled(req.user.id);

    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    logger.error('2FA status check error:', error);
    res.status(500).json({ error: 'Failed to check 2FA status' });
  }
});

export default router;

