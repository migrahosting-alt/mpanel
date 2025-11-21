/**
 * Referral Service
 * Manage customer referral program
 */

import pool from '../db/index.js';
import logger from '../utils/logger.js';
import queueService from './queueService.js';
import crypto from 'crypto';

/**
 * Generate unique referral code
 */
function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * Create referral for user
 */
export async function createReferral(userId, tenantId) {
  try {
    // Check if user already has a referral code
    const existing = await pool.query(
      'SELECT referral_code FROM referrals WHERE referrer_id = $1 LIMIT 1',
      [userId]
    );
    
    if (existing.rows.length > 0) {
      return existing.rows[0];
    }
    
    // Generate unique code
    let code = generateReferralCode();
    let unique = false;
    
    while (!unique) {
      const check = await pool.query(
        'SELECT id FROM referrals WHERE referral_code = $1',
        [code]
      );
      
      if (check.rows.length === 0) {
        unique = true;
      } else {
        code = generateReferralCode();
      }
    }
    
    const result = await pool.query(
      `INSERT INTO referrals (tenant_id, referrer_id, referral_code)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [tenantId, userId, code]
    );
    
    logger.info(`Created referral code ${code} for user ${userId}`);
    return result.rows[0];
  } catch (error) {
    logger.error('Error creating referral:', error);
    throw error;
  }
}

/**
 * Track referral click
 */
export async function trackClick(referralCode, ipAddress) {
  try {
    await pool.query(
      `UPDATE referrals 
       SET clicks = clicks + 1, last_click_at = NOW()
       WHERE referral_code = $1`,
      [referralCode]
    );
    
    logger.debug(`Tracked click for referral code: ${referralCode}`);
  } catch (error) {
    logger.error('Error tracking referral click:', error);
  }
}

/**
 * Process referral signup
 */
export async function processSignup(referralCode, referredUserId, referredEmail) {
  try {
    const result = await pool.query(
      `UPDATE referrals 
       SET referred_id = $1, referred_email = $2, signup_date = NOW(), status = 'completed'
       WHERE referral_code = $3
       RETURNING *`,
      [referredUserId, referredEmail, referralCode]
    );
    
    if (result.rows.length === 0) {
      logger.warn(`Referral code not found: ${referralCode}`);
      return null;
    }
    
    const referral = result.rows[0];
    
    // Notify referrer
    const userResult = await pool.query(
      'SELECT email, first_name FROM users WHERE id = $1',
      [referral.referrer_id]
    );
    
    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      
      await queueService.addEmailJob({
        tenantId: referral.tenant_id,
        from: process.env.EMAIL_PARTNERSHIPS,
        to: user.email,
        subject: 'Your referral signed up!',
        html: `
          <h2>Great news, ${user.first_name}!</h2>
          <p>Someone used your referral link to sign up for MigraHosting.</p>
          <p>Once they make their first payment, you'll receive your referral commission.</p>
          <p>Keep sharing your referral link to earn more!</p>
          <p><strong>Your Referral Code:</strong> ${referral.referral_code}</p>
          <p><a href="${process.env.APP_URL}/client/referrals">View Referrals Dashboard</a></p>
        `,
        department: 'partnerships',
        priority: 4,
      });
    }
    
    logger.info(`Processed signup for referral ${referralCode}`);
    return referral;
  } catch (error) {
    logger.error('Error processing referral signup:', error);
    throw error;
  }
}

/**
 * Process referral conversion (first payment)
 */
export async function processConversion(referredUserId, commissionAmount) {
  try {
    const result = await pool.query(
      `UPDATE referrals 
       SET conversion_date = NOW(), commission_amount = $1, commission_status = 'approved'
       WHERE referred_id = $2
       RETURNING *`,
      [commissionAmount, referredUserId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const referral = result.rows[0];
    
    // Notify referrer of commission
    const userResult = await pool.query(
      'SELECT email, first_name FROM users WHERE id = $1',
      [referral.referrer_id]
    );
    
    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      
      await queueService.addEmailJob({
        tenantId: referral.tenant_id,
        from: process.env.EMAIL_PARTNERSHIPS,
        to: user.email,
        subject: `You earned $${commissionAmount} in referral commission!`,
        html: `
          <h2>Congratulations, ${user.first_name}!</h2>
          <p>Your referral made their first payment, and you've earned a commission!</p>
          <p><strong>Commission Amount:</strong> $${commissionAmount}</p>
          <p>Your commission will be processed with your next payout.</p>
          <p><a href="${process.env.APP_URL}/client/referrals">View Referrals Dashboard</a></p>
        `,
        department: 'partnerships',
        priority: 3,
      });
    }
    
    logger.info(`Processed conversion for referral ${referral.id}, commission: $${commissionAmount}`);
    return referral;
  } catch (error) {
    logger.error('Error processing referral conversion:', error);
    throw error;
  }
}

/**
 * Get user referrals
 */
export async function getUserReferrals(userId) {
  try {
    const result = await pool.query(
      `SELECT * FROM referrals 
       WHERE referrer_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    
    // Calculate totals
    const stats = {
      total_referrals: result.rows.length,
      completed: result.rows.filter(r => r.status === 'completed').length,
      total_clicks: result.rows.reduce((sum, r) => sum + (r.clicks || 0), 0),
      total_commission: result.rows
        .filter(r => r.commission_status === 'approved' || r.commission_status === 'paid')
        .reduce((sum, r) => sum + parseFloat(r.commission_amount || 0), 0),
      pending_commission: result.rows
        .filter(r => r.commission_status === 'approved')
        .reduce((sum, r) => sum + parseFloat(r.commission_amount || 0), 0),
    };
    
    return {
      referrals: result.rows,
      stats,
    };
  } catch (error) {
    logger.error('Error getting user referrals:', error);
    throw error;
  }
}

/**
 * Mark commission as paid
 */
export async function markCommissionPaid(referralId) {
  try {
    await pool.query(
      `UPDATE referrals 
       SET commission_status = 'paid', commission_paid_at = NOW()
       WHERE id = $1`,
      [referralId]
    );
    
    logger.info(`Marked commission paid for referral ${referralId}`);
    return { success: true };
  } catch (error) {
    logger.error('Error marking commission paid:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get referral statistics for tenant
 */
export async function getReferralStats(tenantId) {
  try {
    const result = await pool.query(
      `SELECT 
        COUNT(*) as total_referrals,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_referrals,
        SUM(clicks) as total_clicks,
        SUM(commission_amount) FILTER (WHERE commission_status = 'paid') as total_paid,
        SUM(commission_amount) FILTER (WHERE commission_status = 'approved') as pending_payout,
        COUNT(DISTINCT referrer_id) as active_referrers
       FROM referrals
       WHERE tenant_id = $1`,
      [tenantId]
    );
    
    return result.rows[0];
  } catch (error) {
    logger.error('Error getting referral stats:', error);
    throw error;
  }
}

export default {
  createReferral,
  trackClick,
  processSignup,
  processConversion,
  getUserReferrals,
  markCommissionPaid,
  getReferralStats,
};
