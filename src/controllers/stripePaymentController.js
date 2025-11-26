// src/controllers/stripePaymentController.js
import { stripe } from '../config/stripeConfig.js';
import logger from '../utils/logger.js';

/**
 * POST /api/stripe/create-payment-intent
 * Body: {
 *   items: CartItem[],
 *   customerEmail?: string,
 *   cartId?: string
 * }
 * 
 * Creates a Stripe PaymentIntent from cart items for custom checkout UI
 */
export async function createPaymentIntent(req, res) {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const { items, customerEmail, cartId } = req.body || {};

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Convert to cents and sum
    const amountInCents = items.reduce((total, item) => {
      // item.price is already in cents, or item.unitAmount is in dollars
      const unitPrice = item.price || Math.round((item.unitAmount || 0) * 100);
      const quantity = item.quantity || 1;
      return total + (unitPrice * quantity);
    }, 0);

    if (amountInCents <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    // Optional: create / reuse a Stripe Customer
    let customerId;
    if (customerEmail) {
      const existing = await stripe.customers.list({ email: customerEmail, limit: 1 });
      if (existing.data[0]) {
        customerId = existing.data[0].id;
      } else {
        const customer = await stripe.customers.create({ 
          email: customerEmail,
          metadata: {
            source: 'migrahosting-marketing',
          },
        });
        customerId = customer.id;
      }
    }

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: {
        cartId: cartId || '',
        source: 'migrahosting-marketing',
        // Compact summary of items for reconciliation
        items: JSON.stringify(
          items.map((i) => ({
            id: i.id || i.priceId,
            name: i.name,
            qty: i.quantity || 1,
            type: i.type || 'other',
          })),
        ),
        itemCount: items.length,
      },
      description: `MigraHosting Order - ${items.length} item(s)`,
    });

    logger.info(`Created PaymentIntent ${paymentIntent.id} for ${amountInCents / 100} USD (${items.length} items)`);

    return res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });

  } catch (error) {
    logger.error('createPaymentIntent error', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to create payment intent',
    });
  }
}

/**
 * GET /api/stripe/payment-intent/:id
 * Retrieve PaymentIntent status for verification
 */
export async function getPaymentIntent(req, res) {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Missing payment intent ID' });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(id);

    return res.json({
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      metadata: paymentIntent.metadata,
    });

  } catch (error) {
    logger.error('getPaymentIntent error', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to retrieve payment intent',
    });
  }
}
