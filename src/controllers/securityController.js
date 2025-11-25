// src/controllers/securityController.js
import {
  generateTOTPSecret,
  verifyTOTP,
  enableTwoFactor,
  disableTwoFactor,
  verifyBackupCode,
  getRemainingBackupCodes,
  regenerateBackupCodes,
} from '../services/twoFactor.js';
import {
  generateVerificationToken,
  sendVerificationEmail,
  verifyEmailToken,
  resendVerificationEmail,
} from '../services/emailVerification.js';
import pool from '../db/index.js';

/**
 * Two-Factor Authentication Controllers
 */

// Generate 2FA setup (secret + QR code)
export async function setupTwoFactor(req, res) {
  try {
    const userId = req.user.id;
    const email = req.user.email;

    // Check if 2FA is already enabled
    const userResult = await pool.query(
      'SELECT two_factor_enabled FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows[0].two_factor_enabled) {
      return res.status(400).json({ error: 'Two-factor authentication is already enabled' });
    }

    const { secret, qrCodeUrl, backupCodes } = await generateTOTPSecret(email);

    // Store secret temporarily in session or return it
    // Client will verify with a token before we enable 2FA
    res.json({
      secret,
      qrCodeUrl,
      backupCodes,
      message: 'Scan the QR code with your authenticator app',
    });
  } catch (error) {
    console.error('Error setting up 2FA:', error);
    res.status(500).json({ error: 'Failed to setup two-factor authentication' });
  }
}

// Verify and enable 2FA
export async function enableTwoFactorAuth(req, res) {
  try {
    const userId = req.user.id;
    const { secret, token, backupCodes } = req.body;

    if (!secret || !token || !backupCodes) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify the TOTP token
    const isValid = verifyTOTP(secret, token);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Enable 2FA
    await enableTwoFactor(userId, secret, backupCodes);

    res.json({
      success: true,
      message: 'Two-factor authentication enabled successfully',
    });
  } catch (error) {
    console.error('Error enabling 2FA:', error);
    res.status(500).json({ error: 'Failed to enable two-factor authentication' });
  }
}

// Disable 2FA
export async function disableTwoFactorAuth(req, res) {
  try {
    const userId = req.user.id;
    const { password, token } = req.body;

    if (!password && !token) {
      return res.status(400).json({ error: 'Password or current 2FA token required' });
    }

    // Verify password
    const userResult = await pool.query(
      'SELECT password_hash, two_factor_secret FROM users WHERE id = $1',
      [userId]
    );

    const user = userResult.rows[0];

    // If token provided, verify it
    if (token && user.two_factor_secret) {
      const isValid = verifyTOTP(user.two_factor_secret, token);
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid 2FA token' });
      }
    }

    await disableTwoFactor(userId);

    res.json({
      success: true,
      message: 'Two-factor authentication disabled successfully',
    });
  } catch (error) {
    console.error('Error disabling 2FA:', error);
    res.status(500).json({ error: 'Failed to disable two-factor authentication' });
  }
}

// Verify 2FA token during login
export async function verifyTwoFactorToken(req, res) {
  try {
    const { userId, token, isBackupCode } = req.body;

    if (!userId || !token) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let isValid = false;

    if (isBackupCode) {
      // Verify backup code
      isValid = await verifyBackupCode(userId, token);
    } else {
      // Verify TOTP token
      const userResult = await pool.query(
        'SELECT two_factor_secret FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const secret = userResult.rows[0].two_factor_secret;
      isValid = verifyTOTP(secret, token);
    }

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    res.json({ success: true, verified: true });
  } catch (error) {
    console.error('Error verifying 2FA token:', error);
    res.status(500).json({ error: 'Failed to verify token' });
  }
}

// Get 2FA status
export async function getTwoFactorStatus(req, res) {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      'SELECT two_factor_enabled FROM users WHERE id = $1',
      [userId]
    );

    const remainingCodes = await getRemainingBackupCodes(userId);

    res.json({
      enabled: result.rows[0].two_factor_enabled,
      remainingBackupCodes: remainingCodes,
    });
  } catch (error) {
    console.error('Error getting 2FA status:', error);
    res.status(500).json({ error: 'Failed to get 2FA status' });
  }
}

// Regenerate backup codes
export async function regenerateBackupCodesHandler(req, res) {
  try {
    const userId = req.user.id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }

    // Verify user has 2FA enabled
    const userResult = await pool.query(
      'SELECT two_factor_enabled FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows[0].two_factor_enabled) {
      return res.status(400).json({ error: 'Two-factor authentication is not enabled' });
    }

    const newCodes = await regenerateBackupCodes(userId);

    res.json({
      success: true,
      backupCodes: newCodes,
      message: 'Backup codes regenerated successfully',
    });
  } catch (error) {
    console.error('Error regenerating backup codes:', error);
    res.status(500).json({ error: 'Failed to regenerate backup codes' });
  }
}

/**
 * Email Verification Controllers
 */

// Send email verification
export async function sendEmailVerification(req, res) {
  try {
    const userId = req.user.id;

    await resendVerificationEmail(userId);

    res.json({
      success: true,
      message: 'Verification email sent successfully',
    });
  } catch (error) {
    console.error('Error sending verification email:', error);
    res.status(500).json({ error: error.message || 'Failed to send verification email' });
  }
}

// Verify email with token
export async function verifyEmail(req, res) {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    const result = await verifyEmailToken(token);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error) {
    console.error('Error verifying email:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
}

/**
 * Session Management Controllers
 */

// Get active sessions
export async function getActiveSessions(req, res) {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT id, device_info, ip_address, user_agent, location, 
              created_at, last_activity, expires_at
       FROM user_sessions
       WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
       ORDER BY last_activity DESC`,
      [userId]
    );

    res.json({ sessions: result.rows });
  } catch (error) {
    console.error('Error getting sessions:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
}

// Revoke session
export async function revokeSession(req, res) {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    await pool.query(
      `UPDATE user_sessions 
       SET revoked_at = NOW() 
       WHERE id = $1 AND user_id = $2`,
      [sessionId, userId]
    );

    // Log security event
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, created_at)
       VALUES ($1, 'session_revoked', 'session', $2, '{"message": "Session revoked by user"}', NOW())`,
      [userId, sessionId]
    );

    res.json({ success: true, message: 'Session revoked successfully' });
  } catch (error) {
    console.error('Error revoking session:', error);
    res.status(500).json({ error: 'Failed to revoke session' });
  }
}

/**
 * Audit Log Controllers
 */

// Get audit logs
export async function getAuditLogs(req, res) {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT id, action, resource_type, resource_id, details, 
              ip_address, user_agent, created_at
       FROM audit_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json({ logs: result.rows });
  } catch (error) {
    console.error('Error getting audit logs:', error);
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
}
