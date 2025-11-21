import express from 'express';
const router = express.Router();
import whiteLabelService from '../services/whiteLabelService.js';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';

/**
 * White-Label & Reseller Platform Routes
 */

// ===========================
// BRANDING
// ===========================

// Create branding configuration
router.post('/branding', authenticateToken, requirePermission('branding.create'), async (req, res) => {
  try {
    const branding = await whiteLabelService.createBranding({
      ...req.body,
      tenantId: req.user.tenantId,
      userId: req.user.id
    });

    res.json(branding);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get branding configuration
router.get('/branding', authenticateToken, async (req, res) => {
  try {
    const result = await require('../config/database').query(
      'SELECT * FROM branding_configurations WHERE tenant_id = $1 AND is_active = true',
      [req.user.tenantId]
    );

    res.json(result.rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update branding configuration
router.patch('/branding/:id', authenticateToken, async (req, res) => {
  try {
    const branding = await whiteLabelService.updateBranding(
      parseInt(req.params.id),
      req.body
    );

    res.json(branding);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get branded portal URL
router.get('/branding/portal-url', authenticateToken, async (req, res) => {
  try {
    const url = await whiteLabelService.getBrandedPortalUrl(req.user.tenantId);
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===========================
// RESELLERS
// ===========================

// Create reseller account
router.post('/resellers', authenticateToken, async (req, res) => {
  try {
    const reseller = await whiteLabelService.createReseller({
      ...req.body,
      tenantId: req.user.tenantId,
      userId: req.user.id
    });

    res.json(reseller);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get reseller details
router.get('/resellers/:id', authenticateToken, async (req, res) => {
  try {
    const result = await require('../config/database').query(
      'SELECT * FROM resellers WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.user.tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reseller not found' });
    }

    const reseller = result.rows[0];
    reseller.custom_pricing = JSON.parse(reseller.custom_pricing || '{}');

    res.json(reseller);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List resellers
router.get('/resellers', authenticateToken, async (req, res) => {
  try {
    const { tier, isActive } = req.query;
    
    let query = 'SELECT * FROM resellers WHERE tenant_id = $1';
    const params = [req.user.tenantId];

    if (tier) {
      params.push(tier);
      query += ` AND tier = $${params.length}`;
    }

    if (isActive !== undefined) {
      params.push(isActive === 'true');
      query += ` AND is_active = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await require('../config/database').query(query, params);

    const resellers = result.rows.map(r => ({
      ...r,
      custom_pricing: JSON.parse(r.custom_pricing || '{}')
    }));

    res.json(resellers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get reseller hierarchy
router.get('/resellers/:id/hierarchy', authenticateToken, async (req, res) => {
  try {
    const hierarchy = await whiteLabelService.getResellerHierarchy(parseInt(req.params.id));
    res.json(hierarchy);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update reseller
router.patch('/resellers/:id', authenticateToken, async (req, res) => {
  try {
    const { commissionRate, maxClients, isActive } = req.body;
    
    const updates = {};
    if (commissionRate !== undefined) updates.commission_rate = commissionRate;
    if (maxClients !== undefined) updates.max_clients = maxClients;
    if (isActive !== undefined) updates.is_active = isActive;

    const setClause = Object.keys(updates)
      .map((key, idx) => `${key} = $${idx + 2}`)
      .join(', ');

    const result = await require('../config/database').query(
      `UPDATE resellers SET ${setClause}, updated_at = NOW() 
       WHERE id = $1 AND tenant_id = $${Object.keys(updates).length + 2}
       RETURNING *`,
      [req.params.id, ...Object.values(updates), req.user.tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reseller not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===========================
// COMMISSIONS
// ===========================

// Calculate commission for sale
router.post('/commissions/calculate', authenticateToken, async (req, res) => {
  try {
    const { resellerId, saleAmount } = req.body;
    
    const commission = await whiteLabelService.calculateCommission(
      resellerId,
      saleAmount
    );

    res.json(commission);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Record commission
router.post('/commissions', authenticateToken, async (req, res) => {
  try {
    const commission = await whiteLabelService.recordCommission(req.body);
    res.json(commission);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get reseller commissions
router.get('/resellers/:id/commissions', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    
    let query = `
      SELECT * FROM reseller_commissions
      WHERE reseller_id = $1
    `;
    const params = [req.params.id];

    if (startDate) {
      params.push(startDate);
      query += ` AND created_at >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      query += ` AND created_at <= $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await require('../config/database').query(query, params);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===========================
// PAYOUTS
// ===========================

// Process commission payout
router.post('/resellers/:id/payouts', authenticateToken, async (req, res) => {
  try {
    const { periodStart, periodEnd } = req.body;
    
    const payout = await whiteLabelService.processCommissionPayout(
      parseInt(req.params.id),
      new Date(periodStart),
      new Date(periodEnd)
    );

    res.json(payout);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get reseller payouts
router.get('/resellers/:id/payouts', authenticateToken, async (req, res) => {
  try {
    const result = await require('../config/database').query(
      'SELECT * FROM reseller_payouts WHERE reseller_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===========================
// CUSTOM PRICING
// ===========================

// Apply custom pricing
router.post('/resellers/:id/pricing', authenticateToken, async (req, res) => {
  try {
    const { productType, pricing } = req.body;
    
    const customPricing = await whiteLabelService.applyCustomPricing(
      parseInt(req.params.id),
      productType,
      pricing
    );

    res.json(customPricing);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get pricing for reseller
router.get('/resellers/:id/pricing/:productType', authenticateToken, async (req, res) => {
  try {
    const pricing = await whiteLabelService.getPricingForReseller(
      parseInt(req.params.id),
      req.params.productType
    );

    res.json(pricing);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===========================
// DASHBOARD
// ===========================

// Get reseller dashboard
router.get('/resellers/:id/dashboard', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dashboard = await whiteLabelService.getResellerDashboard(
      parseInt(req.params.id),
      startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate ? new Date(endDate) : new Date()
    );

    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;


