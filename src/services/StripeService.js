import Stripe from 'stripe';
import dotenv from 'dotenv';
import logger from '../config/logger.js';

dotenv.config();

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

class StripeService {
  /**
   * Create payment intent
   */
  static async createPaymentIntent(amount, currency, metadata = {}) {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      logger.info(`Payment intent created: ${paymentIntent.id}`);
      return paymentIntent;

    } catch (error) {
      logger.error('Error creating payment intent:', error);
      throw error;
    }
  }

  /**
   * Create customer in Stripe
   */
  static async createCustomer(email, name, metadata = {}) {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    try {
      const customer = await stripe.customers.create({
        email,
        name,
        metadata,
      });

      logger.info(`Stripe customer created: ${customer.id}`);
      return customer;

    } catch (error) {
      logger.error('Error creating Stripe customer:', error);
      throw error;
    }
  }

  /**
   * Create subscription in Stripe
   */
  static async createSubscription(customerId, priceId, metadata = {}) {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    try {
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        metadata,
      });

      logger.info(`Stripe subscription created: ${subscription.id}`);
      return subscription;

    } catch (error) {
      logger.error('Error creating Stripe subscription:', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   */
  static verifyWebhookSignature(payload, signature) {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('Webhook secret not configured');
    }

    try {
      return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      logger.error('Error verifying webhook signature:', error);
      throw error;
    }
  }

  /**
   * Refund payment
   */
  static async refundPayment(paymentIntentId, amount = null) {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    try {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined,
      });

      logger.info(`Refund created: ${refund.id}`);
      return refund;

    } catch (error) {
      logger.error('Error creating refund:', error);
      throw error;
    }
  }
}

export default StripeService;
