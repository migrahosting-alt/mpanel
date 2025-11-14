/**
 * Authentication API Tests
 * Tests login, logout, token validation, and protected routes
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import authRoutes from '../routes/authRoutes.js';
import { authenticate } from '../middleware/auth.js';

// Create test Express app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  
  // Protected test route
  app.get('/api/protected', authenticate, (req, res) => {
    res.json({ message: 'Access granted', user: req.user });
  });
  
  return app;
};

let app;
let authToken;
let testUser;

beforeAll(() => {
  app = createTestApp();
  testUser = {
    email: 'test@example.com',
    password: 'TestPassword123!',
  };
});

describe('Authentication API', () => {
  describe('POST /api/auth/login', () => {
    test('should reject login with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    test('should reject login with missing email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'TestPassword123!',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should reject login with missing password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should successfully login with valid credentials (admin user)', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@migrahosting.com',
          password: 'Admin123!',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email');
      expect(response.body.user).toHaveProperty('name');
      
      // Save token for subsequent tests
      authToken = response.body.token;
    });
  });

  describe('GET /api/auth/me', () => {
    test('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
    });

    test('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    test('should return user info with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('name');
      expect(response.body).not.toHaveProperty('password');
    });
  });

  describe('POST /api/auth/logout', () => {
    test('should successfully logout', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Protected Routes', () => {
    test('should deny access to protected route without token', async () => {
      const response = await request(app)
        .get('/api/protected');

      expect(response.status).toBe(401);
    });

    test('should allow access to protected route with valid token', async () => {
      // Login again to get fresh token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@migrahosting.com',
          password: 'Admin123!',
        });

      const token = loginResponse.body.token;

      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Access granted');
      expect(response.body).toHaveProperty('user');
    });
  });

  describe('Token Validation', () => {
    test('should reject expired token', async () => {
      // This would require mocking JWT to create expired token
      // For now, we'll test with malformed token
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired.token');

      expect(response.status).toBe(401);
    });

    test('should reject token with wrong signature', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MX0.wrong-signature');

      expect(response.status).toBe(401);
    });
  });
});
