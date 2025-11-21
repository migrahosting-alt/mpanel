/**
 * Domain Pricing API Routes
 * Manage automatic domain pricing updates from NameSilo
 */

import express from 'express';
import domainPricingService from '../services/domainPricingService.js';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';
import logger from '../config/logger.js';

const router = express.Router();

/**
 * @route   GET /api/domain-pricing
 * @desc    Get all domain TLD pricing
 * @access  Public (for customer-facing pricing pages)
 */
router.get('/', async (req, res) => {
  try {
    const { includeInactive } = req.query;
    const pricing = await domainPricingService.getAllPricing(includeInactive === 'true');
    
    res.json({
      success: true,
      count: pricing.length,
      data: pricing,
    });
  } catch (error) {
    logger.error('Error fetching domain pricing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch domain pricing',
    });
  }
});

/**
 * @route   GET /api/domain-pricing/popular
 * @desc    Get popular TLD pricing (.com, .net, .org, etc.)
 * @access  Public
 */
router.get('/popular', async (req, res) => {
  try {
    const pricing = await domainPricingService.getPopularTldPricing();
    
    res.json({
      success: true,
      count: pricing.length,
      data: pricing,
    });
  } catch (error) {
    logger.error('Error fetching popular TLD pricing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch popular TLD pricing',
    });
  }
});

/**
 * @route   GET /api/domain-pricing/:tld
 * @desc    Get pricing for specific TLD
 * @access  Public
 */
router.get('/:tld', async (req, res) => {
  try {
    let { tld } = req.params;
    
    // Ensure TLD starts with dot
    if (!tld.startsWith('.')) {
      tld = `.${tld}`;
    }
    
    const pricing = await domainPricingService.getPricingForTld(tld);
    
    if (!pricing) {
      return res.status(404).json({
        success: false,
        error: `Pricing not found for TLD: ${tld}`,
      });
    }
    
    res.json({
      success: true,
      data: pricing,
    });
  } catch (error) {
    logger.error('Error fetching TLD pricing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch TLD pricing',
    });
  }
});

/**
 * @route   POST /api/domain-pricing/update
 * @desc    Trigger pricing update from NameSilo (admin only)
 * @access  Private (admin)
 */
router.post(
  '/update',
  authenticateToken,
  requirePermission('domains.manage'),
  async (req, res) => {
    try {
      const { force = false } = req.body;
      
      logger.info(`Domain pricing update triggered by user ${req.user.userId}`, { force });
      
      const result = await domainPricingService.updateAllPricing(force);
      
      res.json({
        success: true,
        message: 'Pricing update completed',
        data: result,
      });
    } catch (error) {
      logger.error('Error updating domain pricing:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update domain pricing',
      });
    }
  }
);

/**
 * @route   GET /api/domain-pricing/stats
 * @desc    Get pricing statistics (admin only)
 * @access  Private (admin)
 */
router.get(
  '/admin/stats',
  authenticateToken,
  requirePermission('domains.read'),
  async (req, res) => {
    try {
      const stats = await domainPricingService.getPricingStats();
      
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error fetching pricing stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch pricing statistics',
      });
    }
  }
);

/**
 * @route   POST /api/domain-pricing/audit
 * @desc    Audit pricing against NameSilo (compare costs)
 * @access  Private (admin)
 */
router.post(
  '/admin/audit',
  authenticateToken,
  requirePermission('domains.manage'),
  async (req, res) => {
    try {
      logger.info(`Pricing audit triggered by user ${req.user.userId}`);
      
      const audit = await domainPricingService.auditPricing();
      
      res.json({
        success: true,
        message: 'Pricing audit completed',
        data: audit,
      });
    } catch (error) {
      logger.error('Error auditing pricing:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to audit pricing',
      });
    }
  }
);

/**
 * @route   PATCH /api/domain-pricing/:tld
 * @desc    Manually adjust pricing for a TLD (admin only)
 * @access  Private (admin)
 */
router.patch(
  '/:tld',
  authenticateToken,
  requirePermission('domains.manage'),
  async (req, res) => {
    try {
      let { tld } = req.params;
      const { registrationPrice, renewalPrice, transferPrice, isActive } = req.body;
      
      if (!tld.startsWith('.')) {
        tld = `.${tld}`;
      }
      
      const result = await domainPricingService.adjustTldPricing(tld, {
        registrationPrice,
        renewalPrice,
        transferPrice,
        isActive,
      });
      
      logger.info(`Pricing adjusted for ${tld} by user ${req.user.userId}`, req.body);
      
      res.json({
        success: true,
        message: `Pricing updated for ${tld}`,
        data: result,
      });
    } catch (error) {
      logger.error('Error adjusting TLD pricing:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to adjust pricing',
      });
    }
  }
);

export default router;
