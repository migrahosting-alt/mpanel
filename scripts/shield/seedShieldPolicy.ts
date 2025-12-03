#!/usr/bin/env tsx
/**
 * Shield Policy Seeder
 * -------------------------------------------
 * Usage examples:
 *   tsx scripts/shield/seedShieldPolicy.ts --tenant=global --preset=baseline
 *   tsx scripts/shield/seedShieldPolicy.ts --tenant=3c3d... --name="Tenant 123" --mode=enforce --ruleset=@./rules/pci.json
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_RULESET = {
  allowedOrigins: ['https://panel.migrahosting.com'],
  blockedIps: [],
  requiredHeaders: {
    'x-api-key': 'required',
  },
};

const PRESET_RULESETS: Record<string, Record<string, unknown>> = {
  baseline: DEFAULT_RULESET,
  locked_down: {
    allowedOrigins: ['https://panel.migrahosting.com'],
    allowedIps: ['127.0.0.1'],
    requiredHeaders: {
      'x-api-key': 'required',
      'x-device-trust': 'verified',
    },
  },
};

type ArgMap = Record<string, string>;

function parseArgs(): ArgMap {
  const args: ArgMap = {};
  for (const token of process.argv.slice(2)) {
    const [rawKey, ...rest] = token.split('=');
    const key = rawKey.trim();
    const value = rest.join('=');
    args[key] = value ?? 'true';
  }
  return args;
}

function loadRuleset(args: ArgMap): Record<string, unknown> {
  if (args['--preset']) {
    const presetName = args['--preset'];
    const preset = PRESET_RULESETS[presetName];
    if (!preset) {
      throw new Error(`Unknown preset "${presetName}"`);
    }
    return preset;
  }

  const raw = args['--ruleset'];
  if (!raw) {
    return DEFAULT_RULESET;
  }

  if (raw.startsWith('@')) {
    const resolvedPath = path.resolve(process.cwd(), raw.replace(/^@/, ''));
    const fileContents = fs.readFileSync(resolvedPath, 'utf8');
    return JSON.parse(fileContents);
  }

  return JSON.parse(raw);
}

async function main() {
  const args = parseArgs();

  if (args['--help']) {
    console.log(`Shield Policy Seeder\n\n` +
      `Flags:\n` +
      `  --tenant=<uuid|global>    Tenant scoped policy (default: global)\n` +
      `  --name="Policy Name"      Name of the policy\n` +
      `  --mode=<report_only|enforce>\n` +
      `  --status=<active|inactive|archived|draft> (default: active)\n` +
      `  --preset=<baseline|locked_down> Use built-in rules\n` +
      `  --ruleset=@path/to/file.json  Load JSON rules from disk\n` +
      `  --ruleset='<json>'          Inline JSON ruleset\n`);
    return;
  }

  const tenantInput = args['--tenant'] ?? 'global';
  const tenantId = tenantInput === 'global' ? null : tenantInput;
  const name = args['--name'] ?? (tenantId ? `Shield Policy for ${tenantInput}` : 'Global Shield Baseline');
  const mode = args['--mode'] ?? 'report_only';
  const status = args['--status'] ?? 'active';
  const rolloutStage = args['--rollout'] ?? null;
  const createdBy = args['--created-by'] ?? 'shield-seeder-script';
  const ruleset = loadRuleset(args);

  const policy = await prisma.shieldPolicy.create({
    data: {
      tenantId,
      name,
      mode,
      status,
      rolloutStage,
      ruleset,
      createdBy,
    },
  });

  console.log('✓ Shield policy created');
  console.table({
    id: policy.id,
    tenantId: policy.tenantId ?? 'global',
    mode: policy.mode,
    version: policy.version,
    status: policy.status,
  });
}

main()
  .catch(error => {
    console.error('✗ Failed to seed policy:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
