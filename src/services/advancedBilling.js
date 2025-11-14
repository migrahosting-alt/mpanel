/**
 * Advanced Billing Service
 * Usage-based metering, tiered pricing, payment plans, dunning
 */

import pool from '../db/index.js';
import logger from '../config/logger.js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

class AdvancedBillingService {
  /**
   * Record usage for metered billing
   */
  async recordUsage(subscriptionId, metricName, quantity, timestamp = new Date()) {
    try {
      // Record usage event
      const result = await pool.query(
        `INSERT INTO usage_records (subscription_id, metric_name, quantity, timestamp)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [subscriptionId, metricName, quantity, timestamp]
      );

      // Update subscription usage cache
      await pool.query(
        `INSERT INTO subscription_usage (subscription_id, metric_name, period_start, quantity)
         VALUES ($1, $2, DATE_TRUNC('month', $3), $4)
         ON CONFLICT (subscription_id, metric_name, period_start)
         DO UPDATE SET quantity = subscription_usage.quantity + $4`,
        [subscriptionId, metricName, timestamp, quantity]
      );

      logger.info('Usage recorded', { subscriptionId, metricName, quantity });

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to record usage', { error: error.message, subscriptionId });
      throw error;
    }
  }

  /**
   * Calculate usage-based charges for billing period
   */
  async calculateUsageCharges(subscriptionId, periodStart, periodEnd) {
    try {
      // Get subscription with pricing rules
      const subResult = await pool.query(
        `SELECT s.*, p.pricing_model, p.usage_tiers 
         FROM subscriptions s
         JOIN products p ON s.product_id = p.id
         WHERE s.id = $1`,
        [subscriptionId]
      );

      const subscription = subResult.rows[0];

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Get usage for period
      const usageResult = await pool.query(
        `SELECT metric_name, SUM(quantity) as total_quantity
         FROM usage_records
         WHERE subscription_id = $1 
           AND timestamp >= $2 
           AND timestamp < $3
         GROUP BY metric_name`,
        [subscriptionId, periodStart, periodEnd]
      );

      const charges = [];

      for (const usage of usageResult.rows) {
        const charge = this.calculateTieredCharge(
          usage.metric_name,
          usage.total_quantity,
          subscription.usage_tiers
        );

        charges.push({
          metricName: usage.metric_name,
          quantity: usage.total_quantity,
          amount: charge.amount,
          breakdown: charge.breakdown
        });
      }

      const totalAmount = charges.reduce((sum, c) => sum + c.amount, 0);

      logger.info('Usage charges calculated', { subscriptionId, totalAmount, charges: charges.length });

      return {
        subscriptionId,
        periodStart,
        periodEnd,
        charges,
        totalAmount
      };
    } catch (error) {
      logger.error('Failed to calculate usage charges', { error: error.message, subscriptionId });
      throw error;
    }
  }

  /**
   * Calculate charge based on tiered pricing
   */
  calculateTieredCharge(metricName, quantity, tiers) {
    if (!tiers || !tiers[metricName]) {
      return { amount: 0, breakdown: [] };
    }

    const metricTiers = tiers[metricName].sort((a, b) => a.upTo - b.upTo);
    let remainingQty = quantity;
    let totalAmount = 0;
    const breakdown = [];

    for (const tier of metricTiers) {
      if (remainingQty <= 0) break;

      const tierQty = tier.upTo === null 
        ? remainingQty 
        : Math.min(remainingQty, tier.upTo - (tier.from || 0));

      const tierAmount = tierQty * tier.unitPrice;
      totalAmount += tierAmount;

      breakdown.push({
        from: tier.from || 0,
        upTo: tier.upTo,
        quantity: tierQty,
        unitPrice: tier.unitPrice,
        amount: tierAmount
      });

      remainingQty -= tierQty;
    }

    return { amount: totalAmount, breakdown };
  }

  /**
   * Create payment plan (installments)
   */
  async createPaymentPlan(invoiceId, numberOfPayments, intervalDays = 30) {
    try {
      // Get invoice
      const invoiceResult = await pool.query('SELECT * FROM invoices WHERE id = $1', [invoiceId]);
      const invoice = invoiceResult.rows[0];

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.status !== 'pending') {
        throw new Error('Invoice must be pending to create payment plan');
      }

      const installmentAmount = Math.ceil((invoice.total / numberOfPayments) * 100) / 100;
      const installments = [];

      for (let i = 0; i < numberOfPayments; i++) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (intervalDays * i));

        const result = await pool.query(
          `INSERT INTO payment_plan_installments 
           (invoice_id, installment_number, amount, due_date, status)
           VALUES ($1, $2, $3, $4, 'pending')
           RETURNING *`,
          [invoiceId, i + 1, i === numberOfPayments - 1 ? invoice.total - (installmentAmount * (numberOfPayments - 1)) : installmentAmount, dueDate]
        );

        installments.push(result.rows[0]);
      }

      // Update invoice with payment plan
      await pool.query(
        `UPDATE invoices 
         SET payment_plan_enabled = true, payment_plan_installments = $1
         WHERE id = $2`,
        [numberOfPayments, invoiceId]
      );

      logger.info('Payment plan created', { invoiceId, numberOfPayments, installmentAmount });

      return installments;
    } catch (error) {
      logger.error('Failed to create payment plan', { error: error.message, invoiceId });
      throw error;
    }
  }

  /**
   * Process payment plan installment
   */
  async processInstallment(installmentId, paymentMethodId) {
    try {
      const result = await pool.query(
        `SELECT i.*, inv.user_id, inv.total
         FROM payment_plan_installments i
         JOIN invoices inv ON i.invoice_id = inv.id
         WHERE i.id = $1`,
        [installmentId]
      );

      const installment = result.rows[0];

      if (!installment) {
        throw new Error('Installment not found');
      }

      if (installment.status !== 'pending') {
        throw new Error(`Installment is already ${installment.status}`);
      }

      // Process payment via Stripe
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(installment.amount * 100),
        currency: 'usd',
        payment_method: paymentMethodId,
        confirm: true,
        metadata: {
          installmentId: installment.id,
          invoiceId: installment.invoice_id
        }
      });

      if (paymentIntent.status === 'succeeded') {
        // Update installment
        await pool.query(
          `UPDATE payment_plan_installments 
           SET status = 'paid', paid_at = NOW(), stripe_payment_intent_id = $1
           WHERE id = $2`,
          [paymentIntent.id, installmentId]
        );

        // Check if all installments are paid
        const remainingResult = await pool.query(
          `SELECT COUNT(*) as count FROM payment_plan_installments 
           WHERE invoice_id = $1 AND status = 'pending'`,
          [installment.invoice_id]
        );

        if (parseInt(remainingResult.rows[0].count) === 0) {
          // Mark invoice as paid
          await pool.query(
            `UPDATE invoices SET status = 'paid', paid_at = NOW() WHERE id = $1`,
            [installment.invoice_id]
          );
        }

        logger.info('Installment processed', { installmentId, amount: installment.amount });

        return { success: true, paymentIntentId: paymentIntent.id };
      } else {
        throw new Error(`Payment failed: ${paymentIntent.status}`);
      }
    } catch (error) {
      logger.error('Failed to process installment', { error: error.message, installmentId });
      throw error;
    }
  }

  /**
   * Dunning management - retry failed payments
   */
  async processDunning() {
    try {
      // Get failed invoices that need retry
      const result = await pool.query(
        `SELECT i.*, u.email, u.stripe_customer_id
         FROM invoices i
         JOIN users u ON i.user_id = u.id
         WHERE i.status = 'failed' 
           AND i.dunning_retry_count < 3
           AND i.next_retry_at <= NOW()
         LIMIT 50`
      );

      const failedInvoices = result.rows;
      const results = [];

      for (const invoice of failedInvoices) {
        try {
          // Retry payment
          const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(invoice.total * 100),
            currency: 'usd',
            customer: invoice.stripe_customer_id,
            metadata: {
              invoiceId: invoice.id
            }
          });

          let newStatus = invoice.status;
          let nextRetryAt = null;

          if (paymentIntent.status === 'succeeded') {
            newStatus = 'paid';
          } else {
            // Schedule next retry (exponential backoff: 3 days, 7 days, 14 days)
            const retryDays = [3, 7, 14];
            const retryCount = invoice.dunning_retry_count + 1;
            
            if (retryCount < retryDays.length) {
              nextRetryAt = new Date();
              nextRetryAt.setDate(nextRetryAt.getDate() + retryDays[retryCount]);
            }
          }

          // Update invoice
          await pool.query(
            `UPDATE invoices 
             SET status = $1, 
                 dunning_retry_count = dunning_retry_count + 1,
                 next_retry_at = $2,
                 stripe_payment_intent_id = $3
             WHERE id = $4`,
            [newStatus, nextRetryAt, paymentIntent.id, invoice.id]
          );

          // Send notification email
          await this.sendDunningEmail(invoice.email, invoice, paymentIntent.status === 'succeeded');

          results.push({
            invoiceId: invoice.id,
            success: paymentIntent.status === 'succeeded',
            status: paymentIntent.status
          });

        } catch (error) {
          logger.error('Dunning retry failed for invoice', { invoiceId: invoice.id, error: error.message });
          results.push({
            invoiceId: invoice.id,
            success: false,
            error: error.message
          });
        }
      }

      logger.info('Dunning processing complete', { processed: failedInvoices.length, results });

      return results;
    } catch (error) {
      logger.error('Failed to process dunning', { error: error.message });
      throw error;
    }
  }

  /**
   * Apply volume discount based on usage or quantity
   */
  async applyVolumeDiscount(customerId, amount) {
    try {
      // Get customer's total spending this year
      const result = await pool.query(
        `SELECT SUM(total) as yearly_total
         FROM invoices
         WHERE user_id = $1 
           AND status = 'paid'
           AND created_at >= DATE_TRUNC('year', NOW())`,
        [customerId]
      );

      const yearlyTotal = parseFloat(result.rows[0]?.yearly_total || 0);
      let discountPercent = 0;

      // Volume discount tiers
      if (yearlyTotal >= 50000) {
        discountPercent = 20; // 20% for $50k+ annually
      } else if (yearlyTotal >= 20000) {
        discountPercent = 15; // 15% for $20k+ annually
      } else if (yearlyTotal >= 10000) {
        discountPercent = 10; // 10% for $10k+ annually
      } else if (yearlyTotal >= 5000) {
        discountPercent = 5; // 5% for $5k+ annually
      }

      const discountAmount = amount * (discountPercent / 100);

      return {
        originalAmount: amount,
        discountPercent,
        discountAmount,
        finalAmount: amount - discountAmount,
        yearlyTotal
      };
    } catch (error) {
      logger.error('Failed to calculate volume discount', { error: error.message, customerId });
      throw error;
    }
  }

  /**
   * Generate revenue recognition schedule (ASC 606)
   */
  async generateRevenueSchedule(invoiceId) {
    try {
      const result = await pool.query(
        `SELECT i.*, s.billing_cycle, s.next_billing_date
         FROM invoices i
         LEFT JOIN subscriptions s ON i.subscription_id = s.id
         WHERE i.id = $1`,
        [invoiceId]
      );

      const invoice = result.rows[0];

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // For subscription invoices, spread revenue across billing period
      if (invoice.billing_cycle) {
        const schedule = [];
        const months = invoice.billing_cycle === 'monthly' ? 1 : 12;
        const monthlyRevenue = invoice.total / months;

        for (let i = 0; i < months; i++) {
          const recognitionDate = new Date(invoice.created_at);
          recognitionDate.setMonth(recognitionDate.getMonth() + i);

          schedule.push({
            month: recognitionDate.toISOString().substring(0, 7),
            amount: monthlyRevenue,
            recognitionDate
          });
        }

        // Store revenue schedule
        await pool.query(
          `INSERT INTO revenue_recognition_schedules (invoice_id, schedule)
           VALUES ($1, $2)
           ON CONFLICT (invoice_id) DO UPDATE SET schedule = $2`,
          [invoiceId, JSON.stringify(schedule)]
        );

        return schedule;
      }

      // For one-time invoices, recognize immediately
      return [{
        month: invoice.created_at.toISOString().substring(0, 7),
        amount: invoice.total,
        recognitionDate: invoice.created_at
      }];
    } catch (error) {
      logger.error('Failed to generate revenue schedule', { error: error.message, invoiceId });
      throw error;
    }
  }

  /**
   * Send dunning email
   */
  async sendDunningEmail(email, invoice, success) {
    // This would integrate with email service
    logger.info('Dunning email sent', { email, invoiceId: invoice.id, success });
  }
}

export default new AdvancedBillingService();
