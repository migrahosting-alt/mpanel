/**
 * AI Routes - AI-powered features API
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import aiService from '../services/aiService.js';
import logger from '../config/logger.js';

const router = express.Router();

/**
 * Generate code
 */
router.post('/generate-code', authenticateToken, async (req, res) => {
  try {
    const { prompt, language, context } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const result = await aiService.generateCode(prompt, language, context);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('AI code generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Debug error
 */
router.post('/debug', authenticateToken, async (req, res) => {
  try {
    const { error_message, stack_trace, code_context } = req.body;

    if (!error_message) {
      return res.status(400).json({ error: 'Error message is required' });
    }

    const result = await aiService.debugError(error_message, stack_trace, code_context);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('AI debugging error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Optimize code
 */
router.post('/optimize-code', authenticateToken, async (req, res) => {
  try {
    const { code, language, metrics } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const result = await aiService.optimizeCode(code, language, metrics);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('AI optimization error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Triage support ticket
 */
router.post('/triage-ticket', authenticateToken, async (req, res) => {
  try {
    const { ticket_content, customer_history } = req.body;

    if (!ticket_content) {
      return res.status(400).json({ error: 'Ticket content is required' });
    }

    const result = await aiService.triageTicket(ticket_content, customer_history);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('AI ticket triage error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Analyze customer intent
 */
router.post('/analyze-intent/:customerId', authenticateToken, async (req, res) => {
  try {
    const { customerId } = req.params;
    const { recent_activity } = req.body;

    // Admin only or own data
    if (req.user.role !== 'admin' && req.user.id !== parseInt(customerId)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const result = await aiService.analyzeCustomerIntent(parseInt(customerId), recent_activity);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('AI intent analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Revenue forecast
 */
router.get('/forecast/revenue', authenticateToken, async (req, res) => {
  try {
    // Admin only
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { months = 6 } = req.query;
    const tenantId = req.user.tenant_id;

    const result = await aiService.forecastRevenue(tenantId, parseInt(months));

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('AI revenue forecast error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Churn prediction
 */
router.get('/predict/churn/:customerId', authenticateToken, async (req, res) => {
  try {
    // Admin only
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { customerId } = req.params;

    const result = await aiService.predictChurn(parseInt(customerId));

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('AI churn prediction error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate website content
 */
router.post('/generate-content', authenticateToken, async (req, res) => {
  try {
    const { site_type, business, tone } = req.body;

    if (!site_type || !business) {
      return res.status(400).json({ error: 'Site type and business info required' });
    }

    const result = await aiService.generateWebsiteContent(site_type, business, tone);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('AI content generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
