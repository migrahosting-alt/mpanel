import express from 'express';
const router = express.Router();
import cdnService from '../services/cdnService.js';
import { authenticate } from '../middleware/auth.js';
/**
 * CDN Management Routes
 * All routes require authentication
 */

// Create CDN configuration
router.post('/cdn', authenticate, async (req, res) => {
  try {
    const cdn = await cdnService.createCDN({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      ...req.body
    });

    res.status(201).json(cdn);
  } catch (error) {
    logger.error('Create CDN failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get CDN status
router.get('/cdn/:id', authenticate, async (req, res) => {
  try {
    const status = await cdnService.getCDNStatus(req.params.id);
    res.json(status);
  } catch (error) {
    logger.error('Get CDN status failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Purge CDN cache
router.post('/cdn/:id/purge', authenticate, async (req, res) => {
  try {
    const result = await cdnService.purgeCache(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    logger.error('Purge cache failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update caching rules
router.patch('/cdn/:id/caching-rules', authenticate, async (req, res) => {
  try {
    const result = await cdnService.updateCachingRules(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    logger.error('Update caching rules failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Configure geo-routing
router.patch('/cdn/:id/geo-routing', authenticate, async (req, res) => {
  try {
    const result = await cdnService.configureGeoRouting(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    logger.error('Configure geo-routing failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get CDN analytics
router.get('/cdn/:id/analytics', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const analytics = await cdnService.getCDNAnalytics(
      req.params.id,
      startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate || new Date()
    );
    res.json(analytics);
  } catch (error) {
    logger.error('Get CDN analytics failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete CDN
router.delete('/cdn/:id', authenticate, async (req, res) => {
  try {
    const result = await cdnService.deleteCDN(req.params.id);
    res.json(result);
  } catch (error) {
    logger.error('Delete CDN failed:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;


