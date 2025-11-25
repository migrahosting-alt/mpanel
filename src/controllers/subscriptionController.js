import Subscription from '../models/Subscription.js';
import logger from '../config/logger.js';
import pool from '../db/index.js';
import { stripe } from '../config/stripeConfig.js';

export const createSubscription = async (req, res) => {
  try {
    const subscriptionData = {
      tenantId: req.user.tenantId,
      ...req.body
    };

    const subscription = await Subscription.create(subscriptionData);
    logger.info(`Subscription created: ${subscription.id}`, { userId: req.user.id });
    res.status(201).json(subscription);
  } catch (error) {
    logger.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
};

export const getSubscriptions = async (req, res) => {
  try {
    const { customerId, status } = req.query;
    const subscriptions = await Subscription.findByCustomer(customerId, status);
    res.json(subscriptions);
  } catch (error) {
    logger.error('Error fetching subscriptions:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
};

export const getSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    res.json(subscription);
  } catch (error) {
    logger.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
};

export const cancelSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.cancel(req.params.id);
    logger.info(`Subscription cancelled: ${subscription.id}`, { userId: req.user.id });
    res.json(subscription);
  } catch (error) {
    logger.error('Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
};

export const suspendSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.suspend(req.params.id);
    logger.info(`Subscription suspended: ${subscription.id}`, { userId: req.user.id });
    res.json(subscription);
  } catch (error) {
    logger.error('Error suspending subscription:', error);
    res.status(500).json({ error: 'Failed to suspend subscription' });
  }
};

export const reactivateSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.reactivate(req.params.id);
    logger.info(`Subscription reactivated: ${subscription.id}`, { userId: req.user.id });
    res.json(subscription);
  } catch (error) {
    logger.error('Error reactivating subscription:', error);
    res.status(500).json({ error: 'Failed to reactivate subscription' });
  }
};

/**
 * Get available subscription plans
 * GET /api/subscriptions/plans
 */
export const getPlans = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM subscription_plans WHERE active = true ORDER BY price ASC'
    );

    res.json({ plans: result.rows });
  } catch (error) {
    logger.error('Failed to fetch plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
};

/**
 * Create Stripe subscription with payment
 * POST /api/subscriptions/stripe
 * Body: { planId, paymentMethodId }
 */
export const createStripeSubscription = async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const { planId, paymentMethodId } = req.body;
    const userId = req.user.id;

    // Get plan details
    const planResult = await pool.query(
      'SELECT * FROM subscription_plans WHERE id = $1 AND active = true',
      [planId]
    );

    if (planResult.rows.length === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const plan = planResult.rows[0];

    // Get or create Stripe customer
    const userResult = await pool.query('SELECT stripe_customer_id, email FROM users WHERE id = $1', [userId]);
    let stripeCustomerId = userResult.rows[0]?.stripe_customer_id;
    const userEmail = userResult.rows[0]?.email;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { user_id: userId },
      });
      stripeCustomerId = customer.id;

      await pool.query(
        'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
        [stripeCustomerId, userId]
      );
    }

    // Attach payment method if provided
    if (paymentMethodId) {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: stripeCustomerId,
      });

      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    }

    // Create Stripe subscription
    const stripeSubscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: plan.stripe_price_id }],
      metadata: {
        user_id: userId,
        plan_id: planId,
      },
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });

    // Save subscription to database using Model
    const subscriptionData = {
      tenantId: req.user.tenantId,
      user_id: userId,
      plan_id: planId,
      stripe_subscription_id: stripeSubscription.id,
      status: stripeSubscription.status,
      current_period_start: new Date(stripeSubscription.current_period_start * 1000),
      current_period_end: new Date(stripeSubscription.current_period_end * 1000),
      cancel_at_period_end: stripeSubscription.cancel_at_period_end,
    };

    const subscription = await Subscription.create(subscriptionData);

    logger.info(`Stripe subscription created: ${stripeSubscription.id} for user ${userId}`);

    res.status(201).json({
      subscription,
      clientSecret: stripeSubscription.latest_invoice?.payment_intent?.client_secret,
    });
  } catch (error) {
    logger.error('Failed to create Stripe subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
};

/**
 * Update subscription plan (upgrade/downgrade)
 * PUT /api/subscriptions/:id/change-plan
 * Body: { newPlanId }
 */
export const changePlan = async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const { id } = req.params;
    const { newPlanId } = req.body;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Get current subscription
    const subQuery = isAdmin
      ? 'SELECT * FROM subscriptions WHERE id = $1'
      : 'SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2';
    const subParams = isAdmin ? [id] : [id, userId];
    const subResult = await pool.query(subQuery, subParams);

    if (subResult.rows.length === 0) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const subscription = subResult.rows[0];

    // Get new plan
    const planResult = await pool.query(
      'SELECT * FROM subscription_plans WHERE id = $1 AND active = true',
      [newPlanId]
    );

    if (planResult.rows.length === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const newPlan = planResult.rows[0];

    // Update Stripe subscription
    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
    
    const updatedStripeSubscription = await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      items: [
        {
          id: stripeSubscription.items.data[0].id,
          price: newPlan.stripe_price_id,
        },
      ],
      proration_behavior: 'create_prorations',
    });

    // Update database
    await pool.query(
      `UPDATE subscriptions 
       SET plan_id = $1, status = $2, current_period_end = $3, updated_at = NOW()
       WHERE id = $4`,
      [
        newPlanId,
        updatedStripeSubscription.status,
        new Date(updatedStripeSubscription.current_period_end * 1000),
        id,
      ]
    );

    logger.info(`Subscription ${id} changed to plan ${newPlanId}`);

    res.json({ message: 'Plan changed successfully', subscription: updatedStripeSubscription });
  } catch (error) {
    logger.error('Failed to change plan:', error);
    res.status(500).json({ error: 'Failed to change plan' });
  }
};
