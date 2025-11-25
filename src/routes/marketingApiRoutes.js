/**
 * Marketing Website ↔ Control Panel Integration API
 * Bidirectional communication for automation, provisioning, reporting, and updates
 * 
 * Features:
 * - Account creation automation
 * - Service provisioning
 * - Billing and usage reports
 * - Product catalog sync
 * - Real-time status updates
 * - Plan upgrades/downgrades
 * - Webhook notifications
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import pool from '../db/index.js';
import logger from '../utils/logger.js';
import queueService from '../services/queueService.js';
import * as emailTemplates from '../services/emailTemplates.js';
import { provisionHostingForSubscription } from '../services/provisioning/hosting.js';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';
import {
  getPlanById,
  getPlanBySlug,
  getAddonById,
  getCouponByCode,
  isCouponValid,
  calculateTotals,
} from '../config/pricing-config.js';

const router = express.Router();

// API Key authentication middleware for marketing website
const authenticateMarketingApi = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  try {
    const result = await pool.query(
      `SELECT * FROM api_keys 
       WHERE key_hash = $1 AND is_active = true AND scope = 'marketing'`,
      [crypto.createHash('sha256').update(apiKey).digest('hex')]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    req.apiKey = result.rows[0];
    req.tenantId = result.rows[0].tenant_id;
    
    // Update last used timestamp
    await pool.query(
      'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
      [result.rows[0].id]
    );
    
    next();
  } catch (error) {
    logger.error('Marketing API authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Rate limiters
const marketingApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: 'Too many requests from marketing API' },
  standardHeaders: true,
  legacyHeaders: false,
});

const provisioningLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // 10 provisioning requests per minute
  message: { error: 'Provisioning rate limit exceeded' },
});

// Utility helpers
const BILLING_INTERVALS = {
  monthly: '1 month',
  quarterly: '3 months',
  semiannually: '6 months',
  annually: '1 year',
  yearly: '1 year',
};

const getBillingInterval = (cycle = 'monthly') =>
  BILLING_INTERVALS[cycle] || BILLING_INTERVALS.monthly;

const calculateCyclePrice = (product, billingCycle = 'monthly') => {
  const metadataPricing = product?.metadata?.pricing;
  if (metadataPricing && metadataPricing[billingCycle]) {
    return Number(metadataPricing[billingCycle]);
  }
  if (metadataPricing && metadataPricing.default) {
    return Number(metadataPricing.default);
  }
  return Number(product.price);
};

const parseDomain = (domain) => {
  if (!domain) return { domainName: null, tld: null };
  const normalized = domain.trim().toLowerCase();
  const parts = normalized.split('.');
  const tld = parts.length > 1 ? parts.slice(-1).join('.') : parts[0];
  return { domainName: normalized, tld };
};

// ===========================================
// ACCOUNT CREATION & AUTOMATION
// ===========================================

/**
 * POST /api/marketing/validate-coupon
 * Validate a promo/coupon code and return discount information
 * @access Marketing API (authenticated via API key)
 */
router.post(
  '/validate-coupon',
  marketingApiLimiter,
  authenticateMarketingApi,
  async (req, res) => {
    try {
      const { code, planId } = req.body;

      if (!code) {
        return res.status(400).json({ error: 'Coupon code is required' });
      }

      // Get coupon from pricing-config.js
      const coupon = getCouponByCode(code);

      if (!coupon) {
        return res.status(404).json({ 
          error: 'Invalid coupon code',
          valid: false 
        });
      }

      // Check if coupon is expired
      if (!isCouponValid(coupon)) {
        return res.status(404).json({ 
          error: 'Coupon has expired',
          valid: false 
        });
      }

      // Calculate discount preview if planId provided
      let discountPreview = null;
      if (planId) {
        const plan = getPlanById(planId);

        if (plan) {
          const { subtotal, discount, total } = calculateTotals({
            plan,
            addons: [],
            billingCycle: 'monthly',
            trialActive: false,
            coupon
          });

          discountPreview = {
            basePrice: subtotal,
            discountAmount: discount,
            finalPrice: total
          };
        }
      }

      logger.info('Coupon validated successfully', { code: coupon.code });

      res.json({
        success: true,
        valid: true,
        coupon: {
          code: coupon.code,
          type: coupon.type,
          value: coupon.value,
          description: coupon.type === 'percent' 
            ? `${coupon.value}% off` 
            : coupon.type === 'flat'
            ? `$${coupon.value} off`
            : 'Free first month',
          appliesToProducts: coupon.appliesToProducts,
          minSubtotal: coupon.minSubtotal,
          firstInvoiceOnly: coupon.firstInvoiceOnly,
          expiresAt: coupon.expiresAt
        },
        discountPreview
      });
    } catch (error) {
      logger.error('Coupon validation error:', error);
      res.status(500).json({ error: 'Failed to validate coupon' });
    }
  }
);

/**
 * GET /api/marketing/checkout-session
 * Get checkout session status for success page polling
 * @access Marketing API Key
 */
router.get(
  '/checkout-session',
  marketingApiLimiter,
  authenticateMarketingApi,
  async (req, res) => {
    try {
      const { session_id } = req.query;

      if (!session_id) {
        return res.status(400).json({ error: 'session_id is required' });
      }

      // Find subscription by Stripe session ID or internal session ID
      const result = await pool.query(
        `SELECT 
          s.id as subscription_id,
          s.status as subscription_status,
          s.price,
          s.billing_cycle,
          s.metadata,
          s.next_billing_date,
          c.id as customer_id,
          u.id as user_id,
          u.email,
          u.first_name,
          u.last_name,
          p.name as plan_name,
          p.metadata as plan_metadata,
          d.domain_name,
          d.status as domain_status
         FROM subscriptions s
         JOIN customers c ON s.customer_id = c.id
         JOIN users u ON c.user_id = u.id
         JOIN products p ON s.product_id = p.id
         LEFT JOIN domains d ON d.id::text = s.metadata->>'domainId'
         WHERE s.tenant_id = $1 
         AND (s.metadata->>'checkoutSessionId' = $2 OR s.metadata->>'stripeSessionId' = $2)
         LIMIT 1`,
        [req.tenantId, session_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Session not found',
          sessionId: session_id 
        });
      }

      const data = result.rows[0];
      
      // Determine overall status
      let status = 'pending';
      if (data.subscription_status === 'active') {
        status = 'paid';
      } else if (data.subscription_status === 'cancelled' || data.subscription_status === 'failed') {
        status = 'failed';
      }

      // Get panel URL
      const panelUrl = process.env.FRONTEND_URL || 'https://mpanel.migrahosting.com';

      res.json({
        success: true,
        data: {
          sessionId: session_id,
          status,
          subscription: {
            id: data.subscription_id,
            plan: data.plan_name,
            status: data.subscription_status,
            price: parseFloat(data.price),
            billingCycle: data.billing_cycle,
            nextBillingDate: data.next_billing_date,
            domain: data.domain_name,
            domainStatus: data.domain_status,
          },
          customer: {
            id: data.customer_id,
            email: data.email,
            name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
          },
          portal: {
            url: panelUrl,
            username: data.email,
          },
          metadata: data.metadata || {}
        }
      });
    } catch (error) {
      logger.error('Checkout session status error:', error);
      res.status(500).json({ error: 'Failed to retrieve session status' });
    }
  }
);

/**
 * POST /api/marketing/checkout-intent
 * Create subscription + Stripe checkout session placeholder
 * @access Marketing API Key
 */
router.post(
  '/checkout-intent',
  marketingApiLimiter,
  authenticateMarketingApi,
  async (req, res) => {
    const client = await pool.connect();
    let transactionStarted = false;

    try {
      const {
        planId,
        billingCycle = 'monthly',
        trialActive = false,
        addonIds = [],
        couponCode,
        customer,
        domain,
        account,
      } = req.body;

      // Validation
      if (!planId || !customer?.email || !account?.password) {
        logger.warn('Checkout validation failed', {
          planId: !!planId,
          customerEmail: !!customer?.email,
          accountPassword: !!account?.password
        });
        return res.status(400).json({
          error: 'Missing required fields',
          details: {
            planId: !planId ? 'Plan selection is required' : undefined,
            email: !customer?.email ? 'Email is required' : undefined,
            password: !account?.password ? 'Password is required' : undefined
          }
        });
      }

      // Get plan from pricing-config.js
      const plan = getPlanById(planId);
      if (!plan) {
        logger.error('Plan not found in pricing config', { planId });
        return res.status(404).json({ 
          error: 'Plan not found',
          details: `Plan '${planId}' does not exist in pricing configuration`
        });
      }

      // Get addons from pricing-config.js
      const selectedAddons = addonIds
        .map(addonId => getAddonById(addonId))
        .filter(addon => addon !== undefined);

      // Validate addons apply to this product type
      const invalidAddons = selectedAddons.filter(
        addon => !addon.appliesTo.includes(plan.productType)
      );
      if (invalidAddons.length > 0) {
        return res.status(400).json({
          error: 'Invalid addons for this plan',
          details: `Addons ${invalidAddons.map(a => a.id).join(', ')} do not apply to ${plan.productType} plans`
        });
      }

      // Get coupon from pricing-config.js if provided
      let coupon = null;
      if (couponCode) {
        coupon = getCouponByCode(couponCode);
        if (!coupon || !isCouponValid(coupon)) {
          return res.status(400).json({
            error: 'Invalid or expired coupon code',
            code: couponCode
          });
        }
      }

      // Calculate totals using pricing-config.js
      const { subtotal, discount, total } = calculateTotals({
        plan,
        addons: selectedAddons,
        billingCycle,
        trialActive,
        coupon
      });

      logger.info('Checkout calculation', {
        planId: plan.id,
        addonIds,
        couponCode,
        subtotal,
        discount,
        total,
        trialActive
      });

      const tenantId = req.tenantId;

      // Hash password
      const bcrypt = (await import('bcrypt')).default;
      const passwordHash = await bcrypt.hash(account.password, 10);

      // Parse domain
      const domainMode = domain?.mode || 'subdomain';
      const domainValue = domain?.value || `${customer.email.split('@')[0]}-${Date.now()}.migrahosting.com`;
      const { domainName, tld } = parseDomain(domainValue);

      if (!domainName || !tld) {
        return res.status(400).json({ error: 'Invalid domain format' });
      }

      await client.query('BEGIN');
      transactionStarted = true;

      // Upsert user for panel access
      const userResult = await client.query(
        `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role, status)
         VALUES ($1, $2, $3, $4, $5, 'customer', 'active')
         ON CONFLICT (tenant_id, email) DO UPDATE SET
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           password_hash = EXCLUDED.password_hash,
           status = 'active',
           updated_at = NOW()
         RETURNING id`,
        [
          tenantId, 
          customer.email.toLowerCase(), 
          passwordHash, 
          customer.firstName || null, 
          customer.lastName || null
        ]
      );

      const userId = userResult.rows[0].id;

      // Fetch or create customer profile
      const existingCustomer = await client.query(
        `SELECT id FROM customers WHERE tenant_id = $1 AND user_id = $2 LIMIT 1`,
        [tenantId, userId]
      );

      let customerId = existingCustomer.rows[0]?.id;

      if (!customerId) {
        const customerInsert = await client.query(
          `INSERT INTO customers (tenant_id, user_id, currency)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [tenantId, userId, 'USD']
        );
        customerId = customerInsert.rows[0].id;
      }

      // Find or create product in database matching pricing-config plan
      let productResult = await client.query(
        `SELECT id FROM products 
         WHERE tenant_id = $1 
         AND (metadata->>'pricingConfigId' = $2 OR LOWER(name) = LOWER($3))
         LIMIT 1`,
        [tenantId, plan.id, plan.name]
      );

      let productId;
      if (productResult.rows.length === 0) {
        // Create product in database from pricing-config
        const productInsert = await client.query(
          `INSERT INTO products (tenant_id, name, description, type, price, currency, is_active, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, true, $7::jsonb)
           RETURNING id`,
          [
            tenantId,
            plan.name,
            plan.description,
            plan.productType,
            plan.basePrice.monthly,
            'USD',
            JSON.stringify({ pricingConfigId: plan.id, slug: plan.slug })
          ]
        );
        productId = productInsert.rows[0].id;
      } else {
        productId = productResult.rows[0].id;
      }

      // Create subscription
      const checkoutSessionId = `sess_${crypto.randomBytes(12).toString('hex')}`;
      const subscriptionMetadata = {
        planId: plan.id,
        planSlug: plan.slug,
        checkoutSessionId,
        domainMode,
        trialActive,
        addonIds,
        couponCode: coupon?.code || null,
        discount,
        subtotal,
        originalPrice: subtotal,
      };

      const subscriptionStatus = total > 0 ? 'pending_payment' : 'active';

      // Calculate next billing date
      const nextBillingDate = new Date();
      const nextDueDate = new Date();
      
      if (trialActive && plan.trialEnabled) {
        // Trial period: next billing is after trial days
        nextBillingDate.setDate(nextBillingDate.getDate() + plan.trialDays);
        nextDueDate.setDate(nextDueDate.getDate() + plan.trialDays);
      } else {
        // Regular billing
        if (billingCycle === 'yearly') {
          nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
          nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
        } else {
          nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
          nextDueDate.setMonth(nextDueDate.getMonth() + 1);
        }
      }

      const subscriptionResult = await client.query(
        `INSERT INTO subscriptions (
            tenant_id, customer_id, product_id, status,
            billing_cycle, price, next_billing_date, next_due_date, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
         RETURNING id`,
        [
          tenantId,
          customerId,
          productId,
          subscriptionStatus,
          billingCycle,
          total,
          nextBillingDate,
          nextDueDate,
          JSON.stringify(subscriptionMetadata),
        ]
      );

      const subscriptionId = subscriptionResult.rows[0].id;

      // Create domain record
      const domainMetadata = {
        domainMode,
        requestedAt: new Date().toISOString(),
      };

      const domainResult = await client.query(
        `INSERT INTO domains (
            tenant_id, customer_id, subscription_id, domain_name, tld,
            status, metadata
         )
         VALUES ($1, $2, $3, $4, $5, 'pending', $6::jsonb)
         RETURNING id`,
        [tenantId, customerId, subscriptionId, domainName, tld, JSON.stringify(domainMetadata)]
      );

      const domainId = domainResult.rows[0].id;

      // Update subscription with domain ID
      await client.query(
        `UPDATE subscriptions 
         SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('domainId', $1::text)
         WHERE id = $2`,
        [domainId, subscriptionId]
      );

      await client.query('COMMIT');
      transactionStarted = false;

      const paymentRequired = total > 0;

      logger.info('Subscription created', {
        subscriptionId,
        paymentRequired,
        total,
        trialActive,
        planId: plan.id
      });

      let checkoutUrl;
      let stripeSessionId = null;
      
      if (paymentRequired) {
        // Create Stripe Checkout Session
        const stripe = (await import('stripe')).default;
        const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

        const lineItems = [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: plan.name,
                description: `${billingCycle} billing`,
              },
              unit_amount: Math.round(plan.basePrice[billingCycle] * 100),
            },
            quantity: 1,
          },
        ];

        // Add addons as line items
        selectedAddons.forEach(addon => {
          lineItems.push({
            price_data: {
              currency: 'usd',
              product_data: {
                name: addon.name,
                description: addon.description,
              },
              unit_amount: Math.round(addon.price[billingCycle] * 100),
            },
            quantity: 1,
          });
        });

        const sessionConfig = {
          mode: 'payment',
          payment_method_types: ['card'],
          customer_email: customer.email,
          line_items: lineItems,
          metadata: {
            subscriptionId: subscriptionId.toString(),
            customerId: customerId.toString(),
            domainId: domainId.toString(),
            planId: plan.id,
            billingCycle,
            tenantId: tenantId.toString(),
          },
          success_url: `https://migrahosting.com/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `https://migrahosting.com/checkout/cancel`,
        };

        // Apply discount if coupon exists
        if (coupon && discount > 0) {
          sessionConfig.discounts = [{
            coupon: await stripeClient.coupons.create({
              amount_off: Math.round(discount * 100),
              currency: 'usd',
              duration: 'once',
              name: coupon.code,
            }).then(c => c.id)
          }];
        }

        const session = await stripeClient.checkout.sessions.create(sessionConfig);
        checkoutUrl = session.url;
        stripeSessionId = session.id;

        // Update subscription with Stripe session ID
        await pool.query(
          `UPDATE subscriptions 
           SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('stripeSessionId', $1::text)
           WHERE id = $2`,
          [session.id, subscriptionId]
        );

        logger.info('Stripe session created', {
          sessionId: session.id,
          checkoutUrl: session.url,
          subscriptionId
        });
      } else {
        // Free/trial - go directly to success page
        checkoutUrl = `https://migrahosting.com/checkout/success?session_id=${checkoutSessionId}`;
        
        // Auto-activate subscription
        await pool.query(
          `UPDATE subscriptions SET status = 'active' WHERE id = $1`,
          [subscriptionId]
        );

        logger.info('Free/trial subscription activated', {
          subscriptionId,
          trialActive,
          checkoutSessionId
        });
      }

      res.status(201).json({
        success: true,
        data: {
          checkoutUrl,
          subscriptionId,
          customerId,
          domainId,
          status: paymentRequired ? 'pending_payment' : 'active',
          paymentRequired,
          price: total,
          originalPrice: subtotal,
          discount: discount > 0 ? {
            amount: discount,
            code: coupon?.code,
            finalPrice: total
          } : null,
          sessionId: stripeSessionId || checkoutSessionId,
        },
      });
    } catch (error) {
      if (transactionStarted) {
        await client.query('ROLLBACK');
      }
      logger.error('Checkout intent creation failed', { 
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({ 
        error: 'Failed to create checkout intent',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    } finally {
      client.release();
    }
  }
);

/**
 * POST /api/marketing/accounts/create
 * Automatically create customer account from marketing website signup
 * @access Marketing API Key
 */
router.post('/accounts/create', authenticateMarketingApi, provisioningLimiter, async (req, res) => {
  try {
    const {
      email,
      firstName,
      lastName,
      company,
      phone,
      address,
      city,
      state,
      zip,
      country,
      planId,
      billingCycle = 'monthly',
      promoCode,
      marketingSource,
      utmParams
    } = req.body;
    
    // Validation
    if (!email || !firstName || !lastName) {
      return res.status(400).json({ error: 'Email, first name, and last name are required' });
    }
    
    // Check if customer already exists
    const existing = await pool.query(
      'SELECT id FROM customers WHERE email = $1 AND tenant_id = $2',
      [email, req.tenantId]
    );
    
    if (existing.rows.length > 0) {
      return res.status(409).json({ 
        error: 'Customer already exists',
        customerId: existing.rows[0].id
      });
    }
    
    // Generate secure password
    const tempPassword = crypto.randomBytes(16).toString('hex');
    const bcrypt = (await import('bcrypt')).default;
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    
    // Create customer account
    const customerResult = await pool.query(
      `INSERT INTO customers 
       (tenant_id, email, first_name, last_name, company, phone, address, city, state, zip, country, 
        marketing_source, utm_campaign, utm_source, utm_medium, password_hash, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'active')
       RETURNING id`,
      [
        req.tenantId, email, firstName, lastName, company, phone, address, city, state, zip, country,
        marketingSource, utmParams?.campaign, utmParams?.source, utmParams?.medium, passwordHash
      ]
    );
    
    const customerId = customerResult.rows[0].id;
    
    // Apply promo code if provided
    let discountAmount = 0;
    if (promoCode) {
      const promoResult = await pool.query(
        `SELECT * FROM promo_codes 
         WHERE code = $1 AND tenant_id = $2 AND is_active = true 
         AND (expires_at IS NULL OR expires_at > NOW())`,
        [promoCode, req.tenantId]
      );
      
      if (promoResult.rows.length > 0) {
        const promo = promoResult.rows[0];
        discountAmount = promo.discount_amount;
        
        // Track promo code usage
        await pool.query(
          `INSERT INTO promo_code_usage (promo_code_id, customer_id, tenant_id)
           VALUES ($1, $2, $3)`,
          [promo.id, customerId, req.tenantId]
        );
      }
    }
    
    // Create service if planId provided
    let serviceId = null;
    if (planId) {
      const planResult = await pool.query(
        'SELECT * FROM hosting_plans WHERE id = $1 AND tenant_id = $2',
        [planId, req.tenantId]
      );
      
      if (planResult.rows.length > 0) {
        const plan = planResult.rows[0];
        const price = plan.pricing?.[billingCycle] || plan.price;
        
        const serviceResult = await pool.query(
          `INSERT INTO services 
           (tenant_id, customer_id, product_id, name, billing_cycle, price, next_due_date, status)
           VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '1 month', 'pending')
           RETURNING id`,
          [req.tenantId, customerId, planId, plan.name, billingCycle, price - discountAmount]
        );
        
        serviceId = serviceResult.rows[0].id;
      }
    }
    
    // Send welcome email with password setup link
    const resetToken = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO password_reset_tokens (customer_id, token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '24 hours')`,
      [customerId, resetToken]
    );
    
    await queueService.addEmailJob({
      from: process.env.EMAIL_INFO,
      to: email,
      subject: 'Welcome to MigraHosting - Set Your Password',
      htmlTemplate: 'accountCreated',
      templateData: {
        customerName: `${firstName} ${lastName}`,
        email,
        resetLink: `${process.env.FRONTEND_URL}/set-password?token=${resetToken}`,
        planName: planId ? 'Hosting Plan' : null,
        tempPassword: null // Don't send temp password, force password reset
      },
      department: 'info',
      priority: 2,
    });
    
    logger.info('Customer account created via marketing API', { 
      customerId, 
      email, 
      marketingSource 
    });
    
    res.status(201).json({
      success: true,
      data: {
        customerId,
        serviceId,
        email,
        status: 'active',
        resetToken, // For immediate redirect to password setup
        message: 'Account created successfully. Welcome email sent.'
      }
    });
  } catch (error) {
    logger.error('Marketing API account creation error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

/**
 * POST /api/marketing/services/provision
 * Provision a new service for existing customer
 * @access Marketing API Key
 */
router.post('/services/provision', authenticateMarketingApi, provisioningLimiter, async (req, res) => {
  try {
    const {
      customerId,
      customerEmail,
      planId,
      billingCycle = 'monthly',
      domain,
      autoSetup = true
    } = req.body;
    
    // Find customer
    let customer;
    if (customerId) {
      const result = await pool.query(
        'SELECT * FROM customers WHERE id = $1 AND tenant_id = $2',
        [customerId, req.tenantId]
      );
      customer = result.rows[0];
    } else if (customerEmail) {
      const result = await pool.query(
        'SELECT * FROM customers WHERE email = $1 AND tenant_id = $2',
        [customerEmail, req.tenantId]
      );
      customer = result.rows[0];
    }
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Get plan details
    const planResult = await pool.query(
      'SELECT * FROM hosting_plans WHERE id = $1 AND tenant_id = $2',
      [planId, req.tenantId]
    );
    
    if (planResult.rows.length === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    const plan = planResult.rows[0];
    const price = plan.pricing?.[billingCycle] || plan.price;
    
    // Create service
    const serviceResult = await pool.query(
      `INSERT INTO services 
       (tenant_id, customer_id, product_id, name, billing_cycle, price, next_due_date, status, domain)
       VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '1 month', $7, $8)
       RETURNING id`,
      [
        req.tenantId, 
        customer.id, 
        planId, 
        plan.name, 
        billingCycle, 
        price,
        autoSetup ? 'active' : 'pending',
        domain
      ]
    );
    
    const serviceId = serviceResult.rows[0].id;
    
    // Auto-provision if requested
    if (autoSetup) {
      // Queue provisioning job
      await pool.query(
        `INSERT INTO provisioning_queue (service_id, customer_id, tenant_id, status)
         VALUES ($1, $2, $3, 'pending')`,
        [serviceId, customer.id, req.tenantId]
      );
    }
    
    // Create invoice
    const invoiceResult = await pool.query(
      `INSERT INTO invoices 
       (tenant_id, customer_id, amount, due_date, status)
       VALUES ($1, $2, $3, NOW() + INTERVAL '7 days', 'unpaid')
       RETURNING id`,
      [req.tenantId, customer.id, price]
    );
    
    const invoiceId = invoiceResult.rows[0].id;
    
    // Add invoice line item
    await pool.query(
      `INSERT INTO invoice_line_items 
       (invoice_id, service_id, description, amount)
       VALUES ($1, $2, $3, $4)`,
      [invoiceId, serviceId, `${plan.name} - ${billingCycle}`, price]
    );
    
    logger.info('Service provisioned via marketing API', { 
      serviceId, 
      customerId: customer.id, 
      planId 
    });
    
    res.status(201).json({
      success: true,
      data: {
        serviceId,
        invoiceId,
        customerId: customer.id,
        status: autoSetup ? 'active' : 'pending',
        price,
        billingCycle,
        nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });
  } catch (error) {
    logger.error('Marketing API service provisioning error:', error);
    res.status(500).json({ error: 'Failed to provision service' });
  }
});

// ===========================================
// REPORTS & ANALYTICS
// ===========================================

/**
 * GET /api/marketing/reports/revenue
 * Get revenue metrics for marketing dashboards
 * @access Marketing API Key
 */
router.get('/reports/revenue', authenticateMarketingApi, async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    
    const revenueData = await pool.query(
      `SELECT 
         DATE_TRUNC($1, created_at) as period,
         COUNT(*) as invoice_count,
         SUM(amount) as total_revenue,
         SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid_revenue,
         AVG(amount) as avg_invoice_amount
       FROM invoices
       WHERE tenant_id = $2
       ${startDate ? 'AND created_at >= $3' : ''}
       ${endDate ? 'AND created_at <= $4' : ''}
       GROUP BY period
       ORDER BY period DESC`,
      [groupBy, req.tenantId, startDate, endDate].filter(Boolean)
    );
    
    res.json({
      success: true,
      data: revenueData.rows
    });
  } catch (error) {
    logger.error('Marketing API revenue report error:', error);
    res.status(500).json({ error: 'Failed to generate revenue report' });
  }
});

/**
 * GET /api/marketing/reports/customers
 * Get customer acquisition metrics
 * @access Marketing API Key
 */
router.get('/reports/customers', authenticateMarketingApi, async (req, res) => {
  try {
    const { startDate, endDate, source } = req.query;
    
    const customerData = await pool.query(
      `SELECT 
         DATE_TRUNC('day', created_at) as signup_date,
         marketing_source,
         utm_source,
         utm_campaign,
         COUNT(*) as customer_count,
         COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
         AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400) as avg_age_days
       FROM customers
       WHERE tenant_id = $1
       ${startDate ? 'AND created_at >= $2' : ''}
       ${endDate ? 'AND created_at <= $3' : ''}
       ${source ? 'AND marketing_source = $4' : ''}
       GROUP BY signup_date, marketing_source, utm_source, utm_campaign
       ORDER BY signup_date DESC`,
      [req.tenantId, startDate, endDate, source].filter(Boolean)
    );
    
    res.json({
      success: true,
      data: customerData.rows
    });
  } catch (error) {
    logger.error('Marketing API customer report error:', error);
    res.status(500).json({ error: 'Failed to generate customer report' });
  }
});

/**
 * GET /api/marketing/reports/usage
 * Get resource usage statistics
 * @access Marketing API Key
 */
router.get('/reports/usage', authenticateMarketingApi, async (req, res) => {
  try {
    const usageData = await pool.query(
      `SELECT 
         COUNT(*) as total_services,
         COUNT(CASE WHEN status = 'active' THEN 1 END) as active_services,
         COUNT(CASE WHEN status = 'suspended' THEN 1 END) as suspended_services,
         SUM(disk_used::bigint) as total_disk_used,
         SUM(bandwidth_used::bigint) as total_bandwidth_used,
         AVG(uptime_percentage) as avg_uptime
       FROM services
       WHERE tenant_id = $1`,
      [req.tenantId]
    );
    
    res.json({
      success: true,
      data: usageData.rows[0]
    });
  } catch (error) {
    logger.error('Marketing API usage report error:', error);
    res.status(500).json({ error: 'Failed to generate usage report' });
  }
});

// ===========================================
// PRODUCT CATALOG SYNC
// ===========================================

/**
 * GET /api/marketing/products/catalog
 * Get full product catalog for marketing website
 * @access Marketing API Key
 */
router.get('/products/catalog', authenticateMarketingApi, async (req, res) => {
  try {
    const { category, active = true } = req.query;
    
    const products = await pool.query(
      `SELECT 
         id, name, type, description, features, pricing, 
         stock_quantity, is_active, display_order, created_at, updated_at
       FROM hosting_plans
       WHERE tenant_id = $1
       ${active ? 'AND is_active = true' : ''}
       ${category ? 'AND type = $2' : ''}
       ORDER BY display_order ASC, name ASC`,
      category ? [req.tenantId, category] : [req.tenantId]
    );
    
    res.json({
      success: true,
      data: products.rows,
      count: products.rows.length
    });
  } catch (error) {
    logger.error('Marketing API product catalog error:', error);
    res.status(500).json({ error: 'Failed to fetch product catalog' });
  }
});

/**
 * GET /api/marketing/products/:id/availability
 * Check product availability
 * @access Marketing API Key
 */
router.get('/products/:id/availability', authenticateMarketingApi, async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await pool.query(
      `SELECT 
         id, name, stock_quantity, is_active,
         (SELECT COUNT(*) FROM services WHERE product_id = $1 AND status = 'active') as active_services
       FROM hosting_plans
       WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenantId]
    );
    
    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const availability = {
      available: product.rows[0].is_active && product.rows[0].stock_quantity > 0,
      stockRemaining: product.rows[0].stock_quantity,
      activeServices: product.rows[0].active_services
    };
    
    res.json({
      success: true,
      data: availability
    });
  } catch (error) {
    logger.error('Marketing API product availability error:', error);
    res.status(500).json({ error: 'Failed to check product availability' });
  }
});

// ===========================================
// REAL-TIME STATUS & UPDATES
// ===========================================

/**
 * GET /api/marketing/status/system
 * Get system status for marketing website status page
 * @access Marketing API Key
 */
router.get('/status/system', authenticateMarketingApi, async (req, res) => {
  try {
    // Get server status
    const serverStatus = await pool.query(
      `SELECT 
         COUNT(*) as total_servers,
         COUNT(CASE WHEN status = 'online' THEN 1 END) as online_servers,
         AVG(cpu_usage) as avg_cpu,
         AVG(memory_usage) as avg_memory,
         AVG(uptime_percentage) as avg_uptime
       FROM servers
       WHERE tenant_id = $1`,
      [req.tenantId]
    );
    
    // Get recent incidents
    const incidents = await pool.query(
      `SELECT id, title, severity, status, created_at, resolved_at
       FROM incidents
       WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '7 days'
       ORDER BY created_at DESC
       LIMIT 10`,
      [req.tenantId]
    );
    
    res.json({
      success: true,
      data: {
        status: serverStatus.rows[0].online_servers === serverStatus.rows[0].total_servers ? 'operational' : 'degraded',
        servers: serverStatus.rows[0],
        recentIncidents: incidents.rows,
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    logger.error('Marketing API system status error:', error);
    res.status(500).json({ error: 'Failed to get system status' });
  }
});

/**
 * POST /api/marketing/webhooks/register
 * Register webhook for real-time updates
 * @access Marketing API Key
 */
router.post('/webhooks/register', authenticateMarketingApi, async (req, res) => {
  try {
    const { url, events, secret } = req.body;
    
    if (!url || !events || !Array.isArray(events)) {
      return res.status(400).json({ error: 'URL and events array required' });
    }
    
    const webhookSecret = secret || crypto.randomBytes(32).toString('hex');
    
    const result = await pool.query(
      `INSERT INTO marketing_webhooks 
       (tenant_id, api_key_id, url, events, secret, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, secret`,
      [req.tenantId, req.apiKey.id, url, JSON.stringify(events), webhookSecret]
    );
    
    res.status(201).json({
      success: true,
      data: {
        webhookId: result.rows[0].id,
        secret: result.rows[0].secret,
        message: 'Webhook registered successfully'
      }
    });
  } catch (error) {
    logger.error('Marketing API webhook registration error:', error);
    res.status(500).json({ error: 'Failed to register webhook' });
  }
});

/**
 * GET /api/marketing/customers/:id/services
 * Get all services for a customer
 * @access Marketing API Key
 */
router.get('/customers/:id/services', authenticateMarketingApi, async (req, res) => {
  try {
    const { id } = req.params;
    
    const services = await pool.query(
      `SELECT 
         s.id, s.name, s.status, s.price, s.billing_cycle, s.next_due_date,
         s.domain, s.disk_used, s.bandwidth_used,
         hp.name as plan_name, hp.type as plan_type
       FROM services s
       LEFT JOIN hosting_plans hp ON s.product_id = hp.id
       WHERE s.customer_id = $1 AND s.tenant_id = $2
       ORDER BY s.created_at DESC`,
      [id, req.tenantId]
    );
    
    res.json({
      success: true,
      data: services.rows
    });
  } catch (error) {
    logger.error('Marketing API customer services error:', error);
    res.status(500).json({ error: 'Failed to fetch customer services' });
  }
});

/**
 * POST /api/marketing/services/:id/upgrade
 * Upgrade service plan
 * @access Marketing API Key
 */
router.post('/services/:id/upgrade', authenticateMarketingApi, async (req, res) => {
  try {
    const { id } = req.params;
    const { newPlanId, promoCode } = req.body;
    
    // Get current service
    const serviceResult = await pool.query(
      'SELECT * FROM services WHERE id = $1 AND tenant_id = $2',
      [id, req.tenantId]
    );
    
    if (serviceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    const service = serviceResult.rows[0];
    
    // Get new plan
    const planResult = await pool.query(
      'SELECT * FROM hosting_plans WHERE id = $1 AND tenant_id = $2',
      [newPlanId, req.tenantId]
    );
    
    if (planResult.rows.length === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    const newPlan = planResult.rows[0];
    const newPrice = newPlan.pricing?.[service.billing_cycle] || newPlan.price;
    
    // Calculate prorated amount
    const daysRemaining = Math.ceil((new Date(service.next_due_date) - new Date()) / (1000 * 60 * 60 * 24));
    const proratedCredit = (service.price / 30) * daysRemaining;
    const upgradeAmount = newPrice - proratedCredit;
    
    // Update service
    await pool.query(
      `UPDATE services 
       SET product_id = $1, name = $2, price = $3, updated_at = NOW()
       WHERE id = $4`,
      [newPlanId, newPlan.name, newPrice, id]
    );
    
    // Create upgrade invoice
    const invoiceResult = await pool.query(
      `INSERT INTO invoices 
       (tenant_id, customer_id, amount, due_date, status, description)
       VALUES ($1, $2, $3, NOW(), 'unpaid', $4)
       RETURNING id`,
      [
        req.tenantId,
        service.customer_id,
        upgradeAmount > 0 ? upgradeAmount : 0,
        `Upgrade to ${newPlan.name} (prorated)`
      ]
    );
    
    logger.info('Service upgraded via marketing API', { 
      serviceId: id, 
      oldPlan: service.product_id, 
      newPlan: newPlanId 
    });
    
    res.json({
      success: true,
      data: {
        serviceId: id,
        newPlanId,
        newPrice,
        upgradeAmount,
        invoiceId: invoiceResult.rows[0].id,
        message: 'Service upgraded successfully'
      }
    });
  } catch (error) {
    logger.error('Marketing API service upgrade error:', error);
    res.status(500).json({ error: 'Failed to upgrade service' });
  }
});

// ===========================================
// API KEY MANAGEMENT (Admin Only)
// ===========================================

/**
 * POST /api/marketing/admin/api-keys
 * Create marketing API key
 * @access Admin with 'api_keys.create' permission
 */
router.post('/admin/api-keys', authenticateToken, requirePermission('api_keys.create'), async (req, res) => {
  try {
    const { name, expiresIn } = req.body;
    
    // Generate API key
    const apiKey = `mk_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    
    const expiresAt = expiresIn 
      ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000)
      : null;
    
    const result = await pool.query(
      `INSERT INTO api_keys 
       (tenant_id, key_hash, name, scope, expires_at, is_active)
       VALUES ($1, $2, $3, 'marketing', $4, true)
       RETURNING id, name, created_at`,
      [req.user.tenantId, keyHash, name, expiresAt]
    );
    
    res.status(201).json({
      success: true,
      data: {
        id: result.rows[0].id,
        apiKey, // Only returned once
        name: result.rows[0].name,
        expiresAt,
        message: 'API key created. Store it securely - it will not be shown again.'
      }
    });
  } catch (error) {
    logger.error('Marketing API key creation error:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

/**
 * GET /api/marketing/order-status/:sessionId
 * Get order/subscription status by checkout session ID
 * @access Marketing API (authenticated via API key)
 */
router.get(
  '/order-status/:sessionId',
  marketingApiLimiter,
  authenticateMarketingApi,
  async (req, res) => {
    try {
      const { sessionId } = req.params;

      const result = await pool.query(
        `SELECT 
          s.id as subscription_id,
          s.status,
          s.price,
          s.billing_cycle,
          s.metadata,
          c.id as customer_id,
          u.email,
          u.first_name,
          u.last_name,
          p.name as plan_name,
          d.domain_name,
          d.status as domain_status
         FROM subscriptions s
         JOIN customers c ON s.customer_id = c.id
         JOIN users u ON c.user_id = u.id
         JOIN products p ON s.product_id = p.id
         LEFT JOIN domains d ON d.id::text = s.metadata->>'domainId'
         WHERE s.tenant_id = $1 
         AND (s.metadata->>'checkoutSessionId' = $2 OR s.metadata->>'stripeSessionId' = $2)
         LIMIT 1`,
        [req.tenantId, sessionId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Order not found',
          sessionId 
        });
      }

      const order = result.rows[0];
      
      res.json({
        success: true,
        data: {
          subscriptionId: order.subscription_id,
          status: order.status,
          customerEmail: order.email,
          customerName: `${order.first_name || ''} ${order.last_name || ''}`.trim(),
          planName: order.plan_name,
          price: parseFloat(order.price),
          billingCycle: order.billing_cycle,
          domain: order.domain_name,
          domainStatus: order.domain_status,
          promoCode: order.metadata?.promoCode || null,
          discount: order.metadata?.discountAmount ? {
            amount: parseFloat(order.metadata.discountAmount),
            originalPrice: parseFloat(order.metadata.originalPrice)
          } : null
        }
      });
    } catch (error) {
      logger.error('Order status lookup error:', error);
      res.status(500).json({ error: 'Failed to retrieve order status' });
    }
  }
);

/**
 * GET /api/marketing/admin/api-keys
 * List all marketing API keys
 * @access Admin with 'api_keys.read' permission
 */
router.get('/admin/api-keys', authenticateToken, requirePermission('api_keys.read'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, scope, is_active, created_at, last_used_at, expires_at
       FROM api_keys
       WHERE tenant_id = $1 AND scope = 'marketing'
       ORDER BY created_at DESC`,
      [req.user.tenantId]
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Marketing API key list error:', error);
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

/**
 * DELETE /api/marketing/admin/api-keys/:id
 * Revoke marketing API key
 * @access Admin with 'api_keys.delete' permission
 */
router.delete('/admin/api-keys/:id', authenticateToken, requirePermission('api_keys.delete'), async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query(
      `UPDATE api_keys 
       SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [id, req.user.tenantId]
    );
    
    res.json({
      success: true,
      message: 'API key revoked successfully'
    });
  } catch (error) {
    logger.error('Marketing API key revocation error:', error);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

export default router;
