// src/routes/adminSubscriptions.js
// Admin API for managing subscriptions and provisioning tasks

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * GET /api/admin/subscriptions
 * Returns all subscriptions with customer and product details
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        s.id,
        s.status,
        s.billing_cycle,
        s.price,
        s.next_billing_date,
        s.auto_renew,
        s.created_at,
        s.updated_at,
        json_build_object(
          'id', c.id,
          'email', u.email,
          'fullName', CONCAT(u.first_name, ' ', u.last_name),
          'companyName', c.company_name
        ) as customer,
        json_build_object(
          'id', p.id,
          'name', p.name,
          'code', p.code,
          'type', p.type,
          'billingCycle', p.billing_cycle
        ) as product
      FROM subscriptions s
      INNER JOIN customers c ON s.customer_id = c.id
      INNER JOIN users u ON c.user_id = u.id
      INNER JOIN products p ON s.product_id = p.id
      GROUP BY s.id, c.id, u.email, u.first_name, u.last_name, c.company_name, p.id, p.name, p.code, p.type, p.billing_cycle
      ORDER BY s.created_at DESC
    `);

    res.json({ subscriptions: result.rows });
  } catch (err) {
    console.error('Error fetching subscriptions:', err);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

/**
 * GET /api/admin/subscriptions/:id
 * Get single subscription details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        s.*,
        json_build_object(
          'id', c.id,
          'email', u.email,
          'fullName', CONCAT(u.first_name, ' ', u.last_name),
          'companyName', c.company_name,
          'phone', c.phone
        ) as customer,
        json_build_object(
          'id', p.id,
          'name', p.name,
          'code', p.code,
          'type', p.type,
          'billingCycle', p.billing_cycle,
          'price', p.price
        ) as product
      FROM subscriptions s
      INNER JOIN customers c ON s.customer_id = c.id
      INNER JOIN users u ON c.user_id = u.id
      INNER JOIN products p ON s.product_id = p.id
      WHERE s.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json({ subscription: result.rows[0] });
  } catch (err) {
    console.error('Error fetching subscription:', err);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

/**
 * PATCH /api/admin/subscriptions/:id/status
 * Update subscription status
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending_payment', 'active', 'suspended', 'cancelled', 'expired'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await pool.query(`
      UPDATE subscriptions 
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [status, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json({ subscription: result.rows[0] });
  } catch (err) {
    console.error('Error updating subscription:', err);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

export default router;
