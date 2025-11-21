/**
 * Notification Preferences Service
 * Manage user notification preferences across all channels
 */

import pool from '../db/index.js';
import logger from '../utils/logger.js';

/**
 * Get user notification preferences
 */
export async function getUserPreferences(userId) {
  try {
    const result = await pool.query(
      'SELECT * FROM notification_preferences WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      // Create default preferences
      return await createDefaultPreferences(userId);
    }
    
    return result.rows[0];
  } catch (error) {
    logger.error('Error getting user preferences:', error);
    throw error;
  }
}

/**
 * Create default notification preferences for user
 */
export async function createDefaultPreferences(userId, tenantId = null) {
  try {
    const result = await pool.query(
      `INSERT INTO notification_preferences (user_id, tenant_id)
       VALUES ($1, $2)
       RETURNING *`,
      [userId, tenantId]
    );
    
    logger.info(`Created default preferences for user ${userId}`);
    return result.rows[0];
  } catch (error) {
    logger.error('Error creating default preferences:', error);
    throw error;
  }
}

/**
 * Update notification preferences
 */
export async function updatePreferences(userId, preferences) {
  try {
    const {
      emailEnabled,
      smsEnabled,
      pushEnabled,
      webhookEnabled,
      billingNotifications,
      supportNotifications,
      marketingNotifications,
      securityNotifications,
      productUpdates,
      phoneNumber,
    } = preferences;
    
    const result = await pool.query(
      `UPDATE notification_preferences 
       SET 
         email_enabled = COALESCE($2, email_enabled),
         sms_enabled = COALESCE($3, sms_enabled),
         push_enabled = COALESCE($4, push_enabled),
         webhook_enabled = COALESCE($5, webhook_enabled),
         billing_notifications = COALESCE($6, billing_notifications),
         support_notifications = COALESCE($7, support_notifications),
         marketing_notifications = COALESCE($8, marketing_notifications),
         security_notifications = COALESCE($9, security_notifications),
         product_updates = COALESCE($10, product_updates),
         phone_number = COALESCE($11, phone_number),
         updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      [
        userId,
        emailEnabled,
        smsEnabled,
        pushEnabled,
        webhookEnabled,
        billingNotifications ? JSON.stringify(billingNotifications) : null,
        supportNotifications ? JSON.stringify(supportNotifications) : null,
        marketingNotifications ? JSON.stringify(marketingNotifications) : null,
        securityNotifications ? JSON.stringify(securityNotifications) : null,
        productUpdates ? JSON.stringify(productUpdates) : null,
        phoneNumber,
      ]
    );
    
    if (result.rows.length === 0) {
      // Create if doesn't exist
      return await createDefaultPreferences(userId);
    }
    
    logger.info(`Updated preferences for user ${userId}`);
    return result.rows[0];
  } catch (error) {
    logger.error('Error updating preferences:', error);
    throw error;
  }
}

/**
 * Check if user should receive notification
 */
export async function shouldNotify(userId, category, channel = 'email') {
  try {
    const prefs = await getUserPreferences(userId);
    
    // Check if channel is enabled
    const channelKey = `${channel}_enabled`;
    if (!prefs[channelKey]) {
      return false;
    }
    
    // Check category preferences
    const categoryKey = `${category}_notifications`;
    if (!prefs[categoryKey]) {
      return true; // Default to true if category doesn't exist
    }
    
    const categoryPrefs = prefs[categoryKey];
    return categoryPrefs[channel] !== false;
  } catch (error) {
    logger.error('Error checking notification preferences:', error);
    return true; // Default to sending if error
  }
}

/**
 * Verify phone number (send verification code)
 */
export async function sendPhoneVerification(userId, phoneNumber) {
  try {
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store in Redis with 10-minute expiry
    const redis = (await import('../db/redis.js')).default;
    await redis.setex(`phone_verify:${userId}`, 600, code);
    
    // Send SMS with code via queue
    const queueService = (await import('./queueService.js')).default;
    await queueService.addSMSJob({
      userId,
      to: phoneNumber,
      message: `Your MigraHosting verification code is: ${code}. Valid for 10 minutes.`,
      purpose: '2fa',
      priority: 1, // High priority
    });
    
    logger.info(`Sent verification code to ${phoneNumber} for user ${userId}`);
    return { success: true, message: 'Verification code sent via SMS' };
  } catch (error) {
    logger.error('Error sending phone verification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Verify phone number with code
 */
export async function verifyPhoneNumber(userId, code) {
  try {
    const redis = (await import('../db/redis.js')).default;
    const storedCode = await redis.get(`phone_verify:${userId}`);
    
    if (!storedCode) {
      return { success: false, error: 'Verification code expired' };
    }
    
    if (storedCode !== code) {
      return { success: false, error: 'Invalid verification code' };
    }
    
    // Mark as verified
    await pool.query(
      'UPDATE notification_preferences SET phone_verified = true WHERE user_id = $1',
      [userId]
    );
    
    // Delete verification code
    await redis.del(`phone_verify:${userId}`);
    
    logger.info(`Phone verified for user ${userId}`);
    return { success: true };
  } catch (error) {
    logger.error('Error verifying phone number:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Unsubscribe from category
 */
export async function unsubscribe(userId, category) {
  try {
    const prefs = await getUserPreferences(userId);
    const categoryKey = `${category}_notifications`;
    
    const categoryPrefs = prefs[categoryKey] || {};
    categoryPrefs.email = false;
    
    await pool.query(
      `UPDATE notification_preferences 
       SET ${categoryKey} = $1, updated_at = NOW()
       WHERE user_id = $2`,
      [JSON.stringify(categoryPrefs), userId]
    );
    
    logger.info(`User ${userId} unsubscribed from ${category}`);
    return { success: true };
  } catch (error) {
    logger.error('Error unsubscribing:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get notification statistics for tenant
 */
export async function getNotificationStats(tenantId) {
  try {
    const result = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE email_enabled = true) as email_enabled_count,
        COUNT(*) FILTER (WHERE sms_enabled = true) as sms_enabled_count,
        COUNT(*) FILTER (WHERE push_enabled = true) as push_enabled_count,
        COUNT(*) FILTER (WHERE phone_verified = true) as phone_verified_count,
        COUNT(*) as total_users
       FROM notification_preferences
       WHERE tenant_id = $1`,
      [tenantId]
    );
    
    return result.rows[0];
  } catch (error) {
    logger.error('Error getting notification stats:', error);
    throw error;
  }
}

export default {
  getUserPreferences,
  createDefaultPreferences,
  updatePreferences,
  shouldNotify,
  sendPhoneVerification,
  verifyPhoneNumber,
  unsubscribe,
  getNotificationStats,
};
