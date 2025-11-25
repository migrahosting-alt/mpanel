// src/controllers/emailPreferencesController.js
/**
 * Email Preferences Controller
 * Manages user email notification preferences
 */

import pool from '../db/pool.js';
import logger from '../utils/logger.js';

/**
 * Get user's email preferences
 */
export const getEmailPreferences = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT * FROM email_preferences WHERE user_id = $1`,
      [userId]
    );

    // Return defaults if not set
    const preferences = result.rows[0] || {
      user_id: userId,
      invoice_emails: true,
      payment_emails: true,
      service_emails: true,
      marketing_emails: false,
      security_emails: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    res.json({ preferences });
  } catch (error) {
    logger.error('Error fetching email preferences:', error);
    res.status(500).json({ error: 'Failed to fetch email preferences' });
  }
};

/**
 * Update user's email preferences
 */
export const updateEmailPreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      invoice_emails,
      payment_emails,
      service_emails,
      marketing_emails,
      security_emails,
    } = req.body;

    // Check if preferences exist
    const existing = await pool.query(
      `SELECT id FROM email_preferences WHERE user_id = $1`,
      [userId]
    );

    let result;
    if (existing.rows.length > 0) {
      // Update existing preferences
      result = await pool.query(
        `UPDATE email_preferences 
         SET invoice_emails = $1, payment_emails = $2, service_emails = $3,
             marketing_emails = $4, security_emails = $5, updated_at = NOW()
         WHERE user_id = $6
         RETURNING *`,
        [
          invoice_emails ?? true,
          payment_emails ?? true,
          service_emails ?? true,
          marketing_emails ?? false,
          security_emails ?? true,
          userId,
        ]
      );
    } else {
      // Insert new preferences
      result = await pool.query(
        `INSERT INTO email_preferences 
         (user_id, invoice_emails, payment_emails, service_emails, marketing_emails, security_emails)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          userId,
          invoice_emails ?? true,
          payment_emails ?? true,
          service_emails ?? true,
          marketing_emails ?? false,
          security_emails ?? true,
        ]
      );
    }

    res.json({
      message: 'Email preferences updated successfully',
      preferences: result.rows[0],
    });
  } catch (error) {
    logger.error('Error updating email preferences:', error);
    res.status(500).json({ error: 'Failed to update email preferences' });
  }
};

/**
 * Check if user wants to receive specific email type
 */
export const shouldSendEmail = async (userId, emailType) => {
  try {
    const result = await pool.query(
      `SELECT ${emailType}_emails FROM email_preferences WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Default to true for important emails
      return ['invoice', 'payment', 'service', 'security'].includes(emailType);
    }

    return result.rows[0][`${emailType}_emails`];
  } catch (error) {
    logger.error('Error checking email preference:', error);
    // Default to true on error for important emails
    return ['invoice', 'payment', 'service', 'security'].includes(emailType);
  }
};
