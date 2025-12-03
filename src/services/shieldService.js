import crypto from 'crypto';
import { prisma } from '../config/database.js';
import logger from '../config/logger.js';

const POLICY_CACHE_TTL_MS = 60 * 1000; // 1 minute cache window
const policyCache = new Map();
const decisionHashCache = new Map();

function cacheKeyForTenant(tenantId) {
  return tenantId || 'global';
}

function setCache(key, value) {
  policyCache.set(key, {
    value,
    expiresAt: Date.now() + POLICY_CACHE_TTL_MS,
  });
}

function getCachedPolicy(key) {
  const cached = policyCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  policyCache.delete(key);
  return null;
}

export function clearPolicyCache(tenantId) {
  if (tenantId) {
    policyCache.delete(cacheKeyForTenant(tenantId));
  }
  policyCache.delete(cacheKeyForTenant(null));
}

export async function getActivePolicyForTenant(tenantId) {
  const key = cacheKeyForTenant(tenantId);
  const cached = getCachedPolicy(key);
  if (cached !== null && cached !== undefined) {
    return cached;
  }

  const policy = await prisma.shieldPolicy.findFirst({
    where: {
      tenantId,
      status: 'active',
    },
    orderBy: { version: 'desc' },
  });

  if (!policy && tenantId) {
    // fallback to global policy
    const globalPolicy = await getActivePolicyForTenant(null);
    setCache(key, globalPolicy ?? null);
    return globalPolicy;
  }

  setCache(key, policy ?? null);
  return policy;
}

export async function listPolicies({ tenantId } = {}) {
  let where = {};
  if (tenantId === null) {
    where = { tenantId: null };
  } else if (tenantId) {
    where = { tenantId };
  }

  const policies = await prisma.shieldPolicy.findMany({
    where,
    orderBy: [{ tenantId: 'asc' }, { version: 'desc' }],
  });
  return policies;
}

export async function createPolicy(data) {
  const { tenantId = null } = data;
  const latest = await prisma.shieldPolicy.findFirst({
    where: { tenantId },
    orderBy: { version: 'desc' },
  });
  const nextVersion = latest ? latest.version + 1 : 1;

  const policy = await prisma.shieldPolicy.create({
    data: {
      tenantId,
      name: data.name,
      version: nextVersion,
      status: data.status || 'active',
      mode: data.mode || 'report_only',
      rolloutStage: data.rolloutStage || null,
      ruleset: data.ruleset || {},
      createdBy: data.createdBy || null,
    },
  });

  clearPolicyCache(tenantId);
  logger.info('Shield policy created', { tenantId, policyId: policy.id, version: nextVersion });
  return policy;
}

export async function updatePolicy(policyId, updates = {}) {
  const policy = await prisma.shieldPolicy.update({
    where: { id: policyId },
    data: {
      name: updates.name ?? undefined,
      status: updates.status ?? undefined,
      mode: updates.mode ?? undefined,
      rolloutStage: updates.rolloutStage ?? undefined,
      ruleset: updates.ruleset ?? undefined,
    },
  });

  clearPolicyCache(policy.tenantId);
  logger.info('Shield policy updated', { policyId, tenantId: policy.tenantId });
  return policy;
}

export async function listRecentDecisions({ tenantId, limit = 25 } = {}) {
  const parsedLimit = Math.min(Math.max(limit, 1), 50);
  const where = {};

  if (tenantId === null) {
    where.tenantId = null;
  } else if (tenantId) {
    where.tenantId = tenantId;
  }

  const decisions = await prisma.shieldDecision.findMany({
    where,
    take: parsedLimit,
    orderBy: { createdAt: 'desc' },
    include: {
      policy: {
        select: {
          id: true,
          name: true,
          version: true,
          tenantId: true,
        },
      },
    },
  });

  return decisions;
}

function buildDecisionHashPayload(decision) {
  return JSON.stringify({
    tenantId: decision.tenantId ?? null,
    requestId: decision.requestId ?? null,
    result: decision.result,
    reason: decision.reason,
    mode: decision.mode,
    policyVersion: decision.policyVersion,
    context: decision.context || {},
  });
}

export async function recordShieldDecision(decision) {
  try {
    const cacheKey = cacheKeyForTenant(decision.tenantId);
    const previousHash = decisionHashCache.get(cacheKey) || null;
    const payload = buildDecisionHashPayload(decision);
    const hash = crypto.createHash('sha256').update(`${previousHash ?? ''}${payload}`).digest('hex');

    const created = await prisma.shieldDecision.create({
      data: {
        policyId: decision.policyId || null,
        tenantId: decision.tenantId || null,
        requestId: decision.requestId || null,
        result: decision.result,
        reason: decision.reason || null,
        mode: decision.mode || 'report_only',
        policyVersion: decision.policyVersion || null,
        context: decision.context || {},
        hash,
        prevHash: previousHash,
      },
    });

    decisionHashCache.set(cacheKey, hash);
    return created;
  } catch (error) {
    logger.error('Failed to record shield decision', { error: error.message });
    return null;
  }
}

export function rememberDecisionHash(tenantId, hash) {
  decisionHashCache.set(cacheKeyForTenant(tenantId), hash);
}
