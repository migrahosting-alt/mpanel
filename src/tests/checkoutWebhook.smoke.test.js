import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.STRIPE_SECRET_KEY ||= 'sk_test_checkout_smoke';
process.env.STRIPE_WEBHOOK_SECRET ||= 'whsec_checkout_smoke';

const { stripe } = await import('../config/stripeConfig.js');
const db = (await import('../db/index.js')).default;
const { createCheckoutSession } = await import('../controllers/checkoutController.js');
const stripeWebhookRouter = (await import('../routes/stripeWebhookRoutes.js')).default;

if (!stripe) {
  throw new Error('Stripe client failed to initialize for smoke tests');
}

if (!stripe.checkout?.sessions) {
  throw new Error('Stripe checkout client unavailable in tests');
}

if (!stripe.webhooks) {
  throw new Error('Stripe webhook utilities unavailable in tests');
}

function createMockResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
  };
}

function mockDb(responses, t) {
  const calls = [];
  const original = db.query;
  db.query = async (text, params) => {
    calls.push({ text, params });
    return responses.length ? responses.shift() : { rows: [] };
  };
  t.teardown(() => {
    db.query = original;
  });
  return calls;
}

function mockStripeCheckout(t, implementation) {
  const original = stripe.checkout.sessions.create;
  stripe.checkout.sessions.create = implementation;
  t.teardown(() => {
    stripe.checkout.sessions.create = original;
  });
}

function mockConstructEvent(t, implementation) {
  const original = stripe.webhooks.constructEvent;
  stripe.webhooks.constructEvent = implementation;
  t.teardown(() => {
    stripe.webhooks.constructEvent = original;
  });
}

function getStripeWebhookHandler() {
  const layer = stripeWebhookRouter.stack.find(
    (entry) => entry.route && entry.route.path === '/stripe'
  );
  if (!layer) {
    throw new Error('Stripe webhook route is not registered');
  }
  const routeHandlers = layer.route.stack;
  return routeHandlers[routeHandlers.length - 1].handle;
}

test('checkout session smoke path responds with redirect URL', { concurrency: false }, async (t) => {
  const dbResponses = [
    {
      rows: [
        {
          product_id: 1,
          code: 'starter_plan',
          name: 'Starter',
          type: 'hosting',
          price_id: 10,
          unit_amount: 9900,
          currency: 'usd',
          stripe_price_id: 'price_123',
        },
      ],
    },
    { rows: [{ id: 101 }] },
    { rows: [{ id: 202 }] },
    { rows: [] },
  ];
  const dbCalls = mockDb(dbResponses, t);

  const createdSessions = [];
  mockStripeCheckout(t, async (payload) => {
    createdSessions.push(payload);
    return {
      id: 'cs_test_smoke',
      url: 'https://stripe.example/cs_test_smoke',
    };
  });

  const req = {
    body: {
      planId: 'starter_plan',
      billingCycle: 'monthly',
      trialActive: false,
      addonIds: [],
      customer: {
        email: 'checkout-smoke@example.com',
        name: 'Checkout Smoke',
      },
      domain: {
        mode: 'existing',
        value: 'example.com',
      },
    },
  };
  const res = createMockResponse();

  await createCheckoutSession(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.sessionId, 'cs_test_smoke');
  assert.equal(res.body.subscriptionId, 202);
  assert.equal(createdSessions.length, 1);
  assert.deepEqual(createdSessions[0].line_items[0], {
    price: 'price_123',
    quantity: 1,
  });
  assert.ok(dbCalls.length >= 4);
});

test('stripe webhook processes checkout completion event', { concurrency: false }, async (t) => {
  const dbResponses = [
    {
      rows: [
        {
          id: 501,
          customer_id: 42,
          tenant_id: null,
          status: 'incomplete',
          metadata: { productTypes: [] },
        },
      ],
    },
    {
      rows: [
        {
          id: 501,
          customer_id: 42,
          tenant_id: null,
          customer_email: 'checkout-smoke@example.com',
          metadata: { productTypes: [] },
        },
      ],
    },
    { rows: [{ id: 777 }] },
    { rows: [] },
    { rows: [] },
  ];
  const dbCalls = mockDb(dbResponses, t);

  mockConstructEvent(t, () => ({
    id: 'evt_test_123',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_smoke',
        customer: 'cus_test_smoke',
        subscription: 'sub_test_smoke',
        metadata: {
          checkoutSessionId: 'cs_test_smoke',
          productTypes: [],
        },
      },
    },
  }));

  const handler = getStripeWebhookHandler();
  const req = {
    headers: {
      'stripe-signature': 'sig_test',
    },
    body: Buffer.from('{}'),
  };
  const res = createMockResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { received: true });
  assert.ok(dbCalls.length >= 5);
});
