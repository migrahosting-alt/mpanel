// src/routes/stripeWebhookRoutes.js
/**
 * Stripe Webhook Handler
 * Mounted at: /api/webhooks/stripe
 */

import express from 'express';
import { stripe, STRIPE_WEBHOOK_SECRET } from '../config/stripeConfig.js';
import logger from '../utils/logger.js';
import db from '../db/index.js';
import { sendDepartmentEmail } from '../services/emailService.js';

const router = express.Router();

router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      logger.error('Stripe webhook: configuration missing');
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const sig = req.headers['stripe-signature'];

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        STRIPE_WEBHOOK_SECRET
      );
      logger.info('Stripe webhook received', {
        eventType: event.type,
        eventId: event.id,
      });
    } catch (err) {
      logger.error('Stripe webhook signature verification failed', err);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(event.data.object);
          break;
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await handleStripeSubscription(event.type, event.data.object);
          break;
        case 'invoice.paid':
          await handleInvoicePaid(event.data.object);
          break;
        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(event.data.object);
          break;
        default:
          logger.info(`Unhandled Stripe event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (err) {
      logger.error('Error processing Stripe webhook', err);
      res.status(500).json({ error: 'Webhook handler error' });
    }
  }
);

// ───────────── handlers ─────────────

async function handleCheckoutCompleted(session) {
  logger.info('Processing checkout.session.completed', { sessionId: session.id });

  const stripeCustomerId =
    typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id;
  const stripeSubscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

  const checkoutSessionId = session.id;

  // 1. Find the checkout session
  const checkoutQuery = `
    SELECT * FROM checkout_sessions 
    WHERE stripe_session_id = $1 
    LIMIT 1;
  `;
  const { rows: checkoutRows } = await db.query(checkoutQuery, [checkoutSessionId]);

  if (!checkoutRows.length) {
    logger.warn('No checkout_session found for checkout.session.completed', {
      sessionId: checkoutSessionId,
    });
    return;
  }

  const checkout = checkoutRows[0];
  const metadata = checkout.metadata || {};

  logger.info('Found checkout session', {
    email: checkout.email,
    productCode: checkout.product_code,
    amount: checkout.amount,
  });

  // 2. Create or find user
  const tempPassword = generateTempPassword();
  const bcrypt = await import('bcrypt');
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const userQuery = `
    INSERT INTO users (email, password_hash, first_name, last_name, role, status, email_verified)
    VALUES ($1, $2, $3, $4, 'customer', 'active', false)
    ON CONFLICT (tenant_id, email) DO UPDATE 
    SET updated_at = NOW()
    RETURNING id;
  `;
  const nameParts = (checkout.customer_name || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const { rows: userRows } = await db.query(userQuery, [
    checkout.email,
    passwordHash,
    firstName,
    lastName,
  ]);
  const userId = userRows[0].id;

  logger.info('User created/found', { userId, email: checkout.email });

  // 3. Create customer record
  const customerQuery = `
    INSERT INTO customers (user_id, phone, currency)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id) DO UPDATE 
    SET updated_at = NOW()
    RETURNING id;
  `;
  const { rows: customerRows } = await db.query(customerQuery, [
    userId,
    metadata.customerPhone || null,
    checkout.currency || 'USD',
  ]);
  const customerId = customerRows[0].id;

  logger.info('Customer created/found', { customerId });

  // 4. Get product details
  const productQuery = `
    SELECT p.*, pr.unit_amount, pr.billing_cycle
    FROM products p
    JOIN prices pr ON pr.product_id = p.id
    WHERE p.code = $1 AND pr.billing_cycle = $2
    LIMIT 1;
  `;
  const { rows: productRows } = await db.query(productQuery, [
    checkout.product_code,
    checkout.billing_cycle,
  ]);

  if (!productRows.length) {
    logger.error('Product not found', {
      code: checkout.product_code,
      billingCycle: checkout.billing_cycle,
    });
    throw new Error('Product not found');
  }

  const product = productRows[0];

  // 5. Create subscription
  const nextBillingDate = calculateNextBilling(checkout.billing_cycle);
  
  const subscriptionQuery = `
    INSERT INTO subscriptions (
      customer_id, 
      product_id, 
      status, 
      billing_cycle, 
      price,
      next_billing_date,
      auto_renew,
      metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, true, $7::jsonb)
    RETURNING id;
  `;
  const subscriptionMetadata = {
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
    checkout_session_id: checkoutSessionId,
    product_code: checkout.product_code,
    coupon_code: checkout.coupon_code,
    temp_password: tempPassword,
  };

  const { rows: subRows } = await db.query(subscriptionQuery, [
    customerId,
    product.id,
    'active',
    checkout.billing_cycle,
    (checkout.amount / 100).toFixed(2),
    nextBillingDate,
    JSON.stringify(subscriptionMetadata),
  ]);
  const subscriptionId = subRows[0].id;

  logger.info('Subscription created', { subscriptionId });

  // 6. Update checkout session status
  await db.query(
    `UPDATE checkout_sessions 
     SET status = 'completed', 
         stripe_customer_id = $1,
         completed_at = NOW(), 
         updated_at = NOW() 
     WHERE id = $2`,
    [stripeCustomerId, checkout.id]
  );

  // 7. Trigger provisioning
  logger.info('Triggering provisioning', {
    subscriptionId,
    productType: product.type,
  });

  try {
    await provisionService(subscriptionId, product, checkout, userId);
  } catch (err) {
    logger.error('Provisioning failed', {
      subscriptionId,
      error: err.message,
      stack: err.stack,
    });
  }

  // 8. Send welcome email
  try {
    const welcomeEmailData = {
      customerName: checkout.customer_name || 'Valued Customer',
      customerEmail: checkout.email,
      tempPassword,
      productName: product.name,
      loginUrl: process.env.PANEL_URL || 'https://migrapanel.com/login',
      dashboardUrl: process.env.PANEL_URL || 'https://migrapanel.com',
    };

    await sendDepartmentEmail(
      'sales',
      checkout.email,
      'Welcome to MigraHosting - Your Account is Ready!',
      'welcome',
      welcomeEmailData
    );
    
    logger.info('Welcome email sent', { email: checkout.email });
  } catch (emailError) {
    logger.error('Failed to send welcome email', {
      email: checkout.email,
      error: emailError.message,
    });
  }
}

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function calculateNextBilling(billingCycle) {
  const now = new Date();
  switch (billingCycle) {
    case 'monthly':
      return new Date(now.setMonth(now.getMonth() + 1));
    case 'yearly':
      return new Date(now.setFullYear(now.getFullYear() + 1));
    case 'biennial':
      return new Date(now.setFullYear(now.getFullYear() + 2));
    case 'triennial':
      return new Date(now.setFullYear(now.getFullYear() + 3));
    default:
      return new Date(now.setMonth(now.getMonth() + 1));
  }
}

async function provisionService(subscriptionId, product, checkout, userId) {
  logger.info('Provisioning service', {
    type: product.type,
    subscriptionId,
    userId,
  });

  const domainInfo = checkout.domain_info ? JSON.parse(checkout.domain_info) : null;
  const domain = domainInfo?.value || `user${userId}.migrahosting.com`;

  // Create website/service record based on product type
  if (product.type === 'hosting' || product.type === 'wordpress') {
    const websiteQuery = `
      INSERT INTO websites (
        customer_id,
        subscription_id,
        name,
        primary_domain,
        status,
        php_version
      )
      VALUES (
        (SELECT customer_id FROM subscriptions WHERE id = $1),
        $1,
        $2,
        $3,
        'pending',
        '8.2'
      )
      RETURNING id;
    `;
    const { rows } = await db.query(websiteQuery, [
      subscriptionId,
      `Website for ${checkout.email}`,
      domain
    ]);
    logger.info('Website created', { websiteId: rows[0].id, domain });
  } else if (product.type === 'email') {
    // Email provisioning stub
    logger.info('Email service provisioning', { domain });
  } else if (product.type === 'vps') {
    // VPS provisioning stub
    logger.info('VPS provisioning', { subscriptionId });
  }

  // More provisioning logic would go here
  logger.info('Provisioning completed', { subscriptionId });
}

async function handleStripeSubscription(eventType, subscription) {
  logger.info('Stripe subscription event', {
    eventType,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
  });

  const currentPeriodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : null;
  const trialEnd = subscription.trial_end
    ? new Date(subscription.trial_end * 1000)
    : null;

  const query = `
    UPDATE subscriptions
    SET
      status = $1,
      next_billing_date = $2,
      trial_end = $3,
      updated_at = NOW()
    WHERE stripe_subscription_id = $4;
  `;
  const params = [subscription.status, currentPeriodEnd, trialEnd, subscription.id];

  await db.query(query, params);
}

async function handleInvoicePaid(invoice) {
  logger.info('Processing invoice.paid', { invoiceId: invoice.id });

  const stripeInvoiceId = invoice.id;
  const stripeSubId =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id;

  const tenantId = invoice.metadata?.tenantId || null;
  const subscriptionId = stripeSubId
    ? await getSubscriptionIdByStripeSub(stripeSubId)
    : null;

  const upsertQuery = `
    INSERT INTO invoices (
      stripe_invoice_id, subscription_id, tenant_id, number,
      currency, amount_due, amount_paid, amount_remaining,
      status, paid_at, metadata, created_at, updated_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,NOW(),NOW())
    ON CONFLICT (stripe_invoice_id) DO UPDATE SET
      subscription_id = EXCLUDED.subscription_id,
      tenant_id = EXCLUDED.tenant_id,
      number = EXCLUDED.number,
      currency = EXCLUDED.currency,
      amount_due = EXCLUDED.amount_due,
      amount_paid = EXCLUDED.amount_paid,
      amount_remaining = EXCLUDED.amount_remaining,
      status = EXCLUDED.status,
      paid_at = EXCLUDED.paid_at,
      metadata = EXCLUDED.metadata,
      updated_at = NOW();
  `;

  const params = [
    stripeInvoiceId,
    subscriptionId,
    tenantId,
    invoice.number || stripeInvoiceId,
    invoice.currency,
    invoice.amount_due,
    invoice.amount_paid,
    invoice.amount_remaining,
    invoice.status || 'paid',
    invoice.status === 'paid' ? new Date() : null,
    JSON.stringify(invoice.metadata || {}),
  ];

  await db.query(upsertQuery, params);
}

async function handleInvoicePaymentFailed(invoice) {
  logger.warn('Invoice payment failed', { invoiceId: invoice.id });

  const stripeSubId =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id;
  if (!stripeSubId) return;

  await db.query(
    `
    UPDATE subscriptions
    SET status = 'past_due', updated_at = NOW()
    WHERE stripe_subscription_id = $1;
  `,
    [stripeSubId]
  );
}

async function getSubscriptionIdByStripeSub(stripeSubscriptionId) {
  const { rows } = await db.query(
    `SELECT id FROM subscriptions WHERE stripe_subscription_id = $1 LIMIT 1;`,
    [stripeSubscriptionId]
  );
  return rows[0]?.id || null;
}

export default router;
