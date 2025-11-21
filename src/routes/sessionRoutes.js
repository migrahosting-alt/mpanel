/**
 * Session Management Routes
 * Multi-device session tracking and security
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';
import session from '../services/sessionService.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/sessions
 * Get current user's active sessions
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const sessions = await session.getUserSessions(req.user.id);
    res.json({ data: sessions });
  } catch (error) {
    logger.error('Error getting sessions:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

/**
 * DELETE /api/sessions/:id
 * Terminate specific session
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await session.terminateSession(req.params.id, req.user.id);
    
    if (result.success) {
      res.json({ message: 'Session terminated successfully' });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Error terminating session:', error);
    res.status(500).json({ error: 'Failed to terminate session' });
  }
});

/**
 * DELETE /api/sessions/all
 * Logout from all devices except current
 */
router.delete('/all/except-current', authenticateToken, async (req, res) => {
  try {
    const currentSessionId = req.body.currentSessionId; // Pass from frontend
    const result = await session.terminateAllSessions(req.user.id, currentSessionId);
    
    if (result.success) {
      res.json({ 
        message: `Logged out from ${result.terminated} devices`,
        terminated: result.terminated
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Error terminating all sessions:', error);
    res.status(500).json({ error: 'Failed to logout from all devices' });
  }
});

/**
 * GET /api/admin/sessions/stats
 * Get session statistics (admin)
 */
router.get('/admin/stats', authenticateToken, requirePermission('sessions.read'), async (req, res) => {
  try {
    const stats = await session.getSessionStats(req.user.tenantId);
    res.json({ data: stats });
  } catch (error) {
    logger.error('Error getting session stats:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

export default router;
