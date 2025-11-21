/**
 * Enhanced Plan Access Service
 * Handles: Trials, Referrals, Overages, Annual Commits, Resource Pooling, 
 *          Grace Periods, Promos, Loyalty, AI Recommendations, Success Metrics
 */

import pool from '../db/index.js';
import logger from '../config/logger.js';
import * as aiService from './aiService.js';

// ============================================
// 1. USAGE-BASED BILLING & OVERAGES
// ============================================

/**
 * Calculate overage charges for a subscription
 */
export async function calculateOverageCharges(subscriptionId, tenantId, billingPeriodStart, billingPeriodEnd) {
  try {
    const result = await pool.query(`
      WITH usage_data AS (
        SELECT 
          css.id,
          css.customer_id,
          css.service_plan_id,
          css.disk_usage_gb,
          css.bandwidth_usage_gb,
          sp.disk_space_gb AS disk_limit,
          sp.bandwidth_gb AS bandwidth_limit
        FROM client_service_subscriptions css
        JOIN service_plans sp ON css.service_plan_id = sp.id
        WHERE css.id = $1 AND css.tenant_id = $2
      ),
      overage_calc AS (
        SELECT 
          ud.*,
          GREATEST(0, ud.disk_usage_gb - ud.disk_limit) AS disk_overage,
          GREATEST(0, ud.bandwidth_usage_gb - ud.bandwidth_limit) AS bandwidth_overage
        FROM usage_data ud
      ),
      rates AS (
        SELECT 
          oc.*,
          COALESCE(disk_rate.rate_per_unit, 0.10) AS disk_rate,
          COALESCE(disk_rate.grace_amount, 0) AS disk_grace,
          COALESCE(bw_rate.rate_per_unit, 0.05) AS bandwidth_rate,
          COALESCE(bw_rate.grace_amount, 0) AS bandwidth_grace
        FROM overage_calc oc
        LEFT JOIN plan_overage_rates disk_rate 
          ON oc.service_plan_id = disk_rate.plan_id 
          AND disk_rate.resource_type = 'disk_space'
        LEFT JOIN plan_overage_rates bw_rate 
          ON oc.service_plan_id = bw_rate.plan_id 
          AND bw_rate.resource_type = 'bandwidth'
      )
      SELECT 
        id,
        customer_id,
        GREATEST(0, disk_overage - disk_grace) AS billable_disk_overage,
        GREATEST(0, bandwidth_overage - bandwidth_grace) AS billable_bandwidth_overage,
        disk_rate,
        bandwidth_rate,
        GREATEST(0, disk_overage - disk_grace) * disk_rate AS disk_charge,
        GREATEST(0, bandwidth_overage - bandwidth_grace) * bandwidth_rate AS bandwidth_charge
      FROM rates
    `, [subscriptionId, tenantId]);

    const data = result.rows[0];
    const charges = [];

    // Create disk overage charge if applicable
    if (data.billable_disk_overage > 0) {
      const diskCharge = await pool.query(`
        INSERT INTO usage_overage_charges 
        (tenant_id, customer_id, subscription_id, resource_type, overage_amount, 
         rate_per_unit, total_charge, billing_period_start, billing_period_end, status)
        VALUES ($1, $2, $3, 'disk_space', $4, $5, $6, $7, $8, 'pending')
        RETURNING *
      `, [
        tenantId,
        data.customer_id,
        subscriptionId,
        data.billable_disk_overage,
        data.disk_rate,
        data.disk_charge,
        billingPeriodStart,
        billingPeriodEnd
      ]);
      charges.push(diskCharge.rows[0]);
    }

    // Create bandwidth overage charge if applicable
    if (data.billable_bandwidth_overage > 0) {
      const bwCharge = await pool.query(`
        INSERT INTO usage_overage_charges 
        (tenant_id, customer_id, subscription_id, resource_type, overage_amount, 
         rate_per_unit, total_charge, billing_period_start, billing_period_end, status)
        VALUES ($1, $2, $3, 'bandwidth', $4, $5, $6, $7, $8, 'pending')
        RETURNING *
      `, [
        tenantId,
        data.customer_id,
        subscriptionId,
        data.billable_bandwidth_overage,
        data.bandwidth_rate,
        data.bandwidth_charge,
        billingPeriodStart,
        billingPeriodEnd
      ]);
      charges.push(bwCharge.rows[0]);
    }

    logger.info('Overage charges calculated', {
      subscriptionId,
      charges: charges.length,
      totalCharge: charges.reduce((sum, c) => sum + parseFloat(c.total_charge), 0)
    });

    return charges;
  } catch (error) {
    logger.error('Error calculating overage charges:', error);
    throw error;
  }
}

/**
 * Get pending overage charges for customer
 */
export async function getPendingOverageCharges(customerId, tenantId) {
  const result = await pool.query(`
    SELECT uoc.*, sp.name AS plan_name
    FROM usage_overage_charges uoc
    JOIN client_service_subscriptions css ON uoc.subscription_id = css.id
    JOIN service_plans sp ON css.service_plan_id = sp.id
    WHERE uoc.customer_id = $1 AND uoc.tenant_id = $2 AND uoc.status = 'pending'
    ORDER BY uoc.created_at DESC
  `, [customerId, tenantId]);

  return result.rows;
}

// ============================================
// 2. TRIAL PERIODS & FREEMIUM
// ============================================

/**
 * Start trial subscription
 */
export async function startTrial(customerId, tenantId, planId) {
  try {
    // Get plan trial configuration
    const planResult = await pool.query(`
      SELECT trial_enabled, trial_days, trial_requires_payment_method
      FROM service_plans
      WHERE id = $1 AND tenant_id = $2
    `, [planId, tenantId]);

    const plan = planResult.rows[0];
    if (!plan || !plan.trial_enabled) {
      throw new Error('Trial not available for this plan');
    }

    const trialStartDate = new Date();
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + plan.trial_days);

    const result = await pool.query(`
      INSERT INTO client_service_subscriptions
      (tenant_id, customer_id, service_plan_id, status, billing_cycle, price_paid,
       is_trial, trial_days, trial_started_at, trial_ends_at, next_billing_date)
      VALUES ($1, $2, $3, 'active', 'monthly', 0.00, true, $4, $5, $6, $7)
      RETURNING *
    `, [
      tenantId,
      customerId,
      planId,
      plan.trial_days,
      trialStartDate,
      trialEndDate,
      trialEndDate // Next billing after trial
    ]);

    logger.info('Trial subscription started', {
      customerId,
      planId,
      trialDays: plan.trial_days,
      trialEndsAt: trialEndDate
    });

    return result.rows[0];
  } catch (error) {
    logger.error('Error starting trial:', error);
    throw error;
  }
}

/**
 * Convert trial to paid subscription
 */
export async function convertTrialToPaid(subscriptionId, tenantId, paymentMethodId) {
  try {
    const result = await pool.query(`
      UPDATE client_service_subscriptions
      SET 
        is_trial = false,
        converted_from_trial = true,
        trial_conversion_date = CURRENT_TIMESTAMP,
        status = 'active'
      WHERE id = $1 AND tenant_id = $2 AND is_trial = true
      RETURNING *
    `, [subscriptionId, tenantId]);

    if (result.rows.length === 0) {
      throw new Error('Trial subscription not found');
    }

    const subscription = result.rows[0];

    // Record conversion for analytics
    await pool.query(`
      INSERT INTO trial_conversions
      (tenant_id, customer_id, subscription_id, trial_started_at, trial_ended_at, 
       converted_to_paid, conversion_date, final_plan_id)
      VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP, $6)
    `, [
      tenantId,
      subscription.customer_id,
      subscriptionId,
      subscription.trial_started_at,
      subscription.trial_ends_at,
      subscription.service_plan_id
    ]);

    logger.info('Trial converted to paid', { subscriptionId, customerId: subscription.customer_id });

    return subscription;
  } catch (error) {
    logger.error('Error converting trial:', error);
    throw error;
  }
}

/**
 * Get expiring trials (for automated notifications)
 */
export async function getExpiringTrials(tenantId, daysBeforeExpiry = 3) {
  const result = await pool.query(`
    SELECT css.*, u.email, u.first_name, sp.name AS plan_name
    FROM client_service_subscriptions css
    JOIN customers c ON css.customer_id = c.id
    JOIN users u ON c.user_id = u.id
    JOIN service_plans sp ON css.service_plan_id = sp.id
    WHERE css.tenant_id = $1 
      AND css.is_trial = true 
      AND css.status = 'active'
      AND css.trial_ends_at BETWEEN CURRENT_TIMESTAMP AND CURRENT_TIMESTAMP + INTERVAL '1 day' * $2
    ORDER BY css.trial_ends_at ASC
  `, [tenantId, daysBeforeExpiry]);

  return result.rows;
}

// ============================================
// 3. REFERRAL PROGRAM
// ============================================

/**
 * Generate referral code for customer
 */
export async function generateReferralCode(customerId, tenantId, config = {}) {
  try {
    // Generate unique code (first name + random)
    // Need to join with users table since customers doesn't have first_name/last_name
    const customerResult = await pool.query(`
      SELECT u.first_name, u.last_name 
      FROM customers c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = $1
    `, [customerId]);

    const customer = customerResult.rows[0];
    const baseCode = `${customer.first_name}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const result = await pool.query(`
      INSERT INTO referral_codes
      (tenant_id, customer_id, referral_code, discount_type, discount_value, 
       referrer_reward_type, referrer_reward_value, max_uses, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      tenantId,
      customerId,
      config.customCode || baseCode,
      config.discountType || 'percentage',
      config.discountValue || 10.00,
      config.referrerRewardType || 'credit',
      config.referrerRewardValue || 10.00,
      config.maxUses || null,
      config.expiresAt || null
    ]);

    logger.info('Referral code generated', { customerId, code: baseCode });

    return result.rows[0];
  } catch (error) {
    logger.error('Error generating referral code:', error);
    throw error;
  }
}

/**
 * Apply referral code to new subscription
 */
export async function applyReferralCode(referralCode, newCustomerId, tenantId, subscriptionId) {
  try {
    // Get referral code details
    const codeResult = await pool.query(`
      SELECT * FROM referral_codes
      WHERE referral_code = $1 AND is_active = true
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        AND (max_uses IS NULL OR current_uses < max_uses)
    `, [referralCode]);

    if (codeResult.rows.length === 0) {
      throw new Error('Invalid or expired referral code');
    }

    const code = codeResult.rows[0];

    // Get subscription amount
    const subResult = await pool.query(`
      SELECT css.*, sp.price_monthly
      FROM client_service_subscriptions css
      JOIN service_plans sp ON css.service_plan_id = sp.id
      WHERE css.id = $1
    `, [subscriptionId]);

    const subscription = subResult.rows[0];

    // Calculate discounts
    const refereeDiscount = code.discount_type === 'percentage'
      ? subscription.price_monthly * (code.discount_value / 100)
      : code.discount_value;

    // Create reward record
    await pool.query(`
      INSERT INTO referral_rewards
      (tenant_id, referral_code_id, referrer_id, referee_id, referee_subscription_id,
       referrer_reward_amount, referee_discount_amount, referee_subscription_value, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
    `, [
      tenantId,
      code.id,
      code.customer_id,
      newCustomerId,
      subscriptionId,
      code.referrer_reward_value,
      refereeDiscount,
      subscription.price_monthly
    ]);

    // Update referral code usage
    await pool.query(`
      UPDATE referral_codes
      SET current_uses = current_uses + 1,
          total_revenue_generated = total_revenue_generated + $1
      WHERE id = $2
    `, [subscription.price_monthly, code.id]);

    logger.info('Referral code applied', {
      code: referralCode,
      referrer: code.customer_id,
      referee: newCustomerId,
      discount: refereeDiscount
    });

    return {
      refereeDiscount,
      referrerReward: code.referrer_reward_value
    };
  } catch (error) {
    logger.error('Error applying referral code:', error);
    throw error;
  }
}

/**
 * Get customer's referral stats
 */
export async function getReferralStats(customerId, tenantId) {
  const result = await pool.query(`
    SELECT 
      rc.referral_code,
      rc.current_uses,
      rc.max_uses,
      rc.total_revenue_generated,
      COUNT(rr.id) AS total_referrals,
      SUM(CASE WHEN rr.status = 'paid' THEN rr.referrer_reward_amount ELSE 0 END) AS total_rewards_earned,
      SUM(CASE WHEN rr.status = 'pending' THEN rr.referrer_reward_amount ELSE 0 END) AS pending_rewards
    FROM referral_codes rc
    LEFT JOIN referral_rewards rr ON rc.id = rr.referral_code_id
    WHERE rc.customer_id = $1 AND rc.tenant_id = $2
    GROUP BY rc.id, rc.referral_code, rc.current_uses, rc.max_uses, rc.total_revenue_generated
  `, [customerId, tenantId]);

  return result.rows[0] || null;
}

// ============================================
// 4. ANNUAL COMMIT DISCOUNTS
// ============================================

/**
 * Create annual commitment subscription
 */
export async function createAnnualCommitment(customerId, tenantId, planId, commitMonths = 12) {
  try {
    // Calculate discount based on commit length
    const discountPercent = commitMonths >= 36 ? 30 : commitMonths >= 24 ? 20 : 15;
    const earlyTerminationFee = commitMonths * 10; // $10/month remaining

    const commitStartDate = new Date();
    const commitEndDate = new Date();
    commitEndDate.setMonth(commitEndDate.getMonth() + commitMonths);

    // Get plan price
    const planResult = await pool.query('SELECT price_monthly FROM service_plans WHERE id = $1', [planId]);
    const planPrice = planResult.rows[0].price_monthly;
    const discountedPrice = planPrice * (1 - discountPercent / 100);

    const subscription = await pool.query(`
      INSERT INTO client_service_subscriptions
      (tenant_id, customer_id, service_plan_id, status, billing_cycle,
       price_paid, has_annual_commit, commit_start_date, commit_end_date, 
       commit_discount_percent, early_termination_fee, commit_months)
      VALUES ($1, $2, $3, 'active', 'monthly', $4, true, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      tenantId,
      customerId,
      planId,
      discountedPrice,
      commitStartDate,
      commitEndDate,
      discountPercent,
      earlyTerminationFee,
      commitMonths
    ]);

    logger.info('Annual commitment created', {
      customerId,
      commitMonths,
      discountPercent,
      earlyTerminationFee
    });

    return subscription.rows[0];
  } catch (error) {
    logger.error('Error creating annual commitment:', error);
    throw error;
  }
}

/**
 * Process early termination
 */
export async function processEarlyTermination(subscriptionId, tenantId, reason) {
  try {
    const result = await pool.query(`
      SELECT * FROM client_service_subscriptions
      WHERE id = $1 AND tenant_id = $2 AND has_annual_commit = true
    `, [subscriptionId, tenantId]);

    if (result.rows.length === 0) {
      throw new Error('Commitment not found');
    }

    const subscription = result.rows[0];
    const commitEndDate = new Date(subscription.commit_end_date);
    const today = new Date();

    if (today >= commitEndDate) {
      // Commitment already ended
      return { earlyTerminationFee: 0, message: 'Commitment period already ended' };
    }

    const monthsRemaining = Math.ceil((commitEndDate - today) / (1000 * 60 * 60 * 24 * 30));

    // Record violation
    await pool.query(`
      INSERT INTO commitment_violations
      (tenant_id, subscription_id, customer_id, original_commit_end_date,
       actual_termination_date, months_remaining, early_termination_fee, fee_status)
      VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6, 'pending')
    `, [
      tenantId,
      subscriptionId,
      subscription.customer_id,
      subscription.commit_end_date,
      monthsRemaining,
      subscription.early_termination_fee
    ]);

    logger.info('Early termination processed', {
      subscriptionId,
      monthsRemaining,
      fee: subscription.early_termination_fee
    });

    return {
      earlyTerminationFee: subscription.early_termination_fee,
      monthsRemaining,
      message: `Early termination fee of $${subscription.early_termination_fee} applies`
    };
  } catch (error) {
    logger.error('Error processing early termination:', error);
    throw error;
  }
}

// ============================================
// 5. RESOURCE POOLING (ENTERPRISE)
// ============================================

/**
 * Create resource pool for enterprise customer
 */
export async function createResourcePool(customerId, tenantId, poolData) {
  try {
    const result = await pool.query(`
      INSERT INTO resource_pools
      (tenant_id, customer_id, pool_name, pool_type, 
       total_disk_gb, total_bandwidth_gb, total_websites, total_emails, total_databases,
       price_monthly)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      tenantId,
      customerId,
      poolData.poolName,
      poolData.poolType || 'shared',
      poolData.totalDiskGb,
      poolData.totalBandwidthGb,
      poolData.totalWebsites,
      poolData.totalEmails,
      poolData.totalDatabases,
      poolData.priceMonthly
    ]);

    logger.info('Resource pool created', { customerId, poolId: result.rows[0].id });

    return result.rows[0];
  } catch (error) {
    logger.error('Error creating resource pool:', error);
    throw error;
  }
}

/**
 * Add subscription to resource pool
 */
export async function addSubscriptionToPool(resourcePoolId, subscriptionId, tenantId, allocations) {
  try {
    // Check pool capacity
    const poolResult = await pool.query(`
      SELECT * FROM resource_pools WHERE id = $1 AND tenant_id = $2
    `, [resourcePoolId, tenantId]);

    const pool = poolResult.rows[0];
    const availableDisk = pool.total_disk_gb - pool.used_disk_gb;
    const availableBandwidth = pool.total_bandwidth_gb - pool.used_bandwidth_gb;

    if (allocations.diskGb > availableDisk || allocations.bandwidthGb > availableBandwidth) {
      throw new Error('Insufficient pool resources');
    }

    // Add to pool
    await pool.query(`
      INSERT INTO pooled_subscriptions
      (tenant_id, resource_pool_id, subscription_id, allocated_disk_gb, 
       allocated_bandwidth_gb, allocated_websites, allocated_emails, allocated_databases)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      tenantId,
      resourcePoolId,
      subscriptionId,
      allocations.diskGb,
      allocations.bandwidthGb,
      allocations.websites,
      allocations.emails,
      allocations.databases
    ]);

    // Update pool usage
    await pool.query(`
      UPDATE resource_pools
      SET 
        used_disk_gb = used_disk_gb + $1,
        used_bandwidth_gb = used_bandwidth_gb + $2,
        used_websites = used_websites + $3,
        used_emails = used_emails + $4,
        used_databases = used_databases + $5
      WHERE id = $6
    `, [
      allocations.diskGb,
      allocations.bandwidthGb,
      allocations.websites,
      allocations.emails,
      allocations.databases,
      resourcePoolId
    ]);

    logger.info('Subscription added to pool', { resourcePoolId, subscriptionId });

    return true;
  } catch (error) {
    logger.error('Error adding subscription to pool:', error);
    throw error;
  }
}

// ============================================
// 6. GRACE PERIODS & DUNNING MANAGEMENT
// ============================================

/**
 * Record failed payment attempt
 */
export async function recordFailedPayment(subscriptionId, tenantId, paymentData) {
  try {
    // Get current attempt count
    const countResult = await pool.query(`
      SELECT COUNT(*) AS attempt_count
      FROM failed_payment_attempts
      WHERE subscription_id = $1 AND retry_status IN ('pending', 'scheduled')
    `, [subscriptionId]);

    const attemptNumber = parseInt(countResult.rows[0].attempt_count) + 1;

    // Calculate next retry date based on dunning rules
    const nextRetryDays = attemptNumber === 1 ? 3 : attemptNumber === 2 ? 4 : attemptNumber === 3 ? 7 : 7;
    const nextRetryDate = new Date();
    nextRetryDate.setDate(nextRetryDate.getDate() + nextRetryDays);

    const result = await pool.query(`
      INSERT INTO failed_payment_attempts
      (tenant_id, subscription_id, customer_id, invoice_id, payment_amount,
       failure_reason, attempt_number, next_retry_date, retry_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled')
      RETURNING *
    `, [
      tenantId,
      subscriptionId,
      paymentData.customerId,
      paymentData.invoiceId,
      paymentData.amount,
      paymentData.failureReason,
      attemptNumber,
      nextRetryDate
    ]);

    logger.info('Failed payment recorded', {
      subscriptionId,
      attemptNumber,
      nextRetryDate
    });

    return result.rows[0];
  } catch (error) {
    logger.error('Error recording failed payment:', error);
    throw error;
  }
}

/**
 * Get payments to retry today
 */
export async function getPaymentsToRetry(tenantId) {
  const result = await pool.query(`
    SELECT fpa.*, css.customer_id, u.email, sp.name AS plan_name
    FROM failed_payment_attempts fpa
    JOIN client_service_subscriptions css ON fpa.subscription_id = css.id
    JOIN customers c ON css.customer_id = c.id
    JOIN users u ON c.user_id = u.id
    JOIN service_plans sp ON css.service_plan_id = sp.id
    WHERE fpa.tenant_id = $1 
      AND fpa.retry_status = 'scheduled'
      AND fpa.next_retry_date <= CURRENT_DATE
    ORDER BY fpa.next_retry_date ASC
  `, [tenantId]);

  return result.rows;
}

// Continued in next message due to length...
