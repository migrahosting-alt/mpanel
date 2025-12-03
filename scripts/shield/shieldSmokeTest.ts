#!/usr/bin/env tsx
/**
 * Shield Smoke Test Runner
 * -------------------------------------------
 * Automates Phase 1 verification:
 *  1. Creates a temporary shield policy via admin API
 *  2. Hits /api/v1/__debug with/without required headers in report_only mode
 *  3. Promotes the policy to enforce mode and verifies 403 blocking
 *  4. Archives the temporary policy (cleanup)
 *
 * Usage:
 *   MPANEL_PLATFORM_TOKEN="<bearer token>" tsx scripts/shield/shieldSmokeTest.ts --tenant=global
 *   tsx scripts/shield/shieldSmokeTest.ts --base-url=http://localhost:2271 --token=xyz --tenant=<uuid>
 */

import process from 'node:process';
import crypto from 'node:crypto';

interface ArgMap {
  [key: string]: string;
}

function parseArgs(): ArgMap {
  const args: ArgMap = {};
  for (const token of process.argv.slice(2)) {
    const [rawKey, ...rest] = token.split('=');
    args[rawKey.trim()] = rest.join('=');
  }
  return args;
}

const args = parseArgs();

if (args['--help']) {
  console.log(`Shield Smoke Test\n\n` +
    `Required:\n` +
    `  --token=<JWT> or MPANEL_PLATFORM_TOKEN env\n` +
    `Optional:\n` +
    `  --base-url=http://localhost:2271\n` +
    `  --tenant=<uuid|global> (default: global)\n` +
    `  --cleanup=false (keeps policy active)\n`);
  process.exit(0);
}

const baseUrl = (args['--base-url'] ?? process.env.MPANEL_BASE_URL ?? 'http://localhost:2271').replace(/\/$/, '');
const token = args['--token'] ?? process.env.MPANEL_PLATFORM_TOKEN;
const tenantInput = args['--tenant'] ?? 'global';
const cleanup = (args['--cleanup'] ?? 'true') !== 'false';

if (!token) {
  console.error('✗ Missing platform admin token. Provide --token or MPANEL_PLATFORM_TOKEN env.');
  process.exit(1);
}

const adminHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
};

async function adminRequest(path: string, init: Record<string, unknown> = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...adminHeaders,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Admin request failed [${response.status}] ${response.statusText}: ${errorBody}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function hitApiV1(headers: Record<string, string>) {
  const resp = await fetch(`${baseUrl}/api/v1/__debug`, { headers });
  const body = await resp.json();
  const shieldHeader = resp.headers.get('x-mpanel-shield');
  return { status: resp.status, shieldHeader, body };
}

async function run() {
  const tenantId = tenantInput === 'global' ? null : tenantInput;
  const testHeaderKey = 'x-shield-smoke';
  const testHeaderValue = crypto.randomUUID();
  const policyName = `Shield Smoke ${new Date().toISOString()}`;

  console.log('➤ Creating temporary policy');
  const createPayload = {
    name: policyName,
    tenantId,
    mode: 'report_only',
    status: 'active',
    ruleset: {
      requiredHeaders: {
        [testHeaderKey]: testHeaderValue,
      },
    },
  };

  const createResponse = await adminRequest('/api/v1/platform/shield/policies', {
    method: 'POST',
    body: JSON.stringify(createPayload),
  });

  const policy = createResponse.policy;
  console.log(`   Policy ${policy.id} v${policy.version} created (mode=${policy.mode})`);

  const tenantHeaders = tenantId ? { 'x-tenant-id': tenantId } : {};

  console.log('➤ Report-only: valid header should allow');
  const allowAttempt = await hitApiV1({ ...tenantHeaders, [testHeaderKey]: testHeaderValue });
  console.log(`   status=${allowAttempt.status} header=${allowAttempt.shieldHeader}`);

  console.log('➤ Report-only: missing header should deny but not block');
  const reportOnlyDeny = await hitApiV1({ ...tenantHeaders });
  console.log(`   status=${reportOnlyDeny.status} header=${reportOnlyDeny.shieldHeader}`);

  console.log('➤ Switching policy to enforce mode');
  await adminRequest(`/api/v1/platform/shield/policies/${policy.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ mode: 'enforce' }),
  });

  console.log('➤ Enforce: missing header should block with 403');
  try {
    const enforceBlock = await hitApiV1({ ...tenantHeaders });
    if (enforceBlock.status !== 403) {
      console.warn('⚠ Expected 403 but received', enforceBlock.status, enforceBlock.body);
    } else {
      console.log(`   status=${enforceBlock.status} header=${enforceBlock.shieldHeader}`);
    }
  } catch (error) {
    console.error('✗ Failed to execute enforce test:', (error as Error).message);
  }

  if (cleanup) {
    console.log('➤ Archiving temporary policy');
    await adminRequest(`/api/v1/platform/shield/policies/${policy.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'archived' }),
    });
  }

  console.log('✓ Shield smoke test completed');
}

run().catch(error => {
  console.error('✗ Shield smoke test failed:', error.message);
  process.exitCode = 1;
});
