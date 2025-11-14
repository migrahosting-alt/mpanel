const pool = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * White-Label & Reseller Platform Service
 * 
 * Features:
 * - Complete branding customization (logo, colors, domain)
 * - Multi-tier reseller hierarchy (parent-child relationships)
 * - Automated commission tracking & payouts
 * - Custom pricing per reseller tier
 * - Branded client portal & emails
 * - Reseller dashboard with analytics
 */

class WhiteLabelService {
  constructor() {
    this.defaultCommissionRates = {
      tier1: 20, // Top-level resellers: 20%
      tier2: 15, // Sub-resellers: 15%
      tier3: 10  // Third-level: 10%
    };
  }

  /**
   * Create branding configuration
   * 
   * @param {Object} brandingData
   * @returns {Promise<Object>}
   */
  async createBranding(brandingData) {
    const {
      tenantId,
      userId,
      companyName,
      logoUrl,
      faviconUrl,
      primaryColor = '#3B82F6',
      secondaryColor = '#10B981',
      accentColor = '#F59E0B',
      customDomain = null,
      customCss = null,
      emailFromName = null,
      emailFromAddress = null,
      supportEmail = null,
      supportPhone = null,
      termsUrl = null,
      privacyUrl = null
    } = brandingData;

    try {
      const result = await pool.query(
        `INSERT INTO branding_configurations 
        (tenant_id, user_id, company_name, logo_url, favicon_url, 
         primary_color, secondary_color, accent_color, custom_domain, 
         custom_css, email_from_name, email_from_address, support_email, 
         support_phone, terms_url, privacy_url, is_active, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, true, NOW())
        RETURNING *`,
        [tenantId, userId, companyName, logoUrl, faviconUrl, primaryColor, 
         secondaryColor, accentColor, customDomain, customCss, emailFromName, 
         emailFromAddress, supportEmail, supportPhone, termsUrl, privacyUrl]
      );

      const branding = result.rows[0];

      logger.info('Branding configuration created', { 
        tenantId, 
        brandingId: branding.id 
      });

      return branding;
    } catch (error) {
      logger.error('Failed to create branding:', error);
      throw error;
    }
  }

  /**
   * Update branding configuration
   */
  async updateBranding(brandingId, updates) {
    try {
      const allowedFields = [
        'company_name', 'logo_url', 'favicon_url', 'primary_color',
        'secondary_color', 'accent_color', 'custom_domain', 'custom_css',
        'email_from_name', 'email_from_address', 'support_email',
        'support_phone', 'terms_url', 'privacy_url'
      ];

      const updateFields = Object.keys(updates)
        .filter(key => allowedFields.includes(key))
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');

      const values = Object.keys(updates)
        .filter(key => allowedFields.includes(key))
        .map(key => updates[key]);

      const result = await pool.query(
        `UPDATE branding_configurations 
         SET ${updateFields}, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [brandingId, ...values]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to update branding:', error);
      throw error;
    }
  }

  /**
   * Create reseller account
   * 
   * @param {Object} resellerData
   * @returns {Promise<Object>}
   */
  async createReseller(resellerData) {
    const {
      tenantId,
      userId,
      parentResellerId = null,
      tier = 1,
      commissionRate = null,
      customPricing = {},
      maxClients = null,
      isActive = true
    } = resellerData;

    try {
      // Validate tier (max 3 levels)
      if (tier > 3) {
        throw new Error('Maximum reseller tier is 3');
      }

      // Calculate commission rate based on tier if not provided
      const finalCommissionRate = commissionRate || 
        this.defaultCommissionRates[`tier${tier}`];

      // If has parent, verify parent exists and tier is valid
      if (parentResellerId) {
        const parentResult = await pool.query(
          'SELECT tier FROM resellers WHERE id = $1',
          [parentResellerId]
        );

        if (parentResult.rows.length === 0) {
          throw new Error('Parent reseller not found');
        }

        const parentTier = parentResult.rows[0].tier;
        if (tier <= parentTier) {
          throw new Error('Child reseller tier must be higher than parent');
        }
      }

      const result = await pool.query(
        `INSERT INTO resellers 
        (tenant_id, user_id, parent_reseller_id, tier, commission_rate, 
         custom_pricing, max_clients, is_active, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING *`,
        [tenantId, userId, parentResellerId, tier, finalCommissionRate, 
         JSON.stringify(customPricing), maxClients, isActive]
      );

      const reseller = result.rows[0];
      reseller.custom_pricing = JSON.parse(reseller.custom_pricing);

      logger.info('Reseller created', { 
        resellerId: reseller.id, 
        tier, 
        commissionRate: finalCommissionRate 
      });

      return reseller;
    } catch (error) {
      logger.error('Failed to create reseller:', error);
      throw error;
    }
  }

  /**
   * Get reseller hierarchy
   * 
   * @param {number} resellerId
   * @returns {Promise<Object>}
   */
  async getResellerHierarchy(resellerId) {
    try {
      // Get reseller with all descendants using recursive CTE
      const result = await pool.query(
        `WITH RECURSIVE reseller_tree AS (
          -- Base case: start with the given reseller
          SELECT 
            id, tenant_id, user_id, parent_reseller_id, tier, 
            commission_rate, max_clients, is_active, 0 as depth
          FROM resellers
          WHERE id = $1
          
          UNION ALL
          
          -- Recursive case: find children
          SELECT 
            r.id, r.tenant_id, r.user_id, r.parent_reseller_id, r.tier,
            r.commission_rate, r.max_clients, r.is_active, rt.depth + 1
          FROM resellers r
          INNER JOIN reseller_tree rt ON r.parent_reseller_id = rt.id
        )
        SELECT * FROM reseller_tree ORDER BY depth, id`,
        [resellerId]
      );

      // Build tree structure
      const tree = this.buildResellerTree(result.rows);

      return tree;
    } catch (error) {
      logger.error('Failed to get reseller hierarchy:', error);
      throw error;
    }
  }

  /**
   * Build reseller tree structure from flat array
   */
  buildResellerTree(rows) {
    const map = {};
    const roots = [];

    // Create map of all nodes
    rows.forEach(row => {
      map[row.id] = { ...row, children: [] };
    });

    // Build tree
    rows.forEach(row => {
      if (row.parent_reseller_id === null) {
        roots.push(map[row.id]);
      } else if (map[row.parent_reseller_id]) {
        map[row.parent_reseller_id].children.push(map[row.id]);
      }
    });

    return roots[0] || null;
  }

  /**
   * Calculate commission for sale
   * 
   * @param {number} resellerId
   * @param {number} saleAmount
   * @returns {Promise<Object>}
   */
  async calculateCommission(resellerId, saleAmount) {
    try {
      const resellerResult = await pool.query(
        'SELECT * FROM resellers WHERE id = $1',
        [resellerId]
      );

      if (resellerResult.rows.length === 0) {
        throw new Error('Reseller not found');
      }

      const reseller = resellerResult.rows[0];
      const commissions = [];

      // Calculate commission for this reseller
      const commission = (saleAmount * reseller.commission_rate) / 100;
      commissions.push({
        resellerId: reseller.id,
        tier: reseller.tier,
        rate: reseller.commission_rate,
        amount: commission
      });

      // Calculate commission for parent resellers (split)
      let currentResellerId = reseller.parent_reseller_id;
      let remainingAmount = saleAmount;

      while (currentResellerId) {
        const parentResult = await pool.query(
          'SELECT * FROM resellers WHERE id = $1',
          [currentResellerId]
        );

        if (parentResult.rows.length === 0) break;

        const parent = parentResult.rows[0];
        
        // Parent gets commission on the amount after child's commission
        remainingAmount -= commission;
        const parentCommission = (remainingAmount * parent.commission_rate) / 100;

        commissions.push({
          resellerId: parent.id,
          tier: parent.tier,
          rate: parent.commission_rate,
          amount: parentCommission
        });

        currentResellerId = parent.parent_reseller_id;
      }

      return {
        saleAmount,
        totalCommission: commissions.reduce((sum, c) => sum + c.amount, 0),
        commissions
      };
    } catch (error) {
      logger.error('Failed to calculate commission:', error);
      throw error;
    }
  }

  /**
   * Record commission for sale
   */
  async recordCommission(saleData) {
    const {
      resellerId,
      orderId,
      saleAmount,
      productType,
      productId
    } = saleData;

    try {
      // Calculate commissions for entire hierarchy
      const commissionData = await this.calculateCommission(resellerId, saleAmount);

      // Record each commission
      for (const comm of commissionData.commissions) {
        await pool.query(
          `INSERT INTO reseller_commissions 
          (reseller_id, order_id, sale_amount, commission_rate, 
           commission_amount, product_type, product_id, status, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())`,
          [comm.resellerId, orderId, saleAmount, comm.rate, 
           comm.amount, productType, productId]
        );
      }

      logger.info('Commission recorded', { 
        orderId, 
        totalCommission: commissionData.totalCommission 
      });

      return commissionData;
    } catch (error) {
      logger.error('Failed to record commission:', error);
      throw error;
    }
  }

  /**
   * Process commission payout
   * 
   * @param {number} resellerId
   * @param {Date} periodStart
   * @param {Date} periodEnd
   * @returns {Promise<Object>}
   */
  async processCommissionPayout(resellerId, periodStart, periodEnd) {
    try {
      // Get pending commissions
      const commissionsResult = await pool.query(
        `SELECT * FROM reseller_commissions
         WHERE reseller_id = $1
           AND status = 'pending'
           AND created_at >= $2
           AND created_at <= $3`,
        [resellerId, periodStart, periodEnd]
      );

      const commissions = commissionsResult.rows;
      const totalAmount = commissions.reduce((sum, c) => sum + parseFloat(c.commission_amount), 0);

      if (totalAmount === 0) {
        return { message: 'No pending commissions for this period' };
      }

      // Create payout record
      const payoutResult = await pool.query(
        `INSERT INTO reseller_payouts 
        (reseller_id, period_start, period_end, total_amount, 
         commission_count, status, created_at)
        VALUES ($1, $2, $3, $4, $5, 'processing', NOW())
        RETURNING *`,
        [resellerId, periodStart, periodEnd, totalAmount, commissions.length]
      );

      const payout = payoutResult.rows[0];

      // Mark commissions as paid
      await pool.query(
        `UPDATE reseller_commissions
         SET status = 'paid', payout_id = $1, paid_at = NOW()
         WHERE reseller_id = $2
           AND status = 'pending'
           AND created_at >= $3
           AND created_at <= $4`,
        [payout.id, resellerId, periodStart, periodEnd]
      );

      // In production, integrate with payment provider (Stripe, PayPal, etc.)
      // For now, mark as completed
      await pool.query(
        'UPDATE reseller_payouts SET status = $1, completed_at = NOW() WHERE id = $2',
        ['completed', payout.id]
      );

      logger.info('Commission payout processed', { 
        resellerId, 
        payoutId: payout.id, 
        amount: totalAmount 
      });

      return {
        payout,
        totalAmount,
        commissionCount: commissions.length
      };
    } catch (error) {
      logger.error('Failed to process commission payout:', error);
      throw error;
    }
  }

  /**
   * Get reseller dashboard statistics
   */
  async getResellerDashboard(resellerId, startDate, endDate) {
    try {
      // Total commissions earned
      const commissionsResult = await pool.query(
        `SELECT 
          COUNT(*) as total_count,
          SUM(commission_amount) as total_earned,
          SUM(CASE WHEN status = 'paid' THEN commission_amount ELSE 0 END) as paid_amount,
          SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END) as pending_amount
         FROM reseller_commissions
         WHERE reseller_id = $1
           AND created_at >= $2
           AND created_at <= $3`,
        [resellerId, startDate, endDate]
      );

      // Client count
      const clientsResult = await pool.query(
        `SELECT COUNT(*) as client_count
         FROM tenants
         WHERE reseller_id = $1
           AND created_at >= $2
           AND created_at <= $3`,
        [resellerId, startDate, endDate]
      );

      // Top products by commission
      const topProductsResult = await pool.query(
        `SELECT 
          product_type,
          COUNT(*) as sale_count,
          SUM(commission_amount) as total_commission
         FROM reseller_commissions
         WHERE reseller_id = $1
           AND created_at >= $2
           AND created_at <= $3
         GROUP BY product_type
         ORDER BY total_commission DESC
         LIMIT 10`,
        [resellerId, startDate, endDate]
      );

      // Monthly trend
      const trendResult = await pool.query(
        `SELECT 
          DATE_TRUNC('month', created_at) as month,
          COUNT(*) as sale_count,
          SUM(commission_amount) as commission_amount
         FROM reseller_commissions
         WHERE reseller_id = $1
           AND created_at >= $2
           AND created_at <= $3
         GROUP BY month
         ORDER BY month`,
        [resellerId, startDate, endDate]
      );

      // Reseller hierarchy stats
      const hierarchy = await this.getResellerHierarchy(resellerId);
      const subResellerCount = this.countSubResellers(hierarchy);

      return {
        commissions: commissionsResult.rows[0],
        clients: parseInt(clientsResult.rows[0].client_count),
        topProducts: topProductsResult.rows,
        monthlyTrend: trendResult.rows,
        subResellers: subResellerCount,
        hierarchy
      };
    } catch (error) {
      logger.error('Failed to get reseller dashboard:', error);
      throw error;
    }
  }

  /**
   * Count sub-resellers recursively
   */
  countSubResellers(hierarchy) {
    if (!hierarchy || !hierarchy.children) return 0;
    
    let count = hierarchy.children.length;
    hierarchy.children.forEach(child => {
      count += this.countSubResellers(child);
    });
    
    return count;
  }

  /**
   * Apply custom pricing for reseller
   */
  async applyCustomPricing(resellerId, productType, pricing) {
    try {
      const resellerResult = await pool.query(
        'SELECT custom_pricing FROM resellers WHERE id = $1',
        [resellerId]
      );

      if (resellerResult.rows.length === 0) {
        throw new Error('Reseller not found');
      }

      const customPricing = JSON.parse(resellerResult.rows[0].custom_pricing || '{}');
      customPricing[productType] = pricing;

      await pool.query(
        'UPDATE resellers SET custom_pricing = $1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(customPricing), resellerId]
      );

      logger.info('Custom pricing applied', { resellerId, productType });

      return customPricing;
    } catch (error) {
      logger.error('Failed to apply custom pricing:', error);
      throw error;
    }
  }

  /**
   * Get pricing for reseller (custom or default)
   */
  async getPricingForReseller(resellerId, productType) {
    try {
      const resellerResult = await pool.query(
        'SELECT custom_pricing FROM resellers WHERE id = $1',
        [resellerId]
      );

      if (resellerResult.rows.length === 0) {
        throw new Error('Reseller not found');
      }

      const customPricing = JSON.parse(resellerResult.rows[0].custom_pricing || '{}');

      // Return custom pricing if exists, otherwise default
      if (customPricing[productType]) {
        return {
          type: 'custom',
          pricing: customPricing[productType]
        };
      }

      // Get default pricing from products table
      const defaultResult = await pool.query(
        'SELECT price FROM products WHERE type = $1 LIMIT 1',
        [productType]
      );

      return {
        type: 'default',
        pricing: defaultResult.rows[0] || null
      };
    } catch (error) {
      logger.error('Failed to get pricing for reseller:', error);
      throw error;
    }
  }

  /**
   * Generate branded portal URL
   */
  async getBrandedPortalUrl(tenantId) {
    try {
      const brandingResult = await pool.query(
        'SELECT custom_domain FROM branding_configurations WHERE tenant_id = $1 AND is_active = true',
        [tenantId]
      );

      if (brandingResult.rows.length > 0 && brandingResult.rows[0].custom_domain) {
        return `https://${brandingResult.rows[0].custom_domain}`;
      }

      // Fallback to default subdomain
      return `https://${tenantId}.mpanel.app`;
    } catch (error) {
      logger.error('Failed to get branded portal URL:', error);
      throw error;
    }
  }
}

module.exports = new WhiteLabelService();
