/**
 * Notification Preferences Routes
 * Manage user notification settings
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import notificationPrefs from '../services/notificationPreferencesService.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/notification-preferences
 * Get current user's notification preferences
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const prefs = await notificationPrefs.getUserPreferences(req.user.id);
    res.json({ data: prefs });
  } catch (error) {
    logger.error('Error getting notification preferences:', error);
    res.status(500).json({ error: 'Failed to get notification preferences' });
  }
});

/**
 * PUT /api/notification-preferences
 * Update notification preferences
 */
router.put('/', authenticateToken, async (req, res) => {
  try {
    const prefs = await notificationPrefs.updatePreferences(req.user.id, req.body);
    res.json({ data: prefs, message: 'Preferences updated successfully' });
  } catch (error) {
    logger.error('Error updating notification preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

/**
 * POST /api/notification-preferences/verify-phone
 * Send phone verification code
 */
router.post('/verify-phone', authenticateToken, async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    
    const result = await notificationPrefs.sendPhoneVerification(req.user.id, phoneNumber);
    
    if (result.success) {
      res.json({ message: 'Verification code sent' });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Error sending phone verification:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

/**
 * POST /api/notification-preferences/confirm-phone
 * Verify phone with code
 */
router.post('/confirm-phone', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Verification code is required' });
    }
    
    const result = await notificationPrefs.verifyPhoneNumber(req.user.id, code);
    
    if (result.success) {
      res.json({ message: 'Phone number verified successfully' });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Error verifying phone:', error);
    res.status(500).json({ error: 'Failed to verify phone number' });
  }
});

/**
 * POST /api/notification-preferences/unsubscribe/:category
 * Unsubscribe from category (public endpoint with token in body)
 */
router.post('/unsubscribe/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { userId } = req.body; // From email link
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const result = await notificationPrefs.unsubscribe(userId, category);
    
    if (result.success) {
      res.json({ message: `Unsubscribed from ${category} emails` });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Error unsubscribing:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

/**
 * GET /api/admin/notification-preferences/stats
 * Get notification statistics (admin only)
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await notificationPrefs.getNotificationStats(req.user.tenantId);
    res.json({ data: stats });
  } catch (error) {
    logger.error('Error getting notification stats:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

export default router;
