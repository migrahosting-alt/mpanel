// src/routes/adminCustomers.js
// Admin API for managing customers

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * GET /api/admin/customers
 * Returns all customers with their subscriptions
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.id,
        u.email,
        CONCAT(u.first_name, ' ', u.last_name) as full_name,
        c.company_name,
        c.phone,
        c.country,
        c.created_at,
        c.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', s.id,
              'status', s.status,
              'billingCycle', s.billing_cycle,
              'price', s.price,
              'nextBillingDate', s.next_billing_date,
              'createdAt', s.created_at,
              'product', json_build_object(
                'id', p.id,
                'name', p.name,
                'code', p.code,
                'type', p.type
              )
            )
            ORDER BY s.created_at DESC
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'
        ) as subscriptions
      FROM customers c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN subscriptions s ON c.id = s.customer_id
      LEFT JOIN products p ON s.product_id = p.id
      GROUP BY c.id, u.email, u.first_name, u.last_name, c.company_name, c.phone, c.country, c.created_at, c.updated_at
      ORDER BY c.created_at DESC
    `);

    res.json({ customers: result.rows });
  } catch (err) {
    console.error('Error fetching customers:', err);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

/**
 * GET /api/admin/customers/:id
 * Get single customer details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        c.*,
        u.email,
        u.first_name,
        u.last_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', s.id,
              'status', s.status,
              'billingCycle', s.billing_cycle,
              'price', s.price,
              'nextBillingDate', s.next_billing_date,
              'autoRenew', s.auto_renew,
              'createdAt', s.created_at,
              'product', json_build_object(
                'id', p.id,
                'name', p.name,
                'code', p.code,
                'type', p.type,
                'billingCycle', p.billing_cycle
              )
            )
            ORDER BY s.created_at DESC
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'
        ) as subscriptions
      FROM customers c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN subscriptions s ON c.id = s.customer_id
      LEFT JOIN products p ON s.product_id = p.id
      WHERE c.id = $1
      GROUP BY c.id, u.email, u.first_name, u.last_name
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ customer: result.rows[0] });
  } catch (err) {
    console.error('Error fetching customer:', err);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

export default router;
