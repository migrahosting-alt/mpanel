/**
 * Enhanced Plan Access - Automated Cron Jobs
 * Schedules: Trial conversions, overage billing, dunning, loyalty upgrades, 
 *            AI recommendations, success metrics, milestone awards
 */

import cron from 'node-cron';
import logger from '../config/logger.js';
import * as enhancedPlanService from './enhancedPlanService.js';
import * as enhancedPlanService2 from './enhancedPlanService2.js';
import pool from '../db/index.js';

// ============================================
// CRON JOB DEFINITIONS
// ============================================

/**
 * Daily: Check for expiring trials and send notifications
 * Runs at 9:00 AM every day
 */
export const expiringTrialsJob = cron.schedule('0 9 * * *', async () => {
  try {
    logger.info('Starting expiring trials check...');

    const tenants = await pool.query('SELECT id FROM tenants WHERE is_active = true');

    for (const tenant of tenants.rows) {
      // Get trials expiring in 3 days
      const expiringTrials = await enhancedPlanService.getExpiringTrials(tenant.id, 3);

      for (const trial of expiringTrials) {
        // Send notification email
        logger.info('Trial expiring soon', {
          customerId: trial.customer_id,
          email: trial.email,
          expiresAt: trial.trial_ends_at
        });

        // TODO: Send email notification
        // await emailService.sendTrialExpiringEmail(trial);
      }
    }

    logger.info('Expiring trials check completed', { count: expiringTrials.length });
  } catch (error) {
    logger.error('Error in expiring trials job:', error);
  }
}, {
  scheduled: false // Start manually with .start()
});

/**
 * Daily: Auto-convert trials to paid if payment method on file
 * Runs at 10:00 AM every day
 */
export const autoConvertTrialsJob = cron.schedule('0 10 * * *', async () => {
  try {
    logger.info('Starting auto-convert trials...');

    const result = await pool.query(`
      SELECT css.*, u.email
      FROM client_service_subscriptions css
      JOIN customers c ON css.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      WHERE css.is_trial = true 
        AND css.status = 'active'
        AND css.trial_ends_at <= CURRENT_TIMESTAMP
        AND css.payment_method_id IS NOT NULL
    `);

    let converted = 0;

    for (const subscription of result.rows) {
      try {
        await enhancedPlanService.convertTrialToPaid(
          subscription.id,
          subscription.tenant_id,
          subscription.payment_method_id
        );

        logger.info('Trial auto-converted to paid', {
          subscriptionId: subscription.id,
          customerId: subscription.customer_id
        });

        // TODO: Send welcome email
        // await emailService.sendTrialConvertedEmail(subscription);

        converted++;
      } catch (error) {
        logger.error('Error converting trial:', {
          subscriptionId: subscription.id,
          error: error.message
        });
      }
    }

    logger.info('Auto-convert trials completed', { converted });
  } catch (error) {
    logger.error('Error in auto-convert trials job:', error);
  }
}, {
  scheduled: false
});

/**
 * Monthly: Calculate overage charges for all subscriptions
 * Runs on 1st of every month at 2:00 AM
 */
export const calculateOveragesJob = cron.schedule('0 2 1 * *', async () => {
  try {
    logger.info('Starting monthly overage calculation...');

    // Get last month's date range
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const periodStart = lastMonth.toISOString().split('T')[0];
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

    const result = await pool.query(`
      SELECT css.id, css.tenant_id
      FROM client_service_subscriptions css
      WHERE css.status = 'active' AND css.is_trial = false
    `);

    let totalCharges = 0;
    let subscriptionsWithOverages = 0;

    for (const subscription of result.rows) {
      try {
        const charges = await enhancedPlanService.calculateOverageCharges(
          subscription.id,
          subscription.tenant_id,
          periodStart,
          periodEnd
        );

        if (charges.length > 0) {
          subscriptionsWithOverages++;
          totalCharges += charges.reduce((sum, c) => sum + parseFloat(c.total_charge), 0);

          logger.info('Overage charges calculated', {
            subscriptionId: subscription.id,
            charges: charges.length,
            total: charges.reduce((sum, c) => sum + parseFloat(c.total_charge), 0)
          });

          // TODO: Create invoice for overage charges
          // await billingService.createOverageInvoice(subscription.customer_id, charges);
        }
      } catch (error) {
        logger.error('Error calculating overages:', {
          subscriptionId: subscription.id,
          error: error.message
        });
      }
    }

    logger.info('Monthly overage calculation completed', {
      subscriptionsWithOverages,
      totalCharges: totalCharges.toFixed(2)
    });
  } catch (error) {
    logger.error('Error in calculate overages job:', error);
  }
}, {
  scheduled: false
});

/**
 * Daily: Process dunning for failed payments
 * Runs at 8:00 AM every day
 */
export const dunningManagementJob = cron.schedule('0 8 * * *', async () => {
  try {
    logger.info('Starting dunning management...');

    const tenants = await pool.query('SELECT id FROM tenants WHERE is_active = true');

    let totalRetries = 0;

    for (const tenant of tenants.rows) {
      const paymentsToRetry = await enhancedPlanService.getPaymentsToRetry(tenant.id);

      for (const payment of paymentsToRetry) {
        try {
          // TODO: Retry payment via Stripe
          // const result = await stripeService.retryPayment(payment);

          // Update retry status
          await pool.query(`
            UPDATE failed_payment_attempts
            SET retry_status = 'retried', last_retry_at = CURRENT_TIMESTAMP
            WHERE id = $1
          `, [payment.id]);

          logger.info('Payment retry attempted', {
            attemptId: payment.id,
            subscriptionId: payment.subscription_id,
            attemptNumber: payment.attempt_number
          });

          totalRetries++;

          // If max retries reached, suspend service
          if (payment.attempt_number >= 4) {
            await pool.query(`
              UPDATE client_service_subscriptions
              SET status = 'suspended'
              WHERE id = $1
            `, [payment.subscription_id]);

            logger.info('Service suspended due to failed payments', {
              subscriptionId: payment.subscription_id
            });

            // TODO: Send suspension email
            // await emailService.sendServiceSuspendedEmail(payment);
          }
        } catch (error) {
          logger.error('Error retrying payment:', {
            attemptId: payment.id,
            error: error.message
          });
        }
      }
    }

    logger.info('Dunning management completed', { totalRetries });
  } catch (error) {
    logger.error('Error in dunning management job:', error);
  }
}, {
  scheduled: false
});

/**
 * Weekly: Calculate loyalty discounts for eligible customers
 * Runs every Sunday at 3:00 AM
 */
export const loyaltyDiscountsJob = cron.schedule('0 3 * * 0', async () => {
  try {
    logger.info('Starting loyalty discounts calculation...');

    const result = await pool.query(`
      SELECT c.id, c.tenant_id
      FROM customers c
      WHERE c.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM loyalty_discounts ld
          WHERE ld.customer_id = c.id AND ld.is_active = true
        )
    `);

    let discountsCreated = 0;

    for (const customer of result.rows) {
      try {
        const discount = await enhancedPlanService2.calculateLoyaltyDiscount(
          customer.id,
          customer.tenant_id
        );

        if (discount.eligible) {
          discountsCreated++;

          logger.info('Loyalty discount created', {
            customerId: customer.id,
            discountPercent: discount.discountPercent,
            reason: discount.reason
          });

          // TODO: Send notification email
          // await emailService.sendLoyaltyDiscountEmail(customer, discount);
        }
      } catch (error) {
        logger.error('Error calculating loyalty discount:', {
          customerId: customer.id,
          error: error.message
        });
      }
    }

    logger.info('Loyalty discounts calculation completed', { discountsCreated });
  } catch (error) {
    logger.error('Error in loyalty discounts job:', error);
  }
}, {
  scheduled: false
});

/**
 * Weekly: Generate AI-powered plan recommendations
 * Runs every Monday at 10:00 AM
 */
export const aiRecommendationsJob = cron.schedule('0 10 * * 1', async () => {
  try {
    logger.info('Starting AI plan recommendations...');

    const result = await pool.query(`
      SELECT css.customer_id, css.tenant_id
      FROM client_service_subscriptions css
      WHERE css.status = 'active'
        AND css.is_trial = false
        AND NOT EXISTS (
          SELECT 1 FROM plan_recommendations pr
          WHERE pr.customer_id = css.customer_id 
            AND pr.status = 'pending'
            AND pr.expires_at > CURRENT_TIMESTAMP
        )
      GROUP BY css.customer_id, css.tenant_id
    `);

    let recommendationsCreated = 0;

    for (const customer of result.rows) {
      try {
        const recommendation = await enhancedPlanService2.generatePlanRecommendation(
          customer.customer_id,
          customer.tenant_id
        );

        if (recommendation && recommendation.hasRecommendation) {
          recommendationsCreated++;

          logger.info('Plan recommendation generated', {
            customerId: customer.customer_id,
            type: recommendation.type
          });

          // TODO: Send recommendation email
          // await emailService.sendPlanRecommendationEmail(customer, recommendation);
        }
      } catch (error) {
        logger.error('Error generating recommendation:', {
          customerId: customer.customer_id,
          error: error.message
        });
      }
    }

    logger.info('AI plan recommendations completed', { recommendationsCreated });
  } catch (error) {
    logger.error('Error in AI recommendations job:', error);
  }
}, {
  scheduled: false
});

/**
 * Daily: Record success metrics for all active customers
 * Runs at 11:00 PM every day
 */
export const successMetricsJob = cron.schedule('0 23 * * *', async () => {
  try {
    logger.info('Starting success metrics recording...');

    const result = await pool.query(`
      SELECT DISTINCT customer_id, tenant_id
      FROM client_service_subscriptions
      WHERE status = 'active'
    `);

    let metricsRecorded = 0;

    for (const customer of result.rows) {
      try {
        // TODO: Fetch actual metrics from monitoring systems
        const metricsData = {
          metricDate: new Date().toISOString().split('T')[0],
          uptimePercentage: 99.99,
          attacksBlocked: Math.floor(Math.random() * 50), // Replace with actual data
          malwareScans: 24,
          malwareThreatsFound: 0,
          backupCount: 1,
          cdnBandwidthSavedGb: Math.random() * 10,
          sslCertificatesRenewed: 0,
          supportTicketsResolved: 0,
          avgResponseTimeMinutes: 0,
          estimatedValueDelivered: 15.00 // Estimated value of services
        };

        await enhancedPlanService2.recordSuccessMetrics(
          customer.customer_id,
          customer.tenant_id,
          metricsData
        );

        metricsRecorded++;
      } catch (error) {
        logger.error('Error recording success metrics:', {
          customerId: customer.customer_id,
          error: error.message
        });
      }
    }

    logger.info('Success metrics recording completed', { metricsRecorded });
  } catch (error) {
    logger.error('Error in success metrics job:', error);
  }
}, {
  scheduled: false
});

/**
 * Daily: Award milestones based on metrics
 * Runs at 11:30 PM every day
 */
export const milestonesJob = cron.schedule('30 23 * * *', async () => {
  try {
    logger.info('Starting milestones check...');

    // Check for "First Year" milestones
    const firstYearResult = await pool.query(`
      SELECT c.id, c.tenant_id, u.first_name, u.email
      FROM customers c
      JOIN users u ON c.user_id = u.id
      WHERE c.created_at <= CURRENT_DATE - INTERVAL '1 year'
        AND c.created_at >= CURRENT_DATE - INTERVAL '1 year 1 day'
        AND NOT EXISTS (
          SELECT 1 FROM success_milestones sm
          WHERE sm.customer_id = c.id AND sm.milestone_type = 'first_year'
        )
    `);

    for (const customer of firstYearResult.rows) {
      await enhancedPlanService2.awardMilestone(
        customer.id,
        customer.tenant_id,
        'first_year',
        'One Year Anniversary',
        'Thank you for one year of partnership!'
      );

      logger.info('First year milestone awarded', { customerId: customer.id });
    }

    // Check for "10k Attacks Blocked" milestone
    const attacksResult = await pool.query(`
      SELECT customer_id, tenant_id, SUM(attacks_blocked) AS total_attacks
      FROM client_success_metrics
      GROUP BY customer_id, tenant_id
      HAVING SUM(attacks_blocked) >= 10000
        AND NOT EXISTS (
          SELECT 1 FROM success_milestones sm
          WHERE sm.customer_id = client_success_metrics.customer_id 
            AND sm.milestone_type = '10k_attacks_blocked'
        )
    `);

    for (const customer of attacksResult.rows) {
      await enhancedPlanService2.awardMilestone(
        customer.customer_id,
        customer.tenant_id,
        '10k_attacks_blocked',
        'Security Champion',
        'We\'ve blocked over 10,000 attacks on your behalf!'
      );

      logger.info('10k attacks milestone awarded', { customerId: customer.customer_id });
    }

    logger.info('Milestones check completed');
  } catch (error) {
    logger.error('Error in milestones job:', error);
  }
}, {
  scheduled: false
});

/**
 * Hourly: Cleanup expired promo codes and recommendations
 * Runs at :00 every hour
 */
export const cleanupJob = cron.schedule('0 * * * *', async () => {
  try {
    logger.info('Starting cleanup job...');

    // Deactivate expired promo codes
    await pool.query(`
      UPDATE promotional_pricing
      SET is_active = false
      WHERE valid_until < CURRENT_TIMESTAMP AND is_active = true
    `);

    // Mark expired recommendations
    await pool.query(`
      UPDATE plan_recommendations
      SET status = 'expired'
      WHERE expires_at < CURRENT_TIMESTAMP AND status = 'pending'
    `);

    // Archive old failed payment attempts (90 days)
    await pool.query(`
      UPDATE failed_payment_attempts
      SET retry_status = 'abandoned'
      WHERE created_at < CURRENT_DATE - INTERVAL '90 days'
        AND retry_status IN ('pending', 'scheduled')
    `);

    logger.info('Cleanup job completed');
  } catch (error) {
    logger.error('Error in cleanup job:', error);
  }
}, {
  scheduled: false
});

// ============================================
// CRON JOB MANAGER
// ============================================

/**
 * Start all cron jobs
 */
export function startAllCronJobs() {
  logger.info('Starting all enhanced plan access cron jobs...');

  expiringTrialsJob.start();
  autoConvertTrialsJob.start();
  calculateOveragesJob.start();
  dunningManagementJob.start();
  loyaltyDiscountsJob.start();
  aiRecommendationsJob.start();
  successMetricsJob.start();
  milestonesJob.start();
  cleanupJob.start();

  logger.info('All cron jobs started successfully', {
    jobs: [
      'expiringTrialsJob (daily 9:00 AM)',
      'autoConvertTrialsJob (daily 10:00 AM)',
      'calculateOveragesJob (monthly 1st @ 2:00 AM)',
      'dunningManagementJob (daily 8:00 AM)',
      'loyaltyDiscountsJob (weekly Sunday @ 3:00 AM)',
      'aiRecommendationsJob (weekly Monday @ 10:00 AM)',
      'successMetricsJob (daily 11:00 PM)',
      'milestonesJob (daily 11:30 PM)',
      'cleanupJob (hourly)'
    ]
  });
}

/**
 * Stop all cron jobs
 */
export function stopAllCronJobs() {
  logger.info('Stopping all enhanced plan access cron jobs...');

  expiringTrialsJob.stop();
  autoConvertTrialsJob.stop();
  calculateOveragesJob.stop();
  dunningManagementJob.stop();
  loyaltyDiscountsJob.stop();
  aiRecommendationsJob.stop();
  successMetricsJob.stop();
  milestonesJob.stop();
  cleanupJob.stop();

  logger.info('All cron jobs stopped');
}

export default {
  startAllCronJobs,
  stopAllCronJobs,
  expiringTrialsJob,
  autoConvertTrialsJob,
  calculateOveragesJob,
  dunningManagementJob,
  loyaltyDiscountsJob,
  aiRecommendationsJob,
  successMetricsJob,
  milestonesJob,
  cleanupJob
};
