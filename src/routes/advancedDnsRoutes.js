const express = require('express');
const router = express.Router();
const advancedDnsService = require('../services/advancedDnsService');
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * Advanced DNS Management Routes
 * All routes require authentication
 */

// Enable DNSSEC
router.post('/dns/:zoneId/dnssec', authenticate, async (req, res) => {
  try {
    const result = await advancedDnsService.enableDNSSEC(req.params.zoneId, req.body);
    res.status(201).json(result);
  } catch (error) {
    logger.error('Enable DNSSEC failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create GeoDNS policy
router.post('/dns/geodns/policies', authenticate, async (req, res) => {
  try {
    const policy = await advancedDnsService.createGeoDNSPolicy(req.body);
    res.status(201).json(policy);
  } catch (error) {
    logger.error('Create GeoDNS policy failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Resolve GeoDNS query
router.post('/dns/geodns/resolve/:policyId', authenticate, async (req, res) => {
  try {
    const result = await advancedDnsService.resolveGeoDNS(req.params.policyId, req.body.clientLocation);
    res.json(result);
  } catch (error) {
    logger.error('Resolve GeoDNS failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create health check
router.post('/dns/health-checks', authenticate, async (req, res) => {
  try {
    const healthCheck = await advancedDnsService.createHealthCheck(req.body);
    res.status(201).json(healthCheck);
  } catch (error) {
    logger.error('Create health check failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stop health check
router.delete('/dns/health-checks/:id', authenticate, async (req, res) => {
  try {
    advancedDnsService.stopHealthCheckMonitoring(req.params.id);
    res.json({ success: true });
  } catch (error) {
    logger.error('Stop health check failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get DNS analytics
router.get('/dns/:zoneId/analytics', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const analytics = await advancedDnsService.getDNSAnalytics(
      req.params.zoneId,
      startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate || new Date()
    );
    res.json(analytics);
  } catch (error) {
    logger.error('Get DNS analytics failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Log DNS query (for analytics)
router.post('/dns/query-log', authenticate, async (req, res) => {
  try {
    await advancedDnsService.logDNSQuery(req.body);
    res.json({ success: true });
  } catch (error) {
    logger.error('Log DNS query failed:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
