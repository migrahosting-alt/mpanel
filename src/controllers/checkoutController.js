// src/controllers/checkoutController.js
import Stripe from 'stripe';
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import emailService from '../services/email.js';
import queueService from '../services/queueService.js';
import { shouldSendEmail } from './emailPreferencesController.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Create Stripe Checkout Session for cart items
 */
export const createCheckoutSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { items, successUrl, cancelUrl } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Validate products and fetch current prices
    const productIds = items.map(item => item.productId);
    const productsQuery = `
      SELECT id, name, price, type, billing_cycle, category
      FROM products
      WHERE id = ANY($1)
    `;
    const productsResult = await pool.query(productsQuery, [productIds]);
    const products = productsResult.rows;

    if (products.length !== items.length) {
      return res.status(400).json({ error: 'Some products not found' });
    }

    // Create Stripe line items
    const lineItems = items.map(item => {
      const product = products.find(p => p.id === item.productId);
      
      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: product.name,
            description: item.configuration?.domain || item.configuration?.email_address || product.category,
            metadata: {
              product_id: product.id,
              product_type: product.type,
              billing_cycle: product.billing_cycle,
            },
          },
          unit_amount: Math.round(product.price * 100), // Convert to cents
          recurring: product.billing_cycle !== 'one_time' ? {
            interval: product.billing_cycle === 'yearly' ? 'year' : 'month',
          } : undefined,
        },
        quantity: item.quantity || 1,
      };
    });

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: lineItems.some(item => item.price_data.recurring) ? 'subscription' : 'payment',
      success_url: successUrl || `${process.env.FRONTEND_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/cart`,
      customer_email: req.user.email,
      client_reference_id: userId,
      metadata: {
        user_id: userId,
        cart_items: JSON.stringify(items),
      },
    });

    logger.info(`Checkout session created: ${session.id}`, { userId });

    res.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    logger.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
};

/**
 * Get checkout session details
 */
export const getCheckoutSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      id: session.id,
      payment_status: session.payment_status,
      customer_email: session.customer_email,
      amount_total: session.amount_total,
      currency: session.currency,
      status: session.status,
    });
  } catch (error) {
    logger.error('Error fetching checkout session:', error);
    res.status(500).json({ error: 'Failed to fetch checkout session' });
  }
};

/**
 * Handle successful checkout (called from webhook or success page)
 */
export const handleCheckoutSuccess = async (req, res) => {
  try {
    const { sessionId } = req.body;

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items'],
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    const userId = session.metadata.user_id;
    const cartItems = JSON.parse(session.metadata.cart_items);

    // Create order record
    const orderQuery = `
      INSERT INTO orders (
        user_id,
        total_amount,
        status,
        payment_method,
        stripe_session_id,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const orderResult = await pool.query(orderQuery, [
      userId,
      session.amount_total / 100, // Convert from cents
      'completed',
      'stripe',
      sessionId,
      JSON.stringify({ items: cartItems }),
    ]);

    const order = orderResult.rows[0];

    // Create services from cart items
    const createdServices = [];
    for (const item of cartItems) {
      const productQuery = `SELECT * FROM products WHERE id = $1`;
      const productResult = await pool.query(productQuery, [item.productId]);
      const product = productResult.rows[0];

      if (product) {
        const serviceQuery = `
          INSERT INTO services (
            user_id,
            customer_id,
            product_id,
            type,
            name,
            status,
            configuration,
            price,
            billing_cycle,
            auto_renew,
            renewal_date,
            domain
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING *
        `;

        const renewalDate = new Date();
        renewalDate.setMonth(renewalDate.getMonth() + (product.billing_cycle === 'yearly' ? 12 : 1));
        
        const domain = item.configuration?.domain || null;

        const serviceResult = await pool.query(serviceQuery, [
          userId,
          userId, // customer_id same as user_id
          item.productId,
          product.type,
          domain || item.configuration?.email_address || item.name || product.name,
          'pending', // Start as pending, will become active after provisioning
          JSON.stringify(item.configuration || {}),
          product.price,
          product.billing_cycle,
          true,
          renewalDate,
          domain
        ]);

        const service = serviceResult.rows[0];
        createdServices.push(service);

        // 🚀 TRIGGER AUTOMATED PROVISIONING
        // Queue provisioning job for hosting/domain services
        if (['hosting', 'domain', 'vps'].includes(product.type) && domain) {
          try {
            const jobId = await queueService.addProvisioningJob({
              serviceId: service.id,
              customerId: userId,
              productId: product.id,
              domain: domain
            });
            
            logger.info(`🚀 Provisioning queued for service ${service.id}`, {
              jobId,
              domain,
              productType: product.type
            });
          } catch (provisionError) {
            logger.error(`Failed to queue provisioning for service ${service.id}:`, provisionError);
          }
        } else {
          // Non-hosting services are immediately active
          await pool.query(
            'UPDATE services SET status = $1 WHERE id = $2',
            ['active', service.id]
          );
        }
      }
    }

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, type, description) VALUES ($1, $2, $3)`,
      [userId, 'order_completed', `Order #${order.id} completed - ${cartItems.length} items`]
    );

    // Send order confirmation email
    try {
      const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        const shouldSend = await shouldSendEmail(user.id, 'payment');
        
        if (shouldSend) {
          await emailService.sendOrderConfirmationEmail(user, order, createdServices);
          logger.info(`Order confirmation email sent to ${user.email}`, { orderId: order.id });
        }
      }
    } catch (emailError) {
      logger.error('Failed to send order confirmation email:', emailError);
    }

    logger.info(`Order created: ${order.id}`, { userId, sessionId });

    res.json({ order, message: 'Order processed successfully' });
  } catch (error) {
    logger.error('Error handling checkout success:', error);
    res.status(500).json({ error: 'Failed to process order' });
  }
};

/**
 * Get user's orders
 */
export const getOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    let query = `
      SELECT 
        o.*,
        u.email as customer_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
    `;

    const params = [];
    
    if (!isAdmin) {
      query += ` WHERE o.user_id = $1`;
      params.push(userId);
    }

    query += ` ORDER BY o.created_at DESC`;

    const result = await pool.query(query, params);

    res.json({ orders: result.rows });
  } catch (error) {
    logger.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

/**
 * Get single order
 */
export const getOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    const query = `
      SELECT 
        o.*,
        u.email as customer_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = result.rows[0];

    if (!isAdmin && order.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(order);
  } catch (error) {
    logger.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
};
