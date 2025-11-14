/**
 * Customer API Tests
 * Tests customer CRUD operations
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import customerRoutes from '../routes/customerRoutes.js';
import { authenticate } from '../middleware/auth.js';

// Create test Express app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(authenticate); // All customer routes require auth
  app.use('/api/customers', customerRoutes);
  return app;
};

let app;
let authToken;
let createdCustomerId;

beforeAll(async () => {
  app = createTestApp();
  
  // Login to get auth token
  const authApp = express();
  authApp.use(express.json());
  const authRoutes = (await import('../routes/authRoutes.js')).default;
  authApp.use('/api/auth', authRoutes);
  
  const loginResponse = await request(authApp)
    .post('/api/auth/login')
    .send({
      email: 'admin@migrahosting.com',
      password: 'Admin123!',
    });
  
  authToken = loginResponse.body.token;
});

describe('Customer API', () => {
  describe('GET /api/customers', () => {
    test('should get list of customers', async () => {
      const response = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should support pagination', async () => {
      const response = await request(app)
        .get('/api/customers?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('customers');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
    });
  });

  describe('POST /api/customers', () => {
    test('should create a new customer', async () => {
      const newCustomer = {
        email: `test-${Date.now()}@example.com`,
        name: 'Test Customer',
        company: 'Test Company',
        phone: '+1234567890',
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zip: '12345',
        country: 'US',
      };

      const response = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newCustomer);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email', newCustomer.email);
      expect(response.body).toHaveProperty('name', newCustomer.name);
      
      // Save ID for subsequent tests
      createdCustomerId = response.body.id;
    });

    test('should reject customer with missing required fields', async () => {
      const invalidCustomer = {
        name: 'Test Customer',
        // Missing email
      };

      const response = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidCustomer);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should reject customer with invalid email', async () => {
      const invalidCustomer = {
        email: 'invalid-email',
        name: 'Test Customer',
      };

      const response = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidCustomer);

      expect(response.status).toBe(400);
    });

    test('should reject duplicate email', async () => {
      const duplicateCustomer = {
        email: 'admin@migrahosting.com', // Already exists
        name: 'Duplicate Customer',
      };

      const response = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(duplicateCustomer);

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/customers/:id', () => {
    test('should get customer by ID', async () => {
      const response = await request(app)
        .get(`/api/customers/${createdCustomerId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', createdCustomerId);
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('name');
    });

    test('should return 404 for non-existent customer', async () => {
      const response = await request(app)
        .get('/api/customers/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    test('should reject invalid customer ID', async () => {
      const response = await request(app)
        .get('/api/customers/invalid-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/customers/:id', () => {
    test('should update customer', async () => {
      const updates = {
        name: 'Updated Customer Name',
        company: 'Updated Company',
      };

      const response = await request(app)
        .put(`/api/customers/${createdCustomerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', updates.name);
      expect(response.body).toHaveProperty('company', updates.company);
    });

    test('should reject invalid update data', async () => {
      const invalidUpdates = {
        email: 'invalid-email',
      };

      const response = await request(app)
        .put(`/api/customers/${createdCustomerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidUpdates);

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/customers/:id', () => {
    test('should soft-delete customer', async () => {
      const response = await request(app)
        .delete(`/api/customers/${createdCustomerId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    test('should return 404 when deleting non-existent customer', async () => {
      const response = await request(app)
        .delete('/api/customers/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Customer Search', () => {
    test('should search customers by email', async () => {
      const response = await request(app)
        .get('/api/customers?search=admin')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('customers');
    });

    test('should search customers by name', async () => {
      const response = await request(app)
        .get('/api/customers?search=test')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });
  });
});
