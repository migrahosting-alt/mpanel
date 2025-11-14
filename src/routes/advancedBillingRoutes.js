/**
 * Advanced Billing API Routes
 */

import express from 'express';
import advancedBilling from '../services/advancedBilling.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import pool from '../db/index.js';
import logger from '../config/logger.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * Record usage for metered billing
 */
router.post('/usage', async (req, res) => {
  try {
    const { subscriptionId, metricName, quantity, timestamp } = req.body;

    const usage = await advancedBilling.recordUsage(
      subscriptionId,
      metricName,
      quantity,
      timestamp ? new Date(timestamp) : undefined
    );

    res.json({
      success: true,
      usage
    });
  } catch (error) {
    logger.error('Failed to record usage', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * Get usage summary for subscription
 */
router.get('/usage/:subscriptionId', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { periodStart, periodEnd } = req.query;

    const result = await pool.query(
      `SELECT metric_name, SUM(quantity) as total_quantity, COUNT(*) as event_count
       FROM usage_records
       WHERE subscription_id = $1 
         AND timestamp >= $2 
         AND timestamp < $3
       GROUP BY metric_name`,
      [
        subscriptionId,
        periodStart || new Date(new Date().setDate(1)), // Start of current month
        periodEnd || new Date()
      ]
    );

    res.json({
      success: true,
      usage: result.rows
    });
  } catch (error) {
    logger.error('Failed to get usage summary', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Calculate usage charges for period
 */
router.post('/usage/calculate', async (req, res) => {
  try {
    const { subscriptionId, periodStart, periodEnd } = req.body;

    const charges = await advancedBilling.calculateUsageCharges(
      subscriptionId,
      new Date(periodStart),
      new Date(periodEnd)
    );

    res.json({
      success: true,
      charges
    });
  } catch (error) {
    logger.error('Failed to calculate usage charges', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * Create payment plan for invoice
 */
router.post('/payment-plans', async (req, res) => {
  try {
    const { invoiceId, numberOfPayments, intervalDays } = req.body;

    const installments = await advancedBilling.createPaymentPlan(
      invoiceId,
      numberOfPayments,
      intervalDays
    );

    res.status(201).json({
      success: true,
      installments
    });
  } catch (error) {
    logger.error('Failed to create payment plan', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * Process payment plan installment
 */
router.post('/payment-plans/installments/:id/pay', async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethodId } = req.body;

    const result = await advancedBilling.processInstallment(id, paymentMethodId);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Failed to process installment', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * Get payment plan for invoice
 */
router.get('/payment-plans/invoice/:invoiceId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM payment_plan_installments 
       WHERE invoice_id = $1 
       ORDER BY installment_number`,
      [req.params.invoiceId]
    );

    res.json({
      success: true,
      installments: result.rows
    });
  } catch (error) {
    logger.error('Failed to get payment plan', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Calculate volume discount (Admin only)
 */
router.post('/discounts/volume', requireRole('admin'), async (req, res) => {
  try {
    const { customerId, amount } = req.body;

    const discount = await advancedBilling.applyVolumeDiscount(customerId, amount);

    res.json({
      success: true,
      discount
    });
  } catch (error) {
    logger.error('Failed to calculate volume discount', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * Generate revenue recognition schedule (Admin only)
 */
router.post('/revenue/schedule/:invoiceId', requireRole('admin'), async (req, res) => {
  try {
    const schedule = await advancedBilling.generateRevenueSchedule(req.params.invoiceId);

    res.json({
      success: true,
      schedule
    });
  } catch (error) {
    logger.error('Failed to generate revenue schedule', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * Get recognized revenue for period (Admin only)
 */
router.get('/revenue/recognized', requireRole('admin'), async (req, res) => {
  try {
    const { startMonth, endMonth } = req.query;

    const result = await pool.query(
      `SELECT recognition_month, SUM(amount) as total_revenue, COUNT(DISTINCT invoice_id) as invoice_count
       FROM recognized_revenue
       WHERE recognition_month >= $1 AND recognition_month <= $2
       GROUP BY recognition_month
       ORDER BY recognition_month`,
      [startMonth || '2024-01', endMonth || new Date().toISOString().substring(0, 7)]
    );

    res.json({
      success: true,
      revenue: result.rows
    });
  } catch (error) {
    logger.error('Failed to get recognized revenue', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Trigger dunning process (Admin only, typically run via cron)
 */
router.post('/dunning/process', requireRole('admin'), async (req, res) => {
  try {
    const results = await advancedBilling.processDunning();

    res.json({
      success: true,
      results
    });
  } catch (error) {
    logger.error('Failed to process dunning', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create quote
 */
router.post('/quotes', async (req, res) => {
  try {
    const { customerName, customerEmail, items, validDays = 30 } = req.body;

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const tax = subtotal * 0.1; // 10% tax (adjust as needed)
    const total = subtotal + tax;

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validDays);

    // Generate quote number
    const quoteNumber = `Q-${Date.now()}`;

    // Create quote
    const quoteResult = await pool.query(
      `INSERT INTO quotes (tenant_id, customer_id, quote_number, customer_name, customer_email, subtotal, tax, total, valid_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.user.tenant_id, req.user.id, quoteNumber, customerName, customerEmail, subtotal, tax, total, validUntil]
    );

    const quote = quoteResult.rows[0];

    // Create quote items
    for (const item of items) {
      await pool.query(
        `INSERT INTO quote_items (quote_id, product_id, description, quantity, unit_price, total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [quote.id, item.productId, item.description, item.quantity, item.unitPrice, item.quantity * item.unitPrice]
      );
    }

    res.status(201).json({
      success: true,
      quote
    });
  } catch (error) {
    logger.error('Failed to create quote', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * Get quote
 */
router.get('/quotes/:id', async (req, res) => {
  try {
    const quoteResult = await pool.query(
      'SELECT * FROM quotes WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.user.tenant_id]
    );

    if (quoteResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Quote not found' });
    }

    const quote = quoteResult.rows[0];

    // Get quote items
    const itemsResult = await pool.query(
      'SELECT * FROM quote_items WHERE quote_id = $1',
      [quote.id]
    );

    res.json({
      success: true,
      quote: {
        ...quote,
        items: itemsResult.rows
      }
    });
  } catch (error) {
    logger.error('Failed to get quote', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
