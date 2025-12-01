// src/routes/ordersPublic.js
// Public endpoint for Stripe checkout → mPanel integration

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * POST /api/public/orders/stripe-completed
 * Called from marketing site after successful Stripe payment
 * 
 * Body:
 * {
 *   customerEmail: string,
 *   customerName?: string,
 *   stripeCustomerId?: string,
 *   paymentIntentId?: string,
 *   items: [
 *     { productSlug: "starter", domain?: "example.com", notes?: "..." },
 *     ...
 *   ]
 * }
 */
router.post('/stripe-completed', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const {
      customerEmail,
      customerName,
      stripeCustomerId,
      paymentIntentId,
      items,
    } = req.body || {};

    // Validation
    if (!customerEmail || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid payload',
        details: 'customerEmail and items[] are required'
      });
    }

    await client.query('BEGIN');

    // 1) Upsert customer
    const customerResult = await client.query(`
      INSERT INTO customers (email, full_name, stripe_customer_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (email) 
      DO UPDATE SET 
        full_name = COALESCE($2, customers.full_name),
        stripe_customer_id = COALESCE($3, customers.stripe_customer_id),
        updated_at = NOW()
      RETURNING id, email, full_name
    `, [customerEmail, customerName || null, stripeCustomerId || null]);

    const customer = customerResult.rows[0];

    // 2) Get all products by slug
    const slugs = items.map(item => item.productSlug);
    const productsResult = await client.query(`
      SELECT id, slug, name 
      FROM products 
      WHERE slug = ANY($1::text[])
    `, [slugs]);

    const productsBySlug = new Map(
      productsResult.rows.map(p => [p.slug, p])
    );

    // 3) Get default server (srv1)
    const serverResult = await client.query(`
      SELECT id, name, fqdn 
      FROM servers 
      WHERE name = 'srv1' AND is_active = TRUE
      LIMIT 1
    `);

    const defaultServer = serverResult.rows[0];

    const createdSubscriptions = [];

    // 4) Create subscriptions and provisioning tasks for each item
    for (const item of items) {
      const product = productsBySlug.get(item.productSlug);
      
      if (!product) {
        console.warn(`Product not found for slug: ${item.productSlug}, skipping...`);
        continue;
      }

      // Create subscription
      const subResult = await client.query(`
        INSERT INTO subscriptions (
          customer_id, 
          product_id, 
          status, 
          stripe_payment_intent,
          domain,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, status, domain, created_at
      `, [
        customer.id,
        product.id,
        'pending_provisioning',
        paymentIntentId || null,
        item.domain || null,
        item.notes || null
      ]);

      const subscription = subResult.rows[0];

      // Create provisioning task
      const taskPayload = {
        domain: item.domain || null,
        plan: product.slug,
        server: defaultServer?.name || 'srv1',
        customerEmail: customer.email,
        customerName: customer.full_name
      };

      await client.query(`
        INSERT INTO provisioning_tasks (
          subscription_id,
          server_id,
          status,
          step,
          payload_json
        )
        VALUES ($1, $2, $3, $4, $5)
      `, [
        subscription.id,
        defaultServer?.id || null,
        'pending',
        'create_account',
        JSON.stringify(taskPayload)
      ]);

      createdSubscriptions.push({
        id: subscription.id,
        product: product.name,
        domain: subscription.domain,
        status: subscription.status
      });
    }

    await client.query('COMMIT');

    console.log(`✓ Order processed: ${customer.email} → ${createdSubscriptions.length} subscription(s)`);

    return res.json({
      ok: true,
      customerId: customer.id,
      customerEmail: customer.email,
      subscriptions: createdSubscriptions
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('stripe-completed error:', err);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: err.message 
    });
  } finally {
    client.release();
  }
});

export default router;
