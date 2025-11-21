/**
 * CSAT Survey Routes
 * Customer satisfaction and NPS surveys
 */

import express from 'express';
import pool from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';
import csat from '../services/csatService.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/surveys
 * Get surveys for current user
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM csat_surveys WHERE user_id = $1 ORDER BY sent_at DESC',
      [req.user.id]
    );
    
    res.json({ data: result.rows });
  } catch (error) {
    logger.error('Error getting surveys:', error);
    res.status(500).json({ error: 'Failed to get surveys' });
  }
});

/**
 * GET /api/surveys/:id
 * Get survey by ID (public endpoint for email links)
 */
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM csat_surveys WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Survey not found' });
    }
    
    res.json({ data: result.rows[0] });
  } catch (error) {
    logger.error('Error getting survey:', error);
    res.status(500).json({ error: 'Failed to get survey' });
  }
});

/**
 * POST /api/surveys/:id/respond
 * Submit survey response (public endpoint)
 */
router.post('/:id/respond', async (req, res) => {
  try {
    const { score, feedback } = req.body;
    
    if (score === undefined) {
      return res.status(400).json({ error: 'Score is required' });
    }
    
    const survey = await csat.submitResponse(req.params.id, score, feedback || '');
    
    res.json({ 
      data: survey, 
      message: 'Thank you for your feedback!' 
    });
  } catch (error) {
    logger.error('Error submitting survey:', error);
    res.status(500).json({ error: 'Failed to submit survey' });
  }
});

/**
 * GET /api/admin/surveys
 * Get all surveys (admin)
 */
router.get('/admin/all', authenticateToken, requirePermission('surveys.read'), async (req, res) => {
  try {
    const { type, status, limit = 100, offset = 0 } = req.query;
    
    let query = 'SELECT cs.*, u.email, u.first_name, u.last_name FROM csat_surveys cs JOIN users u ON cs.user_id = u.id WHERE cs.tenant_id = $1';
    const params = [req.user.tenantId];
    let paramIndex = 2;
    
    if (type) {
      query += ` AND cs.survey_type = $${paramIndex++}`;
      params.push(type);
    }
    
    if (status === 'responded') {
      query += ` AND cs.responded_at IS NOT NULL`;
    } else if (status === 'pending') {
      query += ` AND cs.responded_at IS NULL`;
    }
    
    query += ` ORDER BY cs.sent_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    res.json({ data: result.rows });
  } catch (error) {
    logger.error('Error getting surveys:', error);
    res.status(500).json({ error: 'Failed to get surveys' });
  }
});

/**
 * GET /api/admin/surveys/metrics
 * Get CSAT/NPS metrics
 */
router.get('/admin/metrics', authenticateToken, requirePermission('surveys.read'), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const metrics = await csat.getMetrics(req.user.tenantId, parseInt(days));
    
    res.json({ data: metrics });
  } catch (error) {
    logger.error('Error getting metrics:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

/**
 * GET /api/admin/surveys/followups
 * Get surveys requiring follow-up
 */
router.get('/admin/followups', authenticateToken, requirePermission('surveys.read'), async (req, res) => {
  try {
    const surveys = await csat.getFollowUpRequired(req.user.tenantId);
    res.json({ data: surveys });
  } catch (error) {
    logger.error('Error getting follow-ups:', error);
    res.status(500).json({ error: 'Failed to get follow-ups' });
  }
});

/**
 * POST /api/admin/surveys/:id/followup
 * Mark follow-up as completed
 */
router.post('/admin/:id/followup', authenticateToken, requirePermission('surveys.update'), async (req, res) => {
  try {
    const { notes } = req.body;
    const result = await csat.completeFollowUp(req.params.id, notes);
    
    if (result.success) {
      res.json({ message: 'Follow-up marked as completed' });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Error completing follow-up:', error);
    res.status(500).json({ error: 'Failed to complete follow-up' });
  }
});

/**
 * POST /api/admin/surveys/send-nps
 * Send NPS surveys to all active customers
 */
router.post('/admin/send-nps', authenticateToken, requirePermission('surveys.create'), async (req, res) => {
  try {
    const result = await csat.sendNPSSurveys(req.user.tenantId);
    
    if (result.success) {
      res.json({ message: `Sent ${result.sent} NPS surveys` });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Error sending NPS surveys:', error);
    res.status(500).json({ error: 'Failed to send NPS surveys' });
  }
});

export default router;
