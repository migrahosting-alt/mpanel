/**
 * Billing Workflow Tests
 * Tests invoice creation, payment processing, and subscription management
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';

let app;
let authToken;
let testCustomerId;
let testInvoiceId;
let testSubscriptionId;

beforeAll(async () => {
  // Create test Express app
  app = express();
  app.use(express.json());
  
  // Import routes
  const authRoutes = (await import('../routes/authRoutes.js')).default;
  const customerRoutes = (await import('../routes/customerRoutes.js')).default;
  const invoiceRoutes = (await import('../routes/invoiceRoutes.js')).default;
  const subscriptionRoutes = (await import('../routes/subscriptionRoutes.js')).default;
  const { authenticate } = await import('../middleware/auth.js');
  
  app.use('/api/auth', authRoutes);
  app.use('/api/customers', authenticate, customerRoutes);
  app.use('/api/invoices', authenticate, invoiceRoutes);
  app.use('/api/subscriptions', authenticate, subscriptionRoutes);
  
  // Login to get auth token
  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'admin@migrahosting.com',
      password: 'Admin123!',
    });
  
  authToken = loginResponse.body.token;
  
  // Create test customer
  const customerResponse = await request(app)
    .post('/api/customers')
    .set('Authorization', `Bearer ${authToken}`)
    .send({
      email: `billing-test-${Date.now()}@example.com`,
      name: 'Billing Test Customer',
      company: 'Test Company',
    });
  
  testCustomerId = customerResponse.body.id;
});

describe('Billing Workflows', () => {
  describe('Invoice Creation', () => {
    test('should create invoice for customer', async () => {
      const invoice = {
        customer_id: testCustomerId,
        items: [
          {
            description: 'Shared Hosting - Monthly',
            quantity: 1,
            unit_price: 9.99,
          },
          {
            description: 'Domain Registration - .com',
            quantity: 1,
            unit_price: 12.99,
          },
        ],
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invoice);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('invoice_number');
      expect(response.body).toHaveProperty('customer_id', testCustomerId);
      expect(response.body).toHaveProperty('status', 'unpaid');
      expect(response.body).toHaveProperty('subtotal');
      expect(response.body).toHaveProperty('tax');
      expect(response.body).toHaveProperty('total');
      
      // Calculate expected total (subtotal + 10% tax)
      const expectedSubtotal = 9.99 + 12.99;
      const expectedTax = expectedSubtotal * 0.10;
      const expectedTotal = expectedSubtotal + expectedTax;
      
      expect(parseFloat(response.body.subtotal)).toBeCloseTo(expectedSubtotal, 2);
      expect(parseFloat(response.body.tax)).toBeCloseTo(expectedTax, 2);
      expect(parseFloat(response.body.total)).toBeCloseTo(expectedTotal, 2);
      
      testInvoiceId = response.body.id;
    });

    test('should reject invoice with no items', async () => {
      const invoice = {
        customer_id: testCustomerId,
        items: [],
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invoice);

      expect(response.status).toBe(400);
    });

    test('should reject invoice with invalid customer_id', async () => {
      const invoice = {
        customer_id: 99999,
        items: [
          {
            description: 'Test Item',
            quantity: 1,
            unit_price: 10.00,
          },
        ],
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invoice);

      expect(response.status).toBe(404);
    });
  });

  describe('Invoice Retrieval', () => {
    test('should get invoice by ID', async () => {
      const response = await request(app)
        .get(`/api/invoices/${testInvoiceId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', testInvoiceId);
      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.items.length).toBe(2);
    });

    test('should get all invoices for customer', async () => {
      const response = await request(app)
        .get(`/api/invoices?customer_id=${testCustomerId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('Payment Processing (Mock)', () => {
    test('should mark invoice as paid', async () => {
      const payment = {
        payment_method: 'stripe',
        payment_intent: 'pi_test_mock_' + Date.now(),
      };

      const response = await request(app)
        .post(`/api/invoices/${testInvoiceId}/pay`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(payment);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'paid');
      expect(response.body).toHaveProperty('paid_at');
    });

    test('should reject payment for already paid invoice', async () => {
      const payment = {
        payment_method: 'stripe',
        payment_intent: 'pi_test_duplicate',
      };

      const response = await request(app)
        .post(`/api/invoices/${testInvoiceId}/pay`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(payment);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Subscription Management', () => {
    test('should create subscription', async () => {
      const subscription = {
        customer_id: testCustomerId,
        product_id: 1, // Shared Hosting
        billing_cycle: 'monthly',
        price: 9.99,
      };

      const response = await request(app)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(subscription);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('status', 'active');
      expect(response.body).toHaveProperty('next_billing_date');
      
      testSubscriptionId = response.body.id;
    });

    test('should get active subscriptions for customer', async () => {
      const response = await request(app)
        .get(`/api/subscriptions?customer_id=${testCustomerId}&status=active`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('should cancel subscription', async () => {
      const response = await request(app)
        .post(`/api/subscriptions/${testSubscriptionId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cancel_at_period_end: true,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'active'); // Still active until period end
      expect(response.body).toHaveProperty('cancel_at_period_end', true);
    });
  });

  describe('Recurring Billing', () => {
    test('should generate invoice for subscription renewal', async () => {
      // This would typically be triggered by a cron job
      const response = await request(app)
        .post('/api/subscriptions/generate-renewals')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('generated');
      expect(typeof response.body.generated).toBe('number');
    });
  });

  describe('Tax Calculation', () => {
    test('should apply correct tax rate', async () => {
      const invoice = {
        customer_id: testCustomerId,
        items: [
          {
            description: 'Test Item',
            quantity: 1,
            unit_price: 100.00,
          },
        ],
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invoice);

      expect(response.status).toBe(201);
      // 10% tax on $100 = $10
      expect(parseFloat(response.body.tax)).toBeCloseTo(10.00, 2);
      expect(parseFloat(response.body.total)).toBeCloseTo(110.00, 2);
    });
  });

  describe('ICANN Fee (for domains)', () => {
    test('should add ICANN fee for domain registrations', async () => {
      const invoice = {
        customer_id: testCustomerId,
        items: [
          {
            description: 'Domain Registration - .com',
            quantity: 1,
            unit_price: 12.99,
            is_domain: true,
          },
        ],
      };

      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invoice);

      expect(response.status).toBe(201);
      // Should include $0.18 ICANN fee
      const expectedSubtotal = 12.99 + 0.18;
      expect(parseFloat(response.body.subtotal)).toBeCloseTo(expectedSubtotal, 2);
    });
  });
});
