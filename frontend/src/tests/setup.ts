// Test setup for frontend tests
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock environment variables
globalThis.import = {
  meta: {
    env: {
      VITE_MPANEL_API_BASE_URL: 'http://localhost:3000/api',
      VITE_API_URL: 'http://localhost:3000/api',
      MODE: 'test',
    },
  },
};
