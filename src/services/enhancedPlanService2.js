/**
 * Enhanced Plan Access Service - Part 2
 * Continues: Promos, Loyalty, AI Recommendations, Success Metrics
 */

import pool from '../db/index.js';
import logger from '../config/logger.js';
import * as aiService from './aiService.js';

// ============================================
// 7. PROMOTIONAL PRICING & DISCOUNT CODES
// ============================================

/**
 * Validate and apply promo code
 */
export async function applyPromoCode(promoCode, customerId, tenantId, planId, isNewCustomer = false) {
  try {
    // Get promo code details
    const result = await pool.query(`
      SELECT * FROM promotional_pricing
      WHERE promo_code = $1 
        AND is_active = true
        AND valid_from <= CURRENT_TIMESTAMP
        AND valid_until >= CURRENT_TIMESTAMP
        AND (max_uses IS NULL OR current_uses < max_uses)
    `, [promoCode]);

    if (result.rows.length === 0) {
      throw new Error('Invalid or expired promo code');
    }

    const promo = result.rows[0];

    // Check applicability
    if (promo.applies_to === 'new_customers' && !isNewCustomer) {
      throw new Error('This promo code is only for new customers');
    }

    if (promo.applicable_plan_ids && promo.applicable_plan_ids.length > 0) {
      if (!promo.applicable_plan_ids.includes(planId)) {
        throw new Error('This promo code does not apply to the selected plan');
      }
    }

    // Get plan price
    const planResult = await pool.query(`
      SELECT price_monthly FROM service_plans WHERE id = $1
    `, [planId]);

    const planPrice = parseFloat(planResult.rows[0].price_monthly);

    // Check minimum purchase amount
    if (promo.min_purchase_amount && planPrice < promo.min_purchase_amount) {
      throw new Error(`Minimum purchase amount of $${promo.min_purchase_amount} required`);
    }

    // Calculate discount
    let discountAmount = 0;
    let finalAmount = planPrice;

    if (promo.discount_type === 'percentage') {
      discountAmount = planPrice * (promo.discount_value / 100);
      finalAmount = planPrice - discountAmount;
    } else if (promo.discount_type === 'fixed') {
      discountAmount = promo.discount_value;
      finalAmount = Math.max(0, planPrice - discountAmount);
    } else if (promo.discount_type === 'free_months') {
      discountAmount = planPrice * promo.discount_value;
      finalAmount = 0; // First payment is free
    }

    logger.info('Promo code validated', {
      promoCode,
      discountAmount,
      finalAmount
    });

    return {
      valid: true,
      promoId: promo.id,
      promoName: promo.promo_name,
      discountType: promo.discount_type,
      discountValue: promo.discount_value,
      discountAmount,
      originalAmount: planPrice,
      finalAmount
    };
  } catch (error) {
    logger.error('Error applying promo code:', error);
    throw error;
  }
}

/**
 * Record promo code redemption
 */
export async function recordPromoRedemption(promoId, customerId, tenantId, subscriptionId, amounts) {
  try {
    await pool.query(`
      INSERT INTO promo_code_redemptions
      (tenant_id, promo_id, customer_id, subscription_id, 
       discount_amount, original_amount, final_amount)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      tenantId,
      promoId,
      customerId,
      subscriptionId,
      amounts.discountAmount,
      amounts.originalAmount,
      amounts.finalAmount
    ]);

    // Update promo usage count
    await pool.query(`
      UPDATE promotional_pricing
      SET current_uses = current_uses + 1
      WHERE id = $1
    `, [promoId]);

    logger.info('Promo code redeemed', { promoId, customerId, discount: amounts.discountAmount });

    return true;
  } catch (error) {
    logger.error('Error recording promo redemption:', error);
    throw error;
  }
}

/**
 * Get active seasonal promos
 */
export async function getActivePromos(tenantId, customerType = 'all') {
  const result = await pool.query(`
    SELECT * FROM promotional_pricing
    WHERE tenant_id = $1 OR tenant_id IS NULL
      AND is_active = true
      AND valid_from <= CURRENT_TIMESTAMP
      AND valid_until >= CURRENT_TIMESTAMP
      AND (applies_to = $2 OR applies_to = 'all')
      AND (max_uses IS NULL OR current_uses < max_uses)
    ORDER BY discount_value DESC
  `, [tenantId, customerType]);

  return result.rows;
}

// ============================================
// 8. LOYALTY & VOLUME DISCOUNTS
// ============================================

/**
 * Calculate loyalty discount for customer
 */
export async function calculateLoyaltyDiscount(customerId, tenantId) {
  try {
    // Get customer tenure
    const tenureResult = await pool.query(`
      SELECT 
        EXTRACT(MONTH FROM AGE(CURRENT_DATE, c.created_at)) AS months_active,
        COUNT(DISTINCT css.id) AS total_subscriptions
      FROM customers c
      LEFT JOIN client_service_subscriptions css ON c.id = css.customer_id
      WHERE c.id = $1
      GROUP BY c.created_at
    `, [customerId]);

    const tenure = tenureResult.rows[0];
    const monthsActive = parseInt(tenure.months_active);
    const totalSubscriptions = parseInt(tenure.total_subscriptions);

    let discountPercent = 0;
    let discountType = null;
    let reason = null;

    // Tenure-based discount (1% per year, max 10%)
    if (monthsActive >= 12) {
      const years = Math.floor(monthsActive / 12);
      discountPercent = Math.min(10, years * 1);
      discountType = 'tenure';
      reason = `${years} year${years > 1 ? 's' : ''} of service`;
    }

    // Volume discount (overrides tenure if better)
    if (totalSubscriptions >= 10) {
      const volumeDiscount = 15;
      if (volumeDiscount > discountPercent) {
        discountPercent = volumeDiscount;
        discountType = 'volume';
        reason = `${totalSubscriptions} active websites`;
      }
    } else if (totalSubscriptions >= 5) {
      const volumeDiscount = 10;
      if (volumeDiscount > discountPercent) {
        discountPercent = volumeDiscount;
        discountType = 'volume';
        reason = `${totalSubscriptions} active websites`;
      }
    }

    // Check for existing active discount
    const existingResult = await pool.query(`
      SELECT * FROM loyalty_discounts
      WHERE customer_id = $1 AND is_active = true
    `, [customerId]);

    if (existingResult.rows.length === 0 && discountPercent > 0) {
      // Create new loyalty discount
      await pool.query(`
        INSERT INTO loyalty_discounts
        (tenant_id, customer_id, discount_type, discount_percent, reason)
        VALUES ($1, $2, $3, $4, $5)
      `, [tenantId, customerId, discountType, discountPercent, reason]);

      logger.info('Loyalty discount created', { customerId, discountPercent, reason });
    }

    return {
      eligible: discountPercent > 0,
      discountPercent,
      discountType,
      reason,
      monthsActive,
      totalSubscriptions
    };
  } catch (error) {
    logger.error('Error calculating loyalty discount:', error);
    throw error;
  }
}

/**
 * Get customer's active loyalty discounts
 */
export async function getCustomerLoyaltyDiscounts(customerId, tenantId) {
  const result = await pool.query(`
    SELECT * FROM loyalty_discounts
    WHERE customer_id = $1 AND tenant_id = $2 AND is_active = true
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    ORDER BY discount_percent DESC
  `, [customerId, tenantId]);

  return result.rows;
}

// ============================================
// 9. AI-POWERED PLAN RECOMMENDATIONS
// ============================================

/**
 * Generate AI-powered plan recommendation
 */
export async function generatePlanRecommendation(customerId, tenantId) {
  try {
    // Get current subscription and usage
    const usageResult = await pool.query(`
      SELECT 
        css.*,
        sp.name AS current_plan_name,
        sp.tier_level AS current_tier,
        sp.disk_space_gb AS disk_limit,
        sp.bandwidth_gb AS bandwidth_limit,
        sp.price_monthly AS current_price,
        (css.disk_usage_gb / NULLIF(sp.disk_space_gb, 0)) * 100 AS disk_usage_percent,
        (css.bandwidth_usage_gb / NULLIF(sp.bandwidth_gb, 0)) * 100 AS bandwidth_usage_percent
      FROM client_service_subscriptions css
      JOIN service_plans sp ON css.service_plan_id = sp.id
      WHERE css.customer_id = $1 AND css.tenant_id = $2 AND css.status = 'active'
      ORDER BY css.created_at DESC
      LIMIT 1
    `, [customerId, tenantId]);

    if (usageResult.rows.length === 0) {
      return null;
    }

    const current = usageResult.rows[0];
    const diskUsage = parseFloat(current.disk_usage_percent);
    const bandwidthUsage = parseFloat(current.bandwidth_usage_percent);

    let recommendedPlanId = null;
    let recommendationType = null;
    let reason = null;
    let confidence = 0;

    // Recommendation logic
    if (diskUsage > 80 || bandwidthUsage > 80) {
      // Recommend upgrade
      const upgradeResult = await pool.query(`
        SELECT * FROM service_plans
        WHERE tenant_id = $1 
          AND tier_level > $2
          AND is_active = true
        ORDER BY tier_level ASC
        LIMIT 1
      `, [tenantId, current.current_tier]);

      if (upgradeResult.rows.length > 0) {
        recommendedPlanId = upgradeResult.rows[0].id;
        recommendationType = 'upgrade';
        reason = `Your ${diskUsage > bandwidthUsage ? 'disk' : 'bandwidth'} usage is at ${Math.max(diskUsage, bandwidthUsage).toFixed(1)}%. Upgrade to avoid overages and improve performance.`;
        confidence = Math.min(100, diskUsage > bandwidthUsage ? diskUsage : bandwidthUsage);
      }
    } else if (diskUsage < 30 && bandwidthUsage < 30) {
      // Recommend downgrade (save money)
      const downgradeResult = await pool.query(`
        SELECT * FROM service_plans
        WHERE tenant_id = $1 
          AND tier_level < $2
          AND is_active = true
        ORDER BY tier_level DESC
        LIMIT 1
      `, [tenantId, current.current_tier]);

      if (downgradeResult.rows.length > 0) {
        const downgrade = downgradeResult.rows[0];
        const potentialSavings = parseFloat(current.current_price) - parseFloat(downgrade.price_monthly);

        recommendedPlanId = downgrade.id;
        recommendationType = 'downgrade';
        reason = `You're only using ${Math.max(diskUsage, bandwidthUsage).toFixed(1)}% of your resources. Save $${potentialSavings.toFixed(2)}/month by switching to ${downgrade.name}.`;
        confidence = 100 - Math.max(diskUsage, bandwidthUsage);
      }
    }

    if (!recommendedPlanId) {
      return {
        hasRecommendation: false,
        message: 'Your current plan is optimal for your usage'
      };
    }

    // Save recommendation
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // Valid for 30 days

    const recommendedPlan = await pool.query(`
      SELECT * FROM service_plans WHERE id = $1
    `, [recommendedPlanId]);

    const recommendation = await pool.query(`
      INSERT INTO plan_recommendations
      (tenant_id, customer_id, current_plan_id, recommended_plan_id,
       recommendation_reason, confidence_score, usage_analysis, 
       potential_savings, potential_revenue, status, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10)
      RETURNING *
    `, [
      tenantId,
      customerId,
      current.service_plan_id,
      recommendedPlanId,
      reason,
      confidence,
      JSON.stringify({
        disk_usage: diskUsage,
        bandwidth_usage: bandwidthUsage,
        current_tier: current.current_tier
      }),
      recommendationType === 'downgrade' 
        ? parseFloat(current.current_price) - parseFloat(recommendedPlan.rows[0].price_monthly)
        : 0,
      recommendationType === 'upgrade'
        ? parseFloat(recommendedPlan.rows[0].price_monthly) - parseFloat(current.current_price)
        : 0,
      expiresAt
    ]);

    logger.info('Plan recommendation generated', {
      customerId,
      type: recommendationType,
      confidence
    });

    return {
      hasRecommendation: true,
      recommendation: recommendation.rows[0],
      recommendedPlan: recommendedPlan.rows[0],
      type: recommendationType
    };
  } catch (error) {
    logger.error('Error generating plan recommendation:', error);
    throw error;
  }
}

/**
 * Get pending recommendations for customer
 */
export async function getCustomerRecommendations(customerId, tenantId) {
  const result = await pool.query(`
    SELECT pr.*, 
           cp.name AS current_plan_name,
           rp.name AS recommended_plan_name,
           rp.price_monthly AS recommended_price
    FROM plan_recommendations pr
    JOIN service_plans cp ON pr.current_plan_id = cp.id
    JOIN service_plans rp ON pr.recommended_plan_id = rp.id
    WHERE pr.customer_id = $1 AND pr.tenant_id = $2
      AND pr.status = 'pending'
      AND pr.expires_at > CURRENT_TIMESTAMP
    ORDER BY pr.created_at DESC
  `, [customerId, tenantId]);

  return result.rows;
}

/**
 * Accept plan recommendation (automated upgrade/downgrade)
 */
export async function acceptRecommendation(recommendationId, tenantId) {
  try {
    const result = await pool.query(`
      UPDATE plan_recommendations
      SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `, [recommendationId, tenantId]);

    if (result.rows.length === 0) {
      throw new Error('Recommendation not found');
    }

    const recommendation = result.rows[0];

    // Update subscription to new plan
    await pool.query(`
      UPDATE client_service_subscriptions
      SET service_plan_id = $1, updated_at = CURRENT_TIMESTAMP
      WHERE customer_id = $2 AND tenant_id = $3 AND status = 'active'
    `, [
      recommendation.recommended_plan_id,
      recommendation.customer_id,
      tenantId
    ]);

    logger.info('Recommendation accepted', {
      recommendationId,
      customerId: recommendation.customer_id,
      newPlanId: recommendation.recommended_plan_id
    });

    return recommendation;
  } catch (error) {
    logger.error('Error accepting recommendation:', error);
    throw error;
  }
}

// ============================================
// 10. CLIENT SUCCESS METRICS DASHBOARD
// ============================================

/**
 * Record daily success metrics for customer
 */
export async function recordSuccessMetrics(customerId, tenantId, metricsData) {
  try {
    const result = await pool.query(`
      INSERT INTO client_success_metrics
      (tenant_id, customer_id, metric_date, uptime_percentage, attacks_blocked,
       malware_scans, malware_threats_found, backup_count, cdn_bandwidth_saved_gb,
       ssl_certificates_renewed, support_tickets_resolved, avg_response_time_minutes,
       estimated_value_delivered)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (tenant_id, customer_id, metric_date) 
      DO UPDATE SET
        uptime_percentage = EXCLUDED.uptime_percentage,
        attacks_blocked = EXCLUDED.attacks_blocked,
        malware_scans = EXCLUDED.malware_scans,
        malware_threats_found = EXCLUDED.malware_threats_found,
        backup_count = EXCLUDED.backup_count,
        cdn_bandwidth_saved_gb = EXCLUDED.cdn_bandwidth_saved_gb,
        ssl_certificates_renewed = EXCLUDED.ssl_certificates_renewed,
        support_tickets_resolved = EXCLUDED.support_tickets_resolved,
        avg_response_time_minutes = EXCLUDED.avg_response_time_minutes,
        estimated_value_delivered = EXCLUDED.estimated_value_delivered
      RETURNING *
    `, [
      tenantId,
      customerId,
      metricsData.metricDate || new Date().toISOString().split('T')[0],
      metricsData.uptimePercentage || 99.99,
      metricsData.attacksBlocked || 0,
      metricsData.malwareScans || 0,
      metricsData.malwareThreatsFound || 0,
      metricsData.backupCount || 0,
      metricsData.cdnBandwidthSavedGb || 0,
      metricsData.sslCertificatesRenewed || 0,
      metricsData.supportTicketsResolved || 0,
      metricsData.avgResponseTimeMinutes || 0,
      metricsData.estimatedValueDelivered || 0
    ]);

    logger.info('Success metrics recorded', { customerId, date: metricsData.metricDate });

    return result.rows[0];
  } catch (error) {
    logger.error('Error recording success metrics:', error);
    throw error;
  }
}

/**
 * Get customer success dashboard data
 */
export async function getSuccessDashboard(customerId, tenantId, days = 30) {
  try {
    // Get metrics for last N days
    const metricsResult = await pool.query(`
      SELECT * FROM client_success_metrics
      WHERE customer_id = $1 AND tenant_id = $2
        AND metric_date >= CURRENT_DATE - INTERVAL '1 day' * $3
      ORDER BY metric_date DESC
    `, [customerId, tenantId, days]);

    // Calculate aggregates
    const metrics = metricsResult.rows;
    const totalAttacksBlocked = metrics.reduce((sum, m) => sum + (m.attacks_blocked || 0), 0);
    const totalBackups = metrics.reduce((sum, m) => sum + (m.backup_count || 0), 0);
    const totalValueDelivered = metrics.reduce((sum, m) => sum + parseFloat(m.estimated_value_delivered || 0), 0);
    const avgUptime = metrics.reduce((sum, m) => sum + parseFloat(m.uptime_percentage || 0), 0) / metrics.length;

    // Get milestones
    const milestonesResult = await pool.query(`
      SELECT * FROM success_milestones
      WHERE customer_id = $1 AND tenant_id = $2
      ORDER BY achieved_at DESC
      LIMIT 10
    `, [customerId, tenantId]);

    return {
      period: `Last ${days} days`,
      metrics: {
        avgUptime: avgUptime.toFixed(2),
        totalAttacksBlocked,
        totalBackups,
        totalValueDelivered: totalValueDelivered.toFixed(2)
      },
      dailyMetrics: metrics,
      milestones: milestonesResult.rows
    };
  } catch (error) {
    logger.error('Error fetching success dashboard:', error);
    throw error;
  }
}

/**
 * Award milestone badge
 */
export async function awardMilestone(customerId, tenantId, milestoneType, milestoneName, description) {
  try {
    await pool.query(`
      INSERT INTO success_milestones
      (tenant_id, customer_id, milestone_type, milestone_name, milestone_description, badge_awarded)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT DO NOTHING
    `, [tenantId, customerId, milestoneType, milestoneName, description]);

    logger.info('Milestone awarded', { customerId, milestoneType });

    return true;
  } catch (error) {
    logger.error('Error awarding milestone:', error);
    throw error;
  }
}

export default {
  // Promo codes
  applyPromoCode,
  recordPromoRedemption,
  getActivePromos,

  // Loyalty
  calculateLoyaltyDiscount,
  getCustomerLoyaltyDiscounts,

  // AI Recommendations
  generatePlanRecommendation,
  getCustomerRecommendations,
  acceptRecommendation,

  // Success Metrics
  recordSuccessMetrics,
  getSuccessDashboard,
  awardMilestone
};
