// src/controllers/checkoutController.js
import { stripe, STRIPE_CHECKOUT_CONFIG } from '../config/stripeConfig.js';
import db from '../db/index.js';
import logger from '../utils/logger.js';

/**
 * POST /api/checkout/create-session
 * Body: {
 *   planId,
 *   billingCycle,
 *   trialActive,
 *   addonIds,
 *   couponCode,
 *   customer: { name, email, phone, company, address1, address2, city, state, postcode, country },
 *   account: { password },
 *   domain: { mode, value },
 *   cartItems: [] // NEW: Full cart items from frontend
 * }
 */
export async function createCheckoutSession(req, res) {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const {
      planId,
      billingCycle = 'monthly',
      trialActive = false,
      addonIds = [],
      couponCode,
      customer,
      account,
      domain,
      cartItems = [], // NEW: Accept cart items from frontend
    } = req.body || {};

    if (!planId || !customer?.email) {
      return res.status(400).json({ error: 'Missing planId or customer email' });
    }

    const { email, name } = customer;

    // 1. Resolve product/price in DB
    const priceQuery = `
      SELECT p.id AS product_id, p.code, p.name, p.type,
             pr.id AS price_id, pr.unit_amount, pr.currency, pr.stripe_price_id
      FROM products p
      JOIN prices pr ON pr.product_id = p.id
      WHERE p.code = $1
        AND pr.billing_cycle = $2
        AND pr.is_active = TRUE
      LIMIT 1;
    `;
    const priceParams = [planId, billingCycle];
    const { rows: priceRows } = await db.query(priceQuery, priceParams);

    if (!priceRows.length) {
      return res
        .status(400)
        .json({ error: `No active price for plan ${planId} (${billingCycle})` });
    }

    const primary = priceRows[0];

    // Build line items array from cart items
    let lineItems = [];

    // If no Stripe price ID exists, create line item with dynamic price for main plan
    if (primary.stripe_price_id) {
      lineItems.push({
        price: primary.stripe_price_id,
        quantity: 1,
      });
    } else {
      // Create dynamic price in Stripe
      lineItems.push({
        price_data: {
          currency: primary.currency || 'usd',
          product_data: {
            name: primary.name,
            description: `${primary.type} - ${billingCycle}`,
          },
          unit_amount: primary.unit_amount,
          recurring: {
            interval: billingCycle === 'monthly' ? 'month' : 'year',
            interval_count: 
              billingCycle === 'yearly' ? 1 :
              billingCycle === 'biennial' ? 2 :
              billingCycle === 'triennial' ? 3 : 1,
          },
        },
        quantity: 1,
      });
    }

    // Process addon items from cart
    if (cartItems && Array.isArray(cartItems)) {
      for (const item of cartItems) {
        if (item.type === 'addon') {
          // Create line item for addon
          if (item.stripePriceId) {
            // Use existing Stripe price ID if available
            lineItems.push({
              price: item.stripePriceId,
              quantity: item.quantity || 1,
            });
          } else {
            // Create dynamic price for addon
            lineItems.push({
              price_data: {
                currency: item.currency || 'usd',
                product_data: {
                  name: item.name,
                  description: item.description || '',
                },
                unit_amount: item.price, // Price in cents
                recurring: {
                  interval: item.interval === 'year' ? 'year' : 'month',
                },
              },
              quantity: item.quantity || 1,
            });
          }
        }
      }
    }

    // 2. Create metadata for tracking
    const addonList = cartItems
      ? cartItems.filter(item => item.type === 'addon').map(item => item.id)
      : addonIds || [];
    
    const metadata = {
      planId,
      billingCycle,
      trialActive: String(trialActive),
      addonIds: JSON.stringify(addonList),
      domainMode: domain?.mode || 'existing',
      domainValue: domain?.value || '',
      customerEmail: email,
      customerName: name || '',
      productType: primary.type,
      couponCode: couponCode || null,
      cartItems: JSON.stringify(cartItems || []), // Store full cart for webhook processing
      accountPassword: account?.password || null, // Store password for user creation
    };

    // 3. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: lineItems,
      customer_email: email,
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: trialActive ? 14 : undefined,
        metadata,
      },
      metadata: {
        ...metadata,
        source: 'mpanel-checkout',
      },
      success_url: STRIPE_CHECKOUT_CONFIG.successUrl,
      cancel_url: STRIPE_CHECKOUT_CONFIG.cancelUrl,
    });

    // 4. Store checkout session in database
    await db.query(
      `
      INSERT INTO checkout_sessions (
        stripe_session_id,
        email,
        customer_name,
        product_code,
        billing_cycle,
        amount,
        currency,
        coupon_code,
        domain_info,
        status,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `,
      [
        session.id,
        email,
        name || null,
        planId,
        billingCycle,
        primary.unit_amount,
        primary.currency || 'usd',
        couponCode || null,
        domain ? JSON.stringify(domain) : null,
        'pending',
        JSON.stringify(metadata),
      ]
    );

    return res.json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    logger.error('createCheckoutSession error', error);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}


/**
 * GET /api/checkout/session/:sessionId
 * Used by success page to poll status.
 */
export async function getCheckoutSession(req, res) {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    const { rows } = await db.query(
      `
      SELECT id, stripe_session_id, email, customer_name, product_code, 
             billing_cycle, amount, currency, status, created_at
      FROM checkout_sessions
      WHERE stripe_session_id = $1
      LIMIT 1;
    `,
      [sessionId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Session not found' });
    }

    return res.json({
      success: true,
      session: rows[0],
    });
  } catch (error) {
    logger.error('getCheckoutSession error', error);
    return res.status(500).json({ error: 'Failed to load checkout session' });
  }
}

/**
 * POST /api/checkout/success
 * Optional: currently a no-op; webhook is the source of truth.
 */
export async function handleCheckoutSuccess(_req, res) {
  return res.json({ success: true });
}

