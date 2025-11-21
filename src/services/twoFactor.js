// src/services/twoFactor.js
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import pool from '../db/index.js';

/**
 * Two-Factor Authentication Service
 * Handles TOTP generation, verification, and backup codes
 */

/**
 * Generate a new TOTP secret for a user
 * @param {string} email - User's email address
 * @returns {Promise<{secret: string, qrCodeUrl: string, backupCodes: string[]}>}
 */
export async function generateTOTPSecret(email) {
  // Generate secret
  const secret = speakeasy.generateSecret({
    name: `mPanel (${email})`,
    issuer: 'mPanel',
    length: 32,
  });

  // Generate QR code
  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

  // Generate 10 backup codes (8 characters each, alphanumeric)
  const backupCodes = Array.from({ length: 10 }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase()
  );

  return {
    secret: secret.base32,
    qrCodeUrl,
    backupCodes,
  };
}

/**
 * Verify TOTP token
 * @param {string} secret - User's TOTP secret
 * @param {string} token - 6-digit TOTP token
 * @param {number} window - Time window for verification (default: 1)
 * @returns {boolean}
 */
export function verifyTOTP(secret, token, window = 1) {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window,
  });
}

/**
 * Enable 2FA for a user
 * @param {string} userId - User ID
 * @param {string} secret - TOTP secret
 * @param {string[]} backupCodes - Array of backup codes
 * @returns {Promise<void>}
 */
export async function enableTwoFactor(userId, secret, backupCodes) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Update user's 2FA status
    await client.query(
      `UPDATE users 
       SET two_factor_enabled = true, 
           two_factor_secret = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [secret, userId]
    );

    // Store backup codes (hashed)
    for (const code of backupCodes) {
      const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
      await client.query(
        `INSERT INTO two_factor_backup_codes (user_id, code_hash, created_at)
         VALUES ($1, $2, NOW())`,
        [userId, hashedCode]
      );
    }

    // Log security event
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, details, created_at)
       VALUES ($1, 'two_factor_enabled', 'user', '{"message": "Two-factor authentication enabled"}', NOW())`,
      [userId]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Disable 2FA for a user
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function disableTwoFactor(userId) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Update user's 2FA status
    await client.query(
      `UPDATE users 
       SET two_factor_enabled = false, 
           two_factor_secret = NULL,
           updated_at = NOW()
       WHERE id = $2`,
      [userId]
    );

    // Delete all backup codes
    await client.query(
      `DELETE FROM two_factor_backup_codes WHERE user_id = $1`,
      [userId]
    );

    // Log security event
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, details, created_at)
       VALUES ($1, 'two_factor_disabled', 'user', '{"message": "Two-factor authentication disabled"}', NOW())`,
      [userId]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Verify backup code
 * @param {string} userId - User ID
 * @param {string} code - Backup code to verify
 * @returns {Promise<boolean>}
 */
export async function verifyBackupCode(userId, code) {
  const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
  
  const result = await pool.query(
    `SELECT id FROM two_factor_backup_codes 
     WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL`,
    [userId, hashedCode]
  );

  if (result.rows.length === 0) {
    return false;
  }

  // Mark code as used
  await pool.query(
    `UPDATE two_factor_backup_codes 
     SET used_at = NOW() 
     WHERE id = $1`,
    [result.rows[0].id]
  );

  // Log security event
  await pool.query(
    `INSERT INTO audit_logs (user_id, action, resource_type, details, created_at)
     VALUES ($1, 'backup_code_used', 'user', '{"message": "Backup code used for authentication"}', NOW())`,
    [userId]
  );

  return true;
}

/**
 * Get remaining backup codes count
 * @param {string} userId - User ID
 * @returns {Promise<number>}
 */
export async function getRemainingBackupCodes(userId) {
  const result = await pool.query(
    `SELECT COUNT(*) as count 
     FROM two_factor_backup_codes 
     WHERE user_id = $1 AND used_at IS NULL`,
    [userId]
  );

  return parseInt(result.rows[0].count, 10);
}

/**
 * Regenerate backup codes
 * @param {string} userId - User ID
 * @returns {Promise<string[]>}
 */
export async function regenerateBackupCodes(userId) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Delete old backup codes
    await client.query(
      `DELETE FROM two_factor_backup_codes WHERE user_id = $1`,
      [userId]
    );

    // Generate new backup codes
    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );

    // Store new backup codes
    for (const code of backupCodes) {
      const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
      await client.query(
        `INSERT INTO two_factor_backup_codes (user_id, code_hash, created_at)
         VALUES ($1, $2, NOW())`,
        [userId, hashedCode]
      );
    }

    // Log security event
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, details, created_at)
       VALUES ($1, 'backup_codes_regenerated', 'user', '{"message": "Backup codes regenerated"}', NOW())`,
      [userId]
    );

    await client.query('COMMIT');
    return backupCodes;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
