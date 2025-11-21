/**
 * Referral Routes
 * Customer referral program management
 */

import express from 'express';
import pool from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';
import * as referralService from '../services/referralService.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/referrals
 * Get current user's referrals
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const data = await referral.getUserReferrals(req.user.id);
    res.json({ data });
  } catch (error) {
    logger.error('Error getting referrals:', error);
    res.status(500).json({ error: 'Failed to get referrals' });
  }
});

/**
 * POST /api/referrals/create
 * Create referral code for current user
 */
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const ref = await referral.createReferral(req.user.id, req.user.tenantId);
    res.json({ 
      data: ref,
      referralUrl: `${process.env.APP_URL}/signup?ref=${ref.referral_code}`
    });
  } catch (error) {
    logger.error('Error creating referral:', error);
    res.status(500).json({ error: 'Failed to create referral code' });
  }
});

/**
 * POST /api/referrals/track/:code
 * Track referral click (public endpoint)
 */
router.post('/track/:code', async (req, res) => {
  try {
    await referral.trackClick(req.params.code, req.ip);
    res.json({ message: 'Click tracked' });
  } catch (error) {
    logger.error('Error tracking click:', error);
    res.status(500).json({ error: 'Failed to track click' });
  }
});

/**
 * GET /api/referrals/validate/:code
 * Validate referral code (public endpoint)
 */
router.get('/validate/:code', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT referral_code, referrer_id FROM referrals WHERE referral_code = $1',
      [req.params.code]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ valid: false, error: 'Invalid referral code' });
    }
    
    res.json({ valid: true, code: result.rows[0].referral_code });
  } catch (error) {
    logger.error('Error validating referral code:', error);
    res.status(500).json({ error: 'Failed to validate code' });
  }
});

/**
 * GET /api/admin/referrals/stats
 * Get referral statistics (admin)
 */
router.get('/admin/stats', authenticateToken, requirePermission('referrals.read'), async (req, res) => {
  try {
    const stats = await referral.getReferralStats(req.user.tenantId);
    res.json({ data: stats });
  } catch (error) {
    logger.error('Error getting referral stats:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

/**
 * GET /api/admin/referrals
 * Get all referrals (admin)
 */
router.get('/admin/all', authenticateToken, requirePermission('referrals.read'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, 
        u1.email as referrer_email, u1.first_name as referrer_first_name,
        u2.email as referred_email, u2.first_name as referred_first_name
       FROM referrals r
       JOIN users u1 ON r.referrer_id = u1.id
       LEFT JOIN users u2 ON r.referred_id = u2.id
       WHERE r.tenant_id = $1
       ORDER BY r.created_at DESC`,
      [req.user.tenantId]
    );
    
    res.json({ data: result.rows });
  } catch (error) {
    logger.error('Error getting all referrals:', error);
    res.status(500).json({ error: 'Failed to get referrals' });
  }
});

/**
 * POST /api/admin/referrals/:id/pay
 * Mark commission as paid
 */
router.post('/admin/:id/pay', authenticateToken, requirePermission('referrals.update'), async (req, res) => {
  try {
    const result = await referral.markCommissionPaid(req.params.id);
    
    if (result.success) {
      res.json({ message: 'Commission marked as paid' });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Error marking commission paid:', error);
    res.status(500).json({ error: 'Failed to mark commission paid' });
  }
});

export default router;
