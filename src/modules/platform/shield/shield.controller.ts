import { Request, Response } from 'express';
import logger from '../../../config/logger.js';
import { writeAuditEvent } from '../../security/auditService.js';
import {
  listPolicies,
  createPolicy,
  updatePolicy,
  listRecentDecisions,
} from '../../../services/shieldService.js';

const VALID_POLICY_MODES = new Set(['report_only', 'enforce']);
const VALID_POLICY_STATUSES = new Set(['active', 'inactive', 'archived', 'draft']);
const DEFAULT_MODE = 'report_only';
const DEFAULT_STATUS = 'active';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function sanitizeMode(input?: string | null) {
  if (!input) {
    return undefined;
  }
  if (!VALID_POLICY_MODES.has(input)) {
    throw new Error(`Invalid mode "${input}". Allowed: ${Array.from(VALID_POLICY_MODES).join(', ')}`);
  }
  return input;
}

function sanitizeStatus(input?: string | null) {
  if (!input) {
    return undefined;
  }
  if (!VALID_POLICY_STATUSES.has(input)) {
    throw new Error(
      `Invalid status "${input}". Allowed: ${Array.from(VALID_POLICY_STATUSES).join(', ')}`
    );
  }
  return input;
}

function parseRulesetPayload(
  input: unknown,
  options: { optional?: boolean } = {}
): Record<string, unknown> | undefined {
  const { optional = false } = options;

  if (input === undefined) {
    return optional ? undefined : {};
  }

  if (input === null) {
    return {};
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) {
      return optional ? undefined : {};
    }
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      throw new Error('Ruleset must be a valid JSON string');
    }
  }

  if (typeof input === 'object') {
    return input as Record<string, unknown>;
  }

  throw new Error('Ruleset must be an object or JSON string');
}

interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

export async function listShieldPolicies(req: AuthRequest, res: Response) {
  try {
    const rawTenant = typeof req.query.tenantId === 'string' ? req.query.tenantId.trim() : undefined;
    const tenantId = (() => {
      if (!rawTenant) return undefined;
      if (rawTenant === 'global') return null;
      return rawTenant;
    })();

    const policies = await listPolicies({ tenantId });
    res.json({ policies });
  } catch (error) {
    logger.error('Failed to list shield policies', { error: getErrorMessage(error) });
    res.status(500).json({ error: 'Failed to fetch shield policies' });
  }
}

export async function listShieldDecisions(req: AuthRequest, res: Response) {
  try {
    const rawLimit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;
    const limit = Number.isFinite(rawLimit) ? rawLimit : 25;
    const rawTenant = typeof req.query.tenantId === 'string' ? req.query.tenantId.trim() : undefined;
    const tenantId = (() => {
      if (!rawTenant) return undefined;
      if (rawTenant === 'global') return null;
      return rawTenant;
    })();

    const decisions = await listRecentDecisions({ limit, tenantId });
    res.json({ decisions });
  } catch (error) {
    logger.error('Failed to list shield decisions', { error: getErrorMessage(error) });
    res.status(500).json({ error: 'Failed to fetch shield decisions' });
  }
}

export async function createShieldPolicy(req: AuthRequest, res: Response) {
  try {
    const { name, tenantId = null, mode, ruleset, status, rolloutStage } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Policy name is required' });
    }

    let normalizedRuleset: Record<string, unknown>;
    let normalizedMode: string;
    let normalizedStatus: string;

    try {
      normalizedRuleset = parseRulesetPayload(ruleset) ?? {};
      normalizedMode = sanitizeMode(mode) ?? DEFAULT_MODE;
      normalizedStatus = sanitizeStatus(status) ?? DEFAULT_STATUS;
    } catch (validationError) {
      return res.status(400).json({ error: validationError instanceof Error ? validationError.message : 'Invalid payload' });
    }

    const policy = await createPolicy({
      name,
      tenantId,
      mode: normalizedMode,
      ruleset: normalizedRuleset,
      status: normalizedStatus,
      rolloutStage,
      createdBy: req.user?.userId || null,
    });

    await writeAuditEvent({
      actorUserId: req.user?.userId || null,
      tenantId,
      type: 'SHIELD_POLICY_CREATED',
      metadata: {
        policyId: policy.id,
        mode: policy.mode,
        version: policy.version,
      },
    });

    res.status(201).json({ policy });
  } catch (error) {
    logger.error('Failed to create shield policy', { error: getErrorMessage(error) });
    res.status(500).json({ error: 'Failed to create shield policy' });
  }
}

export async function updateShieldPolicy(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { name, status, mode, ruleset, rolloutStage } = req.body;

    let normalizedMode: string | undefined;
    let normalizedStatus: string | undefined;
    let normalizedRuleset: Record<string, unknown> | undefined;

    try {
      normalizedMode = sanitizeMode(mode);
      normalizedStatus = sanitizeStatus(status);
      normalizedRuleset = parseRulesetPayload(ruleset, { optional: true });
    } catch (validationError) {
      return res.status(400).json({ error: validationError instanceof Error ? validationError.message : 'Invalid payload' });
    }

    const policy = await updatePolicy(id, {
      name,
      status: normalizedStatus,
      mode: normalizedMode,
      ruleset: normalizedRuleset,
      rolloutStage,
    });

    await writeAuditEvent({
      actorUserId: req.user?.userId || null,
      tenantId: policy.tenantId,
      type: 'SHIELD_POLICY_UPDATED',
      metadata: {
        policyId: policy.id,
        status: policy.status,
        mode: policy.mode,
      },
    });

    res.json({ policy });
  } catch (error) {
    logger.error('Failed to update shield policy', { error: getErrorMessage(error) });
    res.status(500).json({ error: 'Failed to update shield policy' });
  }
}
