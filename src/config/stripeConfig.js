import Stripe from 'stripe';
import logger from '../utils/logger.js';

if (!process.env.STRIPE_SECRET_KEY) {
  logger.warn('[Stripe] STRIPE_SECRET_KEY is not set. Stripe will not be fully functional.');
}

export const stripe =
  process.env.STRIPE_SECRET_KEY &&
  new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
  });

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

export const STRIPE_CHECKOUT_CONFIG = {
  successUrl:
    process.env.STRIPE_SUCCESS_URL ||
    'https://migrahosting.com/checkout/success?session_id={CHECKOUT_SESSION_ID}',
  cancelUrl:
    process.env.STRIPE_CANCEL_URL ||
    'https://migrahosting.com/checkout?canceled=true',
};
