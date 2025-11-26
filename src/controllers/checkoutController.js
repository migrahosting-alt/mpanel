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
    // IMPORTANT: Stripe Checkout subscription mode requires ALL line items to have the SAME billing interval
    // We'll use the primary plan's interval for all items
    let lineItems = [];
    
    // Determine primary billing interval from the main hosting plan
    const primaryInterval = billingCycle === 'monthly' ? 'month' : 'year';
    const primaryIntervalCount = 
      billingCycle === 'monthly' ? 1 :
      billingCycle === 'yearly' ? 1 :
      billingCycle === 'biennial' ? 2 :
      billingCycle === 'triennial' ? 3 : 1;

    // Process ALL cart items from frontend for complete cart visibility in Stripe
    if (cartItems && Array.isArray(cartItems) && cartItems.length > 0) {
      logger.info(`Processing ${cartItems.length} cart items for Stripe with interval: ${primaryInterval} x${primaryIntervalCount}`);
      
      for (const item of cartItems) {
        // Skip items with $0 price (Stripe doesn't allow them)
        if (item.price === 0) {
          logger.info(`Skipping $0 item: ${item.name || item.id}`);
          continue;
        }
        
        // Handle different cart item types - all forced to primary billing interval
        switch (item.type) {
          case 'hosting': {
            // Hosting plan with billing cycle
            const plan = item.plan || planId;
            const term = item.term || billingCycle;
            
            // Try to find existing Stripe price ID in database
            const hostingPriceQuery = `
              SELECT pr.stripe_price_id, pr.unit_amount, pr.currency, p.name
              FROM products p
              JOIN prices pr ON pr.product_id = p.id
              WHERE p.code = $1 AND pr.billing_cycle = $2 AND pr.is_active = TRUE
              LIMIT 1;
            `;
            const { rows: hostingPriceRows } = await db.query(hostingPriceQuery, [plan, term]);
            
            if (hostingPriceRows.length && hostingPriceRows[0].stripe_price_id) {
              lineItems.push({
                price: hostingPriceRows[0].stripe_price_id,
                quantity: item.quantity || 1,
              });
            } else {
              // Create dynamic price - use primary interval
              lineItems.push({
                price_data: {
                  currency: item.currency || 'usd',
                  product_data: {
                    name: item.name || `${plan} Hosting`,
                    description: item.description || `Billed ${billingCycle}`,
                  },
                  unit_amount: item.price || (hostingPriceRows[0]?.unit_amount || 0),
                  recurring: {
                    interval: primaryInterval,
                    interval_count: primaryIntervalCount,
                  },
                },
                quantity: item.quantity || 1,
              });
            }
            break;
          }
          
          case 'domain': {
            // Domain - prorate to match primary interval
            const domainYearlyPrice = item.price || 1299; // $12.99/year
            let proratedPrice = domainYearlyPrice;
            
            // Convert yearly domain price to match primary interval
            if (primaryInterval === 'month') {
              proratedPrice = Math.round(domainYearlyPrice / 12); // Monthly equivalent
            } else if (primaryIntervalCount > 1) {
              proratedPrice = domainYearlyPrice * primaryIntervalCount; // Multi-year
            }
            
            lineItems.push({
              price_data: {
                currency: item.currency || 'usd',
                product_data: {
                  name: item.name || `Domain: ${item.domain || 'domain'}`,
                  description: `Domain registration/transfer (billed ${billingCycle})`,
                },
                unit_amount: proratedPrice,
                recurring: {
                  interval: primaryInterval,
                  interval_count: primaryIntervalCount,
                },
              },
              quantity: 1,
            });
            break;
          }
          
          case 'email':
          case 'simple':
          default: {
            // Email and other services - adapt to primary interval
            const itemName = item.name || item.id || 'Additional Service';
            let itemPrice = item.price || 0;
            
            if (itemPrice === 0) {
              logger.info(`Skipping $0 item: ${itemName}`);
              break;
            }
            
            // If item has its own interval different from primary, prorate it
            const itemInterval = item.interval || 'month';
            if (itemInterval !== primaryInterval) {
              if (itemInterval === 'month' && primaryInterval === 'year') {
                // Monthly price → yearly: multiply by 12
                itemPrice = itemPrice * 12;
              } else if (itemInterval === 'year' && primaryInterval === 'month') {
                // Yearly price → monthly: divide by 12
                itemPrice = Math.round(itemPrice / 12);
              }
              // For multi-year intervals, multiply by interval count
              if (primaryIntervalCount > 1) {
                itemPrice = itemPrice * primaryIntervalCount;
              }
            }
            
            lineItems.push({
              price_data: {
                currency: item.currency || 'usd',
                product_data: {
                  name: itemName,
                  description: item.description || `Billed ${billingCycle}`,
                },
                unit_amount: itemPrice,
                recurring: {
                  interval: primaryInterval,
                  interval_count: primaryIntervalCount,
                },
              },
              quantity: item.quantity || 1,
            });
            break;
          }
        }
      }
      
      logger.info(`Built ${lineItems.length} Stripe line items (all using ${primaryInterval} x${primaryIntervalCount})`);
    }
    
    // Fallback: If no cart items processed, use legacy primary plan method
    if (lineItems.length === 0) {
      logger.warn('No cart items processed, falling back to legacy primary plan method');
      
      if (primary.stripe_price_id) {
        lineItems.push({
          price: primary.stripe_price_id,
          quantity: 1,
        });
      } else {
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
    }

    // 2. Create metadata for tracking and provisioning
    const addonList = cartItems
      ? cartItems.filter(item => item.type === 'addon').map(item => item.id)
      : addonIds || [];
    
    // Build cart summary for metadata
    const cartSummary = {
      totalItems: cartItems?.length || 1,
      items: cartItems?.map(item => ({
        type: item.type,
        id: item.id || item.priceId,
        name: item.name,
        quantity: item.quantity || 1,
      })) || [],
    };
    
    const metadata = {
      planId,
      billingCycle,
      trialActive: String(trialActive),
      addonIds: JSON.stringify(addonList),
      domainMode: domain?.mode || 'existing',
      domainValue: domain?.value || '',
      customerEmail: email,
      customerName: name || '',
      customerPhone: customer?.phone || '',
      productType: primary.type,
      couponCode: couponCode || null,
      cartItems: JSON.stringify(cartItems || []), // Store full cart for webhook processing
      cartSummary: JSON.stringify(cartSummary), // Human-readable cart summary
      accountPassword: account?.password || null, // Store password for user creation
      source: 'migrahosting-marketing',
      checkoutTimestamp: new Date().toISOString(),
    };

    // 3. Create Stripe Checkout Session with enhanced branding
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: lineItems,
      customer_email: email,
      client_reference_id: `${email}-${Date.now()}`, // Unique reference for tracking
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: trialActive ? 14 : undefined,
        metadata,
      },
      metadata: {
        ...metadata,
        source: 'mpanel-checkout',
      },
      custom_text: {
        submit: {
          message: 'Your hosting will be activated immediately after payment confirmation.',
        },
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

