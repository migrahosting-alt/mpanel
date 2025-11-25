/**
 * Email Marketing API Routes
 */

import express from 'express';
import emailMarketing from '../services/emailMarketing.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * Create email campaign
 */
router.post('/campaigns', async (req, res) => {
  try {
    const campaign = await emailMarketing.createCampaign(
      req.user.tenant_id,
      req.user.id,
      req.body
    );

    res.status(201).json({
      success: true,
      campaign
    });
  } catch (error) {
    logger.error('Failed to create campaign', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * List campaigns
 */
router.get('/campaigns', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM email_campaigns WHERE tenant_id = $1 ORDER BY created_at DESC',
      [req.user.tenant_id]
    );

    res.json({
      success: true,
      campaigns: result.rows
    });
  } catch (error) {
    logger.error('Failed to list campaigns', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get campaign details
 */
router.get('/campaigns/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM email_campaigns WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.user.tenant_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    res.json({
      success: true,
      campaign: result.rows[0]
    });
  } catch (error) {
    logger.error('Failed to get campaign', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Send campaign
 */
router.post('/campaigns/:id/send', async (req, res) => {
  try {
    const result = await emailMarketing.sendCampaign(req.params.id);

    res.json(result);
  } catch (error) {
    logger.error('Failed to send campaign', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * Get campaign analytics
 */
router.get('/campaigns/:id/analytics', async (req, res) => {
  try {
    const analytics = await emailMarketing.getCampaignAnalytics(req.params.id);

    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    logger.error('Failed to get campaign analytics', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create drip campaign
 */
router.post('/drip-campaigns', async (req, res) => {
  try {
    const campaign = await emailMarketing.createDripCampaign(
      req.user.tenant_id,
      req.user.id,
      req.body
    );

    res.status(201).json({
      success: true,
      campaign
    });
  } catch (error) {
    logger.error('Failed to create drip campaign', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * Create A/B test
 */
router.post('/ab-tests', async (req, res) => {
  try {
    const test = await emailMarketing.createABTest(
      req.user.tenant_id,
      req.user.id,
      req.body
    );

    res.status(201).json({
      success: true,
      test
    });
  } catch (error) {
    logger.error('Failed to create A/B test', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * Create email template
 */
router.post('/templates', async (req, res) => {
  try {
    const template = await emailMarketing.createTemplate(
      req.user.tenant_id,
      req.user.id,
      req.body
    );

    res.status(201).json({
      success: true,
      template
    });
  } catch (error) {
    logger.error('Failed to create template', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * List templates
 */
router.get('/templates', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM email_templates WHERE tenant_id = $1 ORDER BY created_at DESC',
      [req.user.tenant_id]
    );

    res.json({
      success: true,
      templates: result.rows
    });
  } catch (error) {
    logger.error('Failed to list templates', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Track email open (public endpoint, no auth)
 */
router.get('/track/open/:trackingId', async (req, res) => {
  try {
    await emailMarketing.trackOpen(req.params.trackingId);

    // Return 1x1 transparent GIF
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    );
    
    res.writeHead(200, {
      'Content-Type': 'image/gif',
      'Content-Length': pixel.length
    });
    res.end(pixel);
  } catch (error) {
    logger.error('Failed to track open', { error: error.message });
    res.status(200).end();
  }
});

/**
 * Track email click (redirect endpoint, no auth)
 */
router.get('/track/click/:trackingId', async (req, res) => {
  try {
    const url = req.query.url;
    
    await emailMarketing.trackClick(req.params.trackingId, url);

    res.redirect(url);
  } catch (error) {
    logger.error('Failed to track click', { error: error.message });
    res.redirect(req.query.url || '/');
  }
});

export default router;

