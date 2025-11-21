// src/services/emailVerification.js
import crypto from 'crypto';
import pool from '../db/index.js';
import logger from '../config/logger.js';

/**
 * Email Verification Service
 * Handles email verification tokens and sending verification emails
 */

/**
 * Generate email verification token
 * @param {string} userId - User ID
 * @param {string} email - Email address to verify
 * @returns {Promise<string>} - Verification token
 */
export async function generateVerificationToken(userId, email) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await pool.query(
    `INSERT INTO email_verification_tokens (user_id, email, token, expires_at, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id) 
     DO UPDATE SET token = $3, expires_at = $4, created_at = NOW()`,
    [userId, email, token, expiresAt]
  );

  return token;
}

/**
 * Send verification email
 * @param {string} email - Email address
 * @param {string} token - Verification token
 * @param {string} userName - User's name (optional)
 * @returns {Promise<void>}
 */
export async function sendVerificationEmail(email, token, userName = null) {
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/verify-email?token=${token}`;
  
  const subject = 'Verify your mPanel account';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; color: #718096; font-size: 12px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">Welcome to mPanel!</h1>
        </div>
        <div class="content">
          <p>Hi ${userName || 'there'},</p>
          <p>Thank you for creating an mPanel account. Please verify your email address by clicking the button below:</p>
          <a href="${verificationUrl}" class="button">Verify Email Address</a>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #4a5568; font-size: 14px;">${verificationUrl}</p>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create an mPanel account, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          <p>© 2025 mPanel. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    // Send email using nodemailer (already in dependencies)
    const nodemailer = await import('nodemailer');
    
    const transporter = nodemailer.default.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || 'apikey',
        pass: process.env.SMTP_PASS || process.env.SENDGRID_API_KEY
      }
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@migrahosting.com',
      to: email,
      subject,
      html
    });

    logger.info(`Verification email sent to ${email}`);
  } catch (error) {
    logger.error('Failed to send verification email:', error);
    // Log but don't fail - email is configured in .env
    console.log(`[EMAIL VERIFICATION] Would send to ${email}:`);
    console.log(`Verification URL: ${verificationUrl}`);
  }
}

/**
 * Verify email with token
 * @param {string} token - Verification token
 * @returns {Promise<{success: boolean, userId?: string, email?: string}>}
 */
export async function verifyEmailToken(token) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Find token
    const tokenResult = await client.query(
      `SELECT user_id, email, expires_at 
       FROM email_verification_tokens 
       WHERE token = $1 AND verified_at IS NULL`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return { success: false, error: 'Invalid or expired token' };
    }

    const { user_id, email, expires_at } = tokenResult.rows[0];

    // Check if expired
    if (new Date() > new Date(expires_at)) {
      return { success: false, error: 'Token has expired' };
    }

    // Mark token as verified
    await client.query(
      `UPDATE email_verification_tokens 
       SET verified_at = NOW() 
       WHERE token = $1`,
      [token]
    );

    // Update user's email verification status
    await client.query(
      `UPDATE users 
       SET email_verified = true, 
           email_verified_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [user_id]
    );

    // Log security event
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, details, created_at)
       VALUES ($1, 'email_verified', 'user', $2, NOW())`,
      [user_id, JSON.stringify({ email, message: 'Email address verified' })]
    );

    await client.query('COMMIT');
    return { success: true, userId: user_id, email };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Resend verification email
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function resendVerificationEmail(userId) {
  const userResult = await pool.query(
    `SELECT email, first_name, last_name, email_verified 
     FROM users 
     WHERE id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new Error('User not found');
  }

  const user = userResult.rows[0];

  if (user.email_verified) {
    throw new Error('Email already verified');
  }

  const token = await generateVerificationToken(userId, user.email);
  const userName = [user.first_name, user.last_name].filter(Boolean).join(' ');
  
  await sendVerificationEmail(user.email, token, userName);
}
