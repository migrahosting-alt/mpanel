#!/usr/bin/env node
/**
 * mPanel Smoke Tests
 * 
 * Quick health checks to run after deployment.
 * Verifies critical endpoints are responding correctly.
 * 
 * Usage:
 *   npm run smoke-test
 *   npm run smoke-test -- --env=production
 *   npm run smoke-test -- --env=staging --verbose
 */

import https from 'https';
import http from 'http';

interface SmokeTestConfig {
  baseUrl: string;
  adminEmail: string;
  adminPassword: string;
}

const ENVIRONMENTS: Record<string, SmokeTestConfig> = {
  local: {
    baseUrl: 'http://localhost:3010',
    adminEmail: 'admin@migrahosting.local',
    adminPassword: 'admin123',
  },
  staging: {
    baseUrl: 'https://staging-mpanel.migrahosting.com',
    adminEmail: process.env.STAGING_ADMIN_EMAIL || '',
    adminPassword: process.env.STAGING_ADMIN_PASSWORD || '',
  },
  production: {
    baseUrl: 'https://mpanel.migrahosting.com',
    adminEmail: process.env.PROD_ADMIN_EMAIL || '',
    adminPassword: process.env.PROD_ADMIN_PASSWORD || '',
  },
};

const args = process.argv.slice(2);
const envArg = args.find((arg) => arg.startsWith('--env='));
const env = envArg ? envArg.split('=')[1] : 'local';
const verbose = args.includes('--verbose');

const config = ENVIRONMENTS[env];
if (!config) {
  console.error(`❌ Unknown environment: ${env}`);
  console.error(`Available: ${Object.keys(ENVIRONMENTS).join(', ')}`);
  process.exit(1);
}

// Test results
let passed = 0;
let failed = 0;
let token: string | null = null;

/**
 * Make HTTP request
 */
function request(
  url: string,
  options: any = {}
): Promise<{ status: number; data: any; headers: any }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const httpModule = urlObj.protocol === 'https:' ? https : http;

    const req = httpModule.request(
      url,
      {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : null;
            resolve({ status: res.statusCode || 0, data: parsed, headers: res.headers });
          } catch (err) {
            resolve({ status: res.statusCode || 0, data, headers: res.headers });
          }
        });
      }
    );

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

/**
 * Run a test
 */
async function test(
  name: string,
  fn: () => Promise<void>
): Promise<void> {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`❌ ${name}`);
    console.error(`   ${err.message}`);
    if (verbose && err.details) {
      console.error(`   Details: ${JSON.stringify(err.details, null, 2)}`);
    }
    failed++;
  }
}

/**
 * Assert helper
 */
function assert(condition: boolean, message: string, details?: any): void {
  if (!condition) {
    const error: any = new Error(message);
    if (details) error.details = details;
    throw error;
  }
}

/**
 * Run all smoke tests
 */
async function runSmokeTests() {
  console.log(`\n🔥 Running smoke tests against: ${config.baseUrl}\n`);

  // Test 1: Health Check
  await test('Health check /__debug', async () => {
    const res = await request(`${config.baseUrl}/api/v1/__debug`);
    assert(res.status === 200, `Expected 200, got ${res.status}`, res.data);
    assert(res.data?.status === 'ok', 'Health check failed', res.data);
  });

  // Test 2: Public routes accessible
  await test('Public product catalog accessible', async () => {
    const res = await request(`${config.baseUrl}/api/v1/billing/products/catalog/public`);
    // Should work even without auth (or return 404 if no products yet)
    assert(
      res.status === 200 || res.status === 404,
      `Expected 200 or 404, got ${res.status}`,
      res.data
    );
  });

  // Test 3: Protected routes require auth
  await test('Protected routes reject unauthenticated requests', async () => {
    const res = await request(`${config.baseUrl}/api/v1/admin/customers`);
    assert(res.status === 401, `Expected 401, got ${res.status}`, res.data);
  });

  // Test 4: Admin login
  if (config.adminEmail && config.adminPassword) {
    await test('Admin login successful', async () => {
      const res = await request(`${config.baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        body: {
          email: config.adminEmail,
          password: config.adminPassword,
        },
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`, res.data);
      assert(res.data?.token, 'No token returned', res.data);
      token = res.data.token;
    });

    // Test 5: Authenticated request to admin endpoint
    await test('Admin customers endpoint accessible', async () => {
      if (!token) throw new Error('No auth token available');
      
      const res = await request(`${config.baseUrl}/api/v1/admin/customers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert(
        res.status === 200,
        `Expected 200, got ${res.status}`,
        res.data
      );
    });

    // Test 6: Ops Overview (platform health)
    await test('Ops platform overview accessible', async () => {
      if (!token) throw new Error('No auth token available');
      
      const res = await request(`${config.baseUrl}/api/v1/ops/platform-overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert(
        res.status === 200 || res.status === 403, // May require specific role
        `Expected 200 or 403, got ${res.status}`,
        res.data
      );
    });

    // Test 7: Billing products endpoint
    await test('Billing products endpoint accessible', async () => {
      if (!token) throw new Error('No auth token available');
      
      const res = await request(`${config.baseUrl}/api/v1/billing/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert(
        res.status === 200 || res.status === 403,
        `Expected 200 or 403, got ${res.status}`,
        res.data
      );
    });

    // Test 8: CloudPods endpoint
    await test('CloudPods endpoint accessible', async () => {
      if (!token) throw new Error('No auth token available');
      
      const res = await request(`${config.baseUrl}/api/v1/cloudpods`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert(
        res.status === 200 || res.status === 403,
        `Expected 200 or 403, got ${res.status}`,
        res.data
      );
    });

    // Test 9: Security center endpoint
    await test('Security center profile accessible', async () => {
      if (!token) throw new Error('No auth token available');
      
      const res = await request(`${config.baseUrl}/api/v1/security/me/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert(
        res.status === 200 || res.status === 404, // 404 if profile doesn't exist yet
        `Expected 200 or 404, got ${res.status}`,
        res.data
      );
    });

    // Test 10: Rate limiting works
    await test('Rate limiting enforced on auth endpoints', async () => {
      // Make 6 rapid login attempts (should hit limit at 5)
      let limitHit = false;
      for (let i = 0; i < 6; i++) {
        const res = await request(`${config.baseUrl}/api/v1/auth/login`, {
          method: 'POST',
          body: {
            email: 'nonexistent@test.com',
            password: 'wrong',
          },
        });
        if (res.status === 429) {
          limitHit = true;
          break;
        }
      }
      assert(limitHit, 'Rate limiting not enforced');
    });
  } else {
    console.log('⚠️  Skipping authenticated tests (no credentials provided)');
  }

  // Summary
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n📊 Smoke Test Summary:`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   Total:  ${passed + failed}`);

  if (failed === 0) {
    console.log(`\n🎉 All smoke tests passed!\n`);
    process.exit(0);
  } else {
    console.log(`\n⚠️  Some tests failed. Check logs above.\n`);
    process.exit(1);
  }
}

// Run tests
runSmokeTests().catch((err) => {
  console.error('\n💥 Smoke test runner crashed:', err);
  process.exit(1);
});
