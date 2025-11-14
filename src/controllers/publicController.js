import StripeService from '../services/StripeService.js';
import { PLAN_CATALOG, resolvePriceId, serializePlans, SETUP_FEE_PRICE } from '../config/planCatalog.js';
import logger from '../config/logger.js';

export const listPublicPlans = (req, res) => {
  const plans = serializePlans();
  res.json({ plans });
};

export const startPublicCheckout = async (req, res) => {
  try {
    const { planId, term = 'monthly', successUrl, cancelUrl, email } = req.body || {};
    if (!planId || !term) {
      return res.status(400).json({ error: 'Missing planId or term' });
    }

    const plan = PLAN_CATALOG[planId];
    if (!plan) {
      return res.status(404).json({ error: 'Unknown plan' });
    }

    const priceId = resolvePriceId(planId, term);
    if (!priceId) {
      return res.status(400).json({ error: 'Plan does not support requested term' });
    }

    const lineItems = [{ price: priceId, quantity: 1 }];
    if (term === 'monthly' && SETUP_FEE_PRICE) {
      lineItems.push({ price: SETUP_FEE_PRICE, quantity: 1 });
    }

    const session = await StripeService.createCheckoutSession({
      lineItems,
      mode: 'subscription',
      successUrl: successUrl || process.env.CHECKOUT_SUCCESS_URL || 'http://localhost:5173/checkout/success',
      cancelUrl: cancelUrl || process.env.CHECKOUT_CANCEL_URL || 'http://localhost:5173/pricing',
      customerEmail: email,
      metadata: { planId, term },
    });

    res.json({ url: session.url, id: session.id });
  } catch (error) {
    logger.error('Failed to start checkout', error);
    res.status(500).json({ error: 'Unable to create checkout session' });
  }
};
