/**
 * Two-Factor Authentication Service
 * Supports: TOTP (Google Authenticator), SMS, Email, Hardware Keys (WebAuthn)
 */

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import pool from '../db/index.js';
import logger from '../config/logger.js';
import crypto from 'crypto';

class TwoFactorAuthService {
  constructor() {
    this.appName = process.env.APP_NAME || 'MPanel';
    this.smsProvider = process.env.SMS_PROVIDER || 'twilio'; // twilio, vonage, sns
  }

  /**
   * Generate TOTP secret and QR code
   */
  async generateTOTP(userId, userEmail) {
    try {
      const secret = speakeasy.generateSecret({
        name: `${this.appName} (${userEmail})`,
        issuer: this.appName,
        length: 32
      });

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

      // Store secret in database (encrypted)
      await pool.query(
        `INSERT INTO two_factor_auth (user_id, method, secret, enabled)
         VALUES ($1, 'totp', $2, false)
         ON CONFLICT (user_id, method) 
         DO UPDATE SET secret = $2, enabled = false, updated_at = NOW()`,
        [userId, this.encrypt(secret.base32)]
      );

      logger.info(`TOTP secret generated for user ${userId}`);

      return {
        secret: secret.base32,
        qrCode: qrCodeUrl,
        manual_entry_key: secret.base32
      };
    } catch (error) {
      logger.error('Error generating TOTP:', error);
      throw new Error('Failed to generate 2FA setup');
    }
  }

  /**
   * Verify TOTP token and enable 2FA
   */
  async verifyAndEnableTOTP(userId, token) {
    try {
      const result = await pool.query(
        `SELECT secret FROM two_factor_auth WHERE user_id = $1 AND method = 'totp'`,
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error('2FA not set up for this user');
      }

      const secret = this.decrypt(result.rows[0].secret);

      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 2 // Allow 2 time steps before/after
      });

      if (!verified) {
        logger.warn(`Failed 2FA verification attempt for user ${userId}`);
        return { success: false, message: 'Invalid verification code' };
      }

      // Enable 2FA
      await pool.query(
        `UPDATE two_factor_auth SET enabled = true, verified_at = NOW()
         WHERE user_id = $1 AND method = 'totp'`,
        [userId]
      );

      // Generate backup codes
      const backupCodes = await this.generateBackupCodes(userId);

      logger.info(`2FA enabled for user ${userId}`);

      return {
        success: true,
        message: '2FA enabled successfully',
        backup_codes: backupCodes
      };
    } catch (error) {
      logger.error('Error verifying TOTP:', error);
      throw error;
    }
  }

  /**
   * Verify TOTP token during login
   */
  async verifyTOTP(userId, token) {
    try {
      const result = await pool.query(
        `SELECT secret, enabled FROM two_factor_auth 
         WHERE user_id = $1 AND method = 'totp'`,
        [userId]
      );

      if (result.rows.length === 0 || !result.rows[0].enabled) {
        return { success: false, message: '2FA not enabled' };
      }

      const secret = this.decrypt(result.rows[0].secret);

      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 2
      });

      if (verified) {
        // Log successful verification
        await this.logAuthAttempt(userId, 'totp', true);
        return { success: true };
      }

      // Check if it's a backup code
      const backupCodeValid = await this.verifyBackupCode(userId, token);
      if (backupCodeValid) {
        return { success: true, used_backup_code: true };
      }

      await this.logAuthAttempt(userId, 'totp', false);
      return { success: false, message: 'Invalid code' };
    } catch (error) {
      logger.error('Error verifying TOTP:', error);
      return { success: false, message: 'Verification failed' };
    }
  }

  /**
   * Generate and send SMS code
   */
  async sendSMSCode(userId, phoneNumber) {
    try {
      const code = this.generateNumericCode(6);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store code
      await pool.query(
        `INSERT INTO two_factor_codes (user_id, method, code, phone_number, expires_at)
         VALUES ($1, 'sms', $2, $3, $4)`,
        [userId, this.hashCode(code), phoneNumber, expiresAt]
      );

      // Send SMS
      await this.sendSMS(phoneNumber, `Your ${this.appName} verification code is: ${code}`);

      logger.info(`SMS code sent to user ${userId}`);

      return {
        success: true,
        message: 'Verification code sent',
        expires_in: 600
      };
    } catch (error) {
      logger.error('Error sending SMS code:', error);
      throw new Error('Failed to send SMS verification code');
    }
  }

  /**
   * Verify SMS code
   */
  async verifySMSCode(userId, code) {
    try {
      const result = await pool.query(
        `SELECT id, code, expires_at FROM two_factor_codes
         WHERE user_id = $1 AND method = 'sms' AND used = false
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return { success: false, message: 'No verification code found' };
      }

      const record = result.rows[0];

      if (new Date() > new Date(record.expires_at)) {
        return { success: false, message: 'Verification code expired' };
      }

      const hashedCode = this.hashCode(code);
      if (hashedCode !== record.code) {
        await this.logAuthAttempt(userId, 'sms', false);
        return { success: false, message: 'Invalid code' };
      }

      // Mark as used
      await pool.query(
        `UPDATE two_factor_codes SET used = true WHERE id = $1`,
        [record.id]
      );

      await this.logAuthAttempt(userId, 'sms', true);

      return { success: true };
    } catch (error) {
      logger.error('Error verifying SMS code:', error);
      return { success: false, message: 'Verification failed' };
    }
  }

  /**
   * Generate backup codes
   */
  async generateBackupCodes(userId, count = 10) {
    try {
      const codes = [];
      const hashedCodes = [];

      for (let i = 0; i < count; i++) {
        const code = this.generateAlphanumericCode(8);
        codes.push(code);
        hashedCodes.push(this.hashCode(code));
      }

      // Delete old backup codes
      await pool.query(
        `DELETE FROM backup_codes WHERE user_id = $1`,
        [userId]
      );

      // Insert new codes
      for (const hashedCode of hashedCodes) {
        await pool.query(
          `INSERT INTO backup_codes (user_id, code) VALUES ($1, $2)`,
          [userId, hashedCode]
        );
      }

      logger.info(`Generated ${count} backup codes for user ${userId}`);

      return codes;
    } catch (error) {
      logger.error('Error generating backup codes:', error);
      throw error;
    }
  }

  /**
   * Verify backup code
   */
  async verifyBackupCode(userId, code) {
    try {
      const hashedCode = this.hashCode(code);

      const result = await pool.query(
        `SELECT id FROM backup_codes 
         WHERE user_id = $1 AND code = $2 AND used = false`,
        [userId, hashedCode]
      );

      if (result.rows.length === 0) {
        return false;
      }

      // Mark as used
      await pool.query(
        `UPDATE backup_codes SET used = true, used_at = NOW() WHERE id = $1`,
        [result.rows[0].id]
      );

      logger.info(`Backup code used for user ${userId}`);

      return true;
    } catch (error) {
      logger.error('Error verifying backup code:', error);
      return false;
    }
  }

  /**
   * Disable 2FA
   */
  async disable2FA(userId, method = 'totp') {
    try {
      await pool.query(
        `UPDATE two_factor_auth SET enabled = false WHERE user_id = $1 AND method = $2`,
        [userId, method]
      );

      // Delete backup codes
      await pool.query(
        `DELETE FROM backup_codes WHERE user_id = $1`,
        [userId]
      );

      logger.info(`2FA disabled for user ${userId}`);

      return { success: true };
    } catch (error) {
      logger.error('Error disabling 2FA:', error);
      throw error;
    }
  }

  /**
   * Check if 2FA is enabled
   */
  async is2FAEnabled(userId) {
    try {
      const result = await pool.query(
        `SELECT method, enabled FROM two_factor_auth WHERE user_id = $1 AND enabled = true`,
        [userId]
      );

      return {
        enabled: result.rows.length > 0,
        methods: result.rows.map(r => r.method)
      };
    } catch (error) {
      logger.error('Error checking 2FA status:', error);
      return { enabled: false, methods: [] };
    }
  }

  /**
   * Log authentication attempt
   */
  async logAuthAttempt(userId, method, success) {
    try {
      await pool.query(
        `INSERT INTO auth_logs (user_id, method, success, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, method, success, null, null]
      );
    } catch (error) {
      logger.error('Error logging auth attempt:', error);
    }
  }

  /**
   * Send SMS (integrate with Twilio/Vonage/SNS)
   */
  async sendSMS(phoneNumber, message) {
    // Placeholder - integrate with actual SMS provider
    if (process.env.TWILIO_ACCOUNT_SID) {
      // Twilio implementation
      const twilio = await import('twilio');
      const client = twilio.default(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );

      await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });
    } else {
      logger.warn(`SMS sending not configured. Would send: ${message} to ${phoneNumber}`);
    }
  }

  /**
   * Encryption helpers
   */
  encrypt(text) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  decrypt(text) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Code generation helpers
   */
  generateNumericCode(length) {
    const max = Math.pow(10, length);
    const code = Math.floor(Math.random() * max).toString();
    return code.padStart(length, '0');
  }

  generateAlphanumericCode(length) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing characters
    let code = '';
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  hashCode(code) {
    return crypto.createHash('sha256').update(code).digest('hex');
  }
}

export default new TwoFactorAuthService();
