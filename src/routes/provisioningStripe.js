// src/routes/provisioningStripe.js
//
// Stripe webhook → mPanel provisioning integration
// Receives successful payments from marketing-api and creates orders + subscriptions

import express from 'express';
import pool from '../config/database.js';
import logger from '../config/logger.js';

const router = express.Router();

// Simple shared-secret authentication
function checkProvisioningAuth(req) {
  const tokenHeader = req.headers['x-mpanel-token'];
  const expected = process.env.MPANEL_PROVISIONING_TOKEN;

  if (!expected) {
    logger.warn('⚠️ MPANEL_PROVISIONING_TOKEN not set; refusing provisioning call for safety.');
    return false;
  }

  if (!tokenHeader || tokenHeader !== expected) {
    logger.warn('⚠️ Invalid x-mpanel-token on provisioning call.');
    return false;
  }

  return true;
}

// Map cart item to subscription fields
function mapCartItemToSubscription(item) {
  // Extract product code from various possible fields
  const productCode = item.productCode || item.slug || item.id || 'unknown-product';
  
  const productName = item.productName || item.name || 'Unnamed product';
  
  const billingCycle = item.billingCycle || item.cycle || 'one-time';
  
  // Handle price - could be in cents or dollars
  let priceCents;
  if (typeof item.priceCents === 'number') {
    priceCents = item.priceCents;
  } else if (typeof item.price === 'number') {
    priceCents = item.price;
  } else if (typeof item.amount === 'number') {
    priceCents = item.amount;
  } else {
    priceCents = 0;
  }
  
  const quantity = typeof item.quantity === 'number' ? item.quantity : 1;
  
  // Determine service type from product code or type
  let serviceType = 'hosting'; // default
  if (item.type) {
    serviceType = item.type;
  } else if (productCode.includes('email') || productCode.includes('mail')) {
    serviceType = 'email';
  } else if (productCode.includes('domain')) {
    serviceType = 'domain';
  } else if (productCode.includes('ssl')) {
    serviceType = 'ssl';
  } else if (productCode.includes('addon')) {
    serviceType = 'addon';
  }

  return {
    productCode,
    productName,
    billingCycle,
    priceCents,
    quantity,
    serviceType,
  };
}

// POST /api/provisioning/stripe
router.post('/stripe', async (req, res) => {
  const client = await pool.connect();
  
  try {
    // 1. Check authentication
    if (!checkProvisioningAuth(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = req.body;

    if (!body || !body.stripePaymentIntentId) {
      return res.status(400).json({
        error: 'Missing stripePaymentIntentId in payload.',
      });
    }

    const {
      stripePaymentIntentId,
      amount,
      currency,
      status,
      customerEmail,
      cart = [],
      rawMetadata = {},
      createdAt,
    } = body;

    logger.info(`📦 Provisioning request for PaymentIntent: ${stripePaymentIntentId}`);

    await client.query('BEGIN');

    // 2. Idempotency check - already processed?
    const existingOrder = await client.query(
      'SELECT id FROM stripe_orders WHERE stripe_payment_intent_id = $1',
      [stripePaymentIntentId]
    );

    if (existingOrder.rows.length > 0) {
      await client.query('ROLLBACK');
      logger.info(`✓ Order already exists for ${stripePaymentIntentId}, skipping duplicate.`);
      
      const subscriptions = await client.query(
        'SELECT id FROM hosting_subscriptions WHERE order_id = $1',
        [existingOrder.rows[0].id]
      );
      
      return res.json({
        ok: true,
        idempotent: true,
        orderId: existingOrder.rows[0].id,
        subscriptions: subscriptions.rows.map(s => s.id),
      });
    }

    // 3. Find or create user by email
    let userId = null;
    let customerId = null;

    if (customerEmail) {
      const normalizedEmail = customerEmail.toLowerCase().trim();
      
      // Check if user exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1',
        [normalizedEmail]
      );

      if (existingUser.rows.length > 0) {
        userId = existingUser.rows[0].id;
        logger.info(`✓ Found existing user: ${userId}`);
        
        // Get or create customer record
        const existingCustomer = await client.query(
          'SELECT id FROM customers WHERE user_id = $1 LIMIT 1',
          [userId]
        );
        
        if (existingCustomer.rows.length > 0) {
          customerId = existingCustomer.rows[0].id;
        } else {
          // Create customer record
          const newCustomer = await client.query(
            `INSERT INTO customers (user_id, currency, created_at, updated_at)
             VALUES ($1, $2, NOW(), NOW())
             RETURNING id`,
            [userId, currency || 'USD']
          );
          customerId = newCustomer.rows[0].id;
          logger.info(`✓ Created customer record: ${customerId}`);
        }
      } else {
        // Create new user (basic record - they'll set password later)
        const customerName = rawMetadata.customerName || customerEmail.split('@')[0];
        
        // For multi-tenant, you'll need to provide tenant_id
        // For now, we'll create without tenant or you can set a default
        const newUser = await client.query(
          `INSERT INTO users (email, first_name, role, status, email_verified, created_at, updated_at, password_hash)
           VALUES ($1, $2, 'customer', 'active', false, NOW(), NOW(), '')
           RETURNING id`,
          [normalizedEmail, customerName]
        );
        userId = newUser.rows[0].id;
        logger.info(`✓ Created new user: ${userId}`);
        
        // Create customer record
        const newCustomer = await client.query(
          `INSERT INTO customers (user_id, currency, created_at, updated_at)
           VALUES ($1, $2, NOW(), NOW())
           RETURNING id`,
          [userId, currency || 'USD']
        );
        customerId = newCustomer.rows[0].id;
        logger.info(`✓ Created customer record: ${customerId}`);
      }
    }

    // 4. Create stripe_orders record
    const createdAtDate = createdAt ? new Date(createdAt) : new Date();
    const paidAtDate = (status === 'paid' || status === 'succeeded') ? new Date() : null;

    const orderResult = await client.query(
      `INSERT INTO stripe_orders (
        stripe_payment_intent_id, amount, currency, status,
        customer_email, cart, raw_metadata, created_at, paid_at,
        user_id, customer_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        stripePaymentIntentId,
        amount,
        currency,
        status,
        customerEmail || null,
        JSON.stringify(cart),
        JSON.stringify(rawMetadata),
        createdAtDate,
        paidAtDate,
        userId,
        customerId,
      ]
    );

    const orderId = orderResult.rows[0].id;
    logger.info(`✓ Created stripe_order: ${orderId}`);

    // 5. Create hosting_subscription records from cart
    const subscriptionIds = [];
    
    for (const item of cart) {
      const mapped = mapCartItemToSubscription(item);
      
      const subResult = await client.query(
        `INSERT INTO hosting_subscriptions (
          order_id, product_code, product_name, billing_cycle,
          price_cents, quantity, service_type,
          status, provisioning_status,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING id`,
        [
          orderId,
          mapped.productCode,
          mapped.productName,
          mapped.billingCycle,
          mapped.priceCents,
          mapped.quantity,
          mapped.serviceType,
          'pending', // will be 'active' after provisioning
          'pending', // provisioning worker will pick this up
        ]
      );
      
      subscriptionIds.push(subResult.rows[0].id);
    }

    await client.query('COMMIT');

    logger.info(`✅ Provisioning complete: Order ${orderId} with ${subscriptionIds.length} subscription(s)`);

    return res.json({
      ok: true,
      orderId,
      subscriptionsCreated: subscriptionIds.length,
      subscriptionIds,
    });

  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('❌ Error in /api/provisioning/stripe:', err);
    return res.status(500).json({ 
      error: 'Internal provisioning error.',
      message: err.message 
    });
  } finally {
    client.release();
  }
});

export default router;
