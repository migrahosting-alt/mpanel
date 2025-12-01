// src/routes/addonRoutes.js
// ============================================================================
// Add-ons API Routes
// Uses the single source of truth from src/config/addons.js
// ============================================================================

import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import pool from '../config/database.js';
import logger from '../config/logger.js';
import {
  ADDONS,
  ADDONS_BY_CODE,
  getAddon,
  getAddonsForTargetType,
  validateSelectedAddons,
  calculateAddonRecurringTotals,
  splitAddonsByBillingPeriod,
} from '../config/addons.js';

const router = express.Router();

// ============================================================================
// Public Routes (for checkout/cart)
// ============================================================================

/**
 * GET /api/addons/catalog
 * Get the full add-ons catalog
 * Used by checkout UI to display available add-ons
 */
router.get('/catalog', async (req, res) => {
  try {
    const { targetType } = req.query;
    
    let addons = ADDONS;
    
    // Filter by target type if provided
    if (targetType) {
      addons = getAddonsForTargetType(targetType.toUpperCase());
    }
    
    res.json({
      success: true,
      addons: addons.map(addon => ({
        code: addon.code,
        name: addon.name,
        description: addon.description,
        price: addon.price,
        billingPeriod: addon.billingPeriod,
        applicableTo: addon.applicableTo,
        stackable: addon.stackable,
        maxUnits: addon.maxUnits,
      })),
    });
  } catch (error) {
    logger.error('Error fetching addons catalog:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch addons catalog' });
  }
});

/**
 * GET /api/addons/:code
 * Get details for a specific add-on
 */
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const addon = ADDONS_BY_CODE[code.toUpperCase()];
    
    if (!addon) {
      return res.status(404).json({ success: false, error: 'Add-on not found' });
    }
    
    res.json({
      success: true,
      addon: {
        code: addon.code,
        name: addon.name,
        description: addon.description,
        price: addon.price,
        billingPeriod: addon.billingPeriod,
        applicableTo: addon.applicableTo,
        stackable: addon.stackable,
        maxUnits: addon.maxUnits,
      },
    });
  } catch (error) {
    logger.error('Error fetching addon:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch addon' });
  }
});

/**
 * POST /api/addons/validate
 * Validate a set of selected add-ons for a target type
 */
router.post('/validate', async (req, res) => {
  try {
    const { selected, targetType } = req.body;
    
    if (!selected || !Array.isArray(selected)) {
      return res.status(400).json({ success: false, error: 'selected must be an array' });
    }
    
    if (!targetType) {
      return res.status(400).json({ success: false, error: 'targetType is required' });
    }
    
    const errors = validateSelectedAddons(selected, targetType.toUpperCase());
    
    if (errors.length > 0) {
      return res.json({ success: false, valid: false, errors });
    }
    
    // Calculate totals
    const totals = calculateAddonRecurringTotals(selected);
    
    res.json({
      success: true,
      valid: true,
      totals,
    });
  } catch (error) {
    logger.error('Error validating addons:', error);
    res.status(500).json({ success: false, error: 'Failed to validate addons' });
  }
});

/**
 * POST /api/addons/calculate
 * Calculate recurring totals for a set of selected add-ons
 */
router.post('/calculate', async (req, res) => {
  try {
    const { selected } = req.body;
    
    if (!selected || !Array.isArray(selected)) {
      return res.status(400).json({ success: false, error: 'selected must be an array' });
    }
    
    const totals = calculateAddonRecurringTotals(selected);
    const split = splitAddonsByBillingPeriod(selected);
    
    res.json({
      success: true,
      totals,
      breakdown: {
        monthly: split.monthly.map(item => ({
          code: item.addon.code,
          name: item.addon.name,
          units: item.units,
          unitPrice: item.addon.price,
          total: item.addon.price * item.units,
        })),
        yearly: split.yearly.map(item => ({
          code: item.addon.code,
          name: item.addon.name,
          units: item.units,
          unitPrice: item.addon.price,
          total: item.addon.price * item.units,
        })),
      },
    });
  } catch (error) {
    logger.error('Error calculating addons:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate addons' });
  }
});

// ============================================================================
// Authenticated Routes (for managing subscription add-ons)
// ============================================================================

/**
 * GET /api/addons/subscription/:subscriptionId
 * Get all add-ons for a subscription
 */
router.get('/subscription/:subscriptionId', authenticateToken, async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    
    // Verify the user owns this subscription or is admin
    const subResult = await pool.query(
      `SELECT s.*, c.user_id 
       FROM subscriptions s 
       JOIN customers c ON s.customer_id = c.id 
       WHERE s.id = $1`,
      [subscriptionId]
    );
    
    if (subResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }
    
    const subscription = subResult.rows[0];
    
    // Check authorization
    if (subscription.user_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    // Get add-ons for this subscription
    const addonsResult = await pool.query(
      `SELECT * FROM subscription_addons WHERE subscription_id = $1 AND status = 'active'`,
      [subscriptionId]
    );
    
    // Enrich with catalog data
    const addons = addonsResult.rows.map(row => {
      const catalogAddon = ADDONS_BY_CODE[row.addon_code];
      return {
        id: row.id,
        code: row.addon_code,
        name: catalogAddon?.name || row.addon_code,
        description: catalogAddon?.description || '',
        units: row.units,
        unitPrice: parseFloat(row.unit_price_usd),
        billingPeriod: row.billing_period,
        nextBillingDate: row.next_billing_date,
        status: row.status,
      };
    });
    
    res.json({ success: true, addons });
  } catch (error) {
    logger.error('Error fetching subscription addons:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch subscription addons' });
  }
});

/**
 * POST /api/addons/subscription/:subscriptionId
 * Add an add-on to a subscription
 */
router.post('/subscription/:subscriptionId', authenticateToken, async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { addonCode, units = 1 } = req.body;
    
    if (!addonCode) {
      return res.status(400).json({ success: false, error: 'addonCode is required' });
    }
    
    // Get add-on from catalog
    const addon = ADDONS_BY_CODE[addonCode.toUpperCase()];
    if (!addon) {
      return res.status(404).json({ success: false, error: 'Add-on not found' });
    }
    
    // Verify the user owns this subscription or is admin
    const subResult = await pool.query(
      `SELECT s.*, c.user_id 
       FROM subscriptions s 
       JOIN customers c ON s.customer_id = c.id 
       WHERE s.id = $1`,
      [subscriptionId]
    );
    
    if (subResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }
    
    const subscription = subResult.rows[0];
    
    // Check authorization
    if (subscription.user_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    // Validate
    const errors = validateSelectedAddons([{ code: addonCode, units }], 'HOSTING');
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }
    
    // Check if add-on already exists for this subscription
    const existingResult = await pool.query(
      `SELECT * FROM subscription_addons WHERE subscription_id = $1 AND addon_code = $2 AND status = 'active'`,
      [subscriptionId, addon.code]
    );
    
    if (existingResult.rows.length > 0 && !addon.stackable) {
      return res.status(400).json({ success: false, error: 'This add-on is already active on this subscription' });
    }
    
    // Calculate next billing date
    const nextBillingDate = new Date();
    if (addon.billingPeriod === 'MONTHLY') {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    } else {
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
    }
    
    // Insert the add-on
    const insertResult = await pool.query(
      `INSERT INTO subscription_addons 
       (subscription_id, addon_code, units, unit_price_usd, billing_period, next_billing_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')
       RETURNING *`,
      [subscriptionId, addon.code, units, addon.price, addon.billingPeriod, nextBillingDate]
    );
    
    logger.info(`Add-on ${addon.code} added to subscription ${subscriptionId}`, { userId: req.user.id });
    
    res.status(201).json({
      success: true,
      addon: {
        id: insertResult.rows[0].id,
        code: addon.code,
        name: addon.name,
        units,
        unitPrice: addon.price,
        billingPeriod: addon.billingPeriod,
        nextBillingDate,
      },
    });
  } catch (error) {
    logger.error('Error adding subscription addon:', error);
    res.status(500).json({ success: false, error: 'Failed to add addon' });
  }
});

/**
 * DELETE /api/addons/subscription/:subscriptionId/:addonId
 * Remove an add-on from a subscription
 */
router.delete('/subscription/:subscriptionId/:addonId', authenticateToken, async (req, res) => {
  try {
    const { subscriptionId, addonId } = req.params;
    
    // Verify the user owns this subscription or is admin
    const subResult = await pool.query(
      `SELECT s.*, c.user_id 
       FROM subscriptions s 
       JOIN customers c ON s.customer_id = c.id 
       WHERE s.id = $1`,
      [subscriptionId]
    );
    
    if (subResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }
    
    const subscription = subResult.rows[0];
    
    // Check authorization
    if (subscription.user_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    // Cancel the add-on (soft delete)
    const updateResult = await pool.query(
      `UPDATE subscription_addons 
       SET status = 'cancelled', updated_at = NOW() 
       WHERE id = $1 AND subscription_id = $2
       RETURNING *`,
      [addonId, subscriptionId]
    );
    
    if (updateResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Add-on not found' });
    }
    
    logger.info(`Add-on ${addonId} cancelled from subscription ${subscriptionId}`, { userId: req.user.id });
    
    res.json({ success: true, message: 'Add-on cancelled successfully' });
  } catch (error) {
    logger.error('Error removing subscription addon:', error);
    res.status(500).json({ success: false, error: 'Failed to remove addon' });
  }
});

// ============================================================================
// Admin Routes
// ============================================================================

/**
 * GET /api/addons/admin/stats
 * Get add-on statistics (admin only)
 */
router.get('/admin/stats', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    // Get add-on usage stats
    const statsResult = await pool.query(`
      SELECT 
        addon_code,
        COUNT(*) as total_subscriptions,
        SUM(units) as total_units,
        SUM(unit_price_usd * units) as total_mrr,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count
      FROM subscription_addons
      GROUP BY addon_code
      ORDER BY total_mrr DESC
    `);
    
    // Enrich with catalog data
    const stats = statsResult.rows.map(row => {
      const catalogAddon = ADDONS_BY_CODE[row.addon_code];
      return {
        code: row.addon_code,
        name: catalogAddon?.name || row.addon_code,
        totalSubscriptions: parseInt(row.total_subscriptions),
        totalUnits: parseInt(row.total_units),
        activeCount: parseInt(row.active_count),
        totalMRR: parseFloat(row.total_mrr || 0),
        billingPeriod: catalogAddon?.billingPeriod || 'MONTHLY',
      };
    });
    
    // Calculate overall totals
    const totalMRR = stats
      .filter(s => s.billingPeriod === 'MONTHLY')
      .reduce((sum, s) => sum + s.totalMRR, 0);
    
    const totalARR = stats
      .filter(s => s.billingPeriod === 'YEARLY')
      .reduce((sum, s) => sum + s.totalMRR, 0);
    
    res.json({
      success: true,
      stats,
      totals: {
        totalMRR,
        totalARR,
        totalActiveAddons: stats.reduce((sum, s) => sum + s.activeCount, 0),
      },
    });
  } catch (error) {
    logger.error('Error fetching addon stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch addon stats' });
  }
});

export default router;
