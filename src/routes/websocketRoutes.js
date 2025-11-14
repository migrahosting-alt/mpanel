/**
 * WebSocket Routes - HTTP endpoints for WebSocket management
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import websocketService from '../services/websocketService.js';
import logger from '../config/logger.js';

const router = express.Router();

/**
 * Get online users in tenant
 */
router.get('/online-users', authenticateToken, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const onlineUsers = websocketService.getOnlineUsers(tenantId);

    res.json({
      success: true,
      count: onlineUsers.length,
      users: onlineUsers
    });
  } catch (error) {
    logger.error('Error fetching online users:', error);
    res.status(500).json({ error: 'Failed to fetch online users' });
  }
});

/**
 * Send notification to user
 */
router.post('/notify/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { title, message, type, action } = req.body;

    // Verify permission (admin only or same user)
    if (req.user.role !== 'admin' && req.user.id !== parseInt(userId)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    websocketService.sendNotification(parseInt(userId), {
      title,
      message,
      type: type || 'info',
      action
    });

    res.json({ success: true, message: 'Notification sent' });
  } catch (error) {
    logger.error('Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

/**
 * Broadcast to tenant
 */
router.post('/broadcast', authenticateToken, async (req, res) => {
  try {
    // Admin only
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { event, data } = req.body;
    const tenantId = req.user.tenant_id;

    websocketService.broadcastToTenant(tenantId, event, data);

    res.json({ success: true, message: 'Broadcast sent' });
  } catch (error) {
    logger.error('Error broadcasting:', error);
    res.status(500).json({ error: 'Failed to broadcast' });
  }
});

/**
 * Trigger resource metrics update
 */
router.post('/metrics/:resourceType/:resourceId', authenticateToken, async (req, res) => {
  try {
    const { resourceType, resourceId } = req.params;
    const { metrics } = req.body;

    websocketService.sendResourceMetrics(resourceType, resourceId, metrics);

    res.json({ success: true });
  } catch (error) {
    logger.error('Error sending metrics:', error);
    res.status(500).json({ error: 'Failed to send metrics' });
  }
});

export default router;
