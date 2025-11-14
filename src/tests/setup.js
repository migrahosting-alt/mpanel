// Test setup - runs before all tests
import { beforeAll, afterAll } from '@jest/globals';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/mpanel_test';
process.env.REDIS_URL = 'redis://localhost:6380';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars!!';

// Global test timeout
jest.setTimeout(10000);

// Setup runs before all tests
beforeAll(async () => {
  console.log('🧪 Test suite starting...');
});

// Cleanup runs after all tests
afterAll(async () => {
  console.log('🧪 Test suite complete');
});
