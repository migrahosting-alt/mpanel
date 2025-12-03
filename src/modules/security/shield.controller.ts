import type { Request, Response } from 'express';
import logger from '../../config/logger.js';
import { writeAuditEvent } from './auditService.js';
import * as shieldService from './shield.service.js';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    tenantId?: string;
    role: string;
  };
}

function handleError(res: Response, error: unknown, message = 'Unexpected error') {
  logger.error(message, { error: error instanceof Error ? error.message : error });
  return res.status(500).json({ success: false, error: message });
}

export async function listPolicies(req: AuthenticatedRequest, res: Response) {
  try {
    const { type, status } = req.query;
    const policies = await shieldService.listPolicies({
      type: typeof type === 'string' ? type : undefined,
      status: typeof status === 'string' ? status : undefined,
    });

    return res.json({ success: true, data: policies });
  } catch (error) {
    return handleError(res, error, 'Failed to list policies');
  }
}

export async function getPolicy(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const policy = await shieldService.getPolicy(id);

    if (!policy) {
      return res.status(404).json({ success: false, error: 'Policy not found' });
    }

    return res.json({ success: true, data: policy });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch policy');
  }
}

export async function createPolicy(req: AuthenticatedRequest, res: Response) {
  try {
    const { name, type, rules } = req.body ?? {};

    if (!name || !type) {
      return res.status(400).json({ success: false, error: 'Name and type are required' });
    }

    const policy = await shieldService.createPolicy({
      name,
      type,
      rules: rules ?? [],
    });

    await writeAuditEvent({
      actorUserId: req.user?.userId ?? null,
      tenantId: null,
      type: 'SHIELD_POLICY_CREATED',
      metadata: { policyId: policy.id, name: policy.name },
    });

    return res.status(201).json({ success: true, data: policy });
  } catch (error) {
    return handleError(res, error, 'Failed to create policy');
  }
}

export async function updatePolicy(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const policy = await shieldService.updatePolicy(id, req.body ?? {});

    await writeAuditEvent({
      actorUserId: req.user?.userId ?? null,
      tenantId: null,
      type: 'SHIELD_POLICY_UPDATED',
      metadata: { policyId: id },
    });

    return res.json({ success: true, data: policy });
  } catch (error) {
    return handleError(res, error, 'Failed to update policy');
  }
}

export async function deletePolicy(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    await shieldService.deletePolicy(id);

    await writeAuditEvent({
      actorUserId: req.user?.userId ?? null,
      tenantId: null,
      type: 'SHIELD_POLICY_DELETED',
      metadata: { policyId: id },
    });

    return res.json({ success: true });
  } catch (error) {
    return handleError(res, error, 'Failed to delete policy');
  }
}

export async function listWAFRules(req: AuthenticatedRequest, res: Response) {
  try {
    const rules = await shieldService.listWAFRules();
    return res.json({ success: true, data: rules });
  } catch (error) {
    return handleError(res, error, 'Failed to list WAF rules');
  }
}

export async function createWAFRule(req: AuthenticatedRequest, res: Response) {
  try {
    const { name, pattern, action } = req.body ?? {};

    if (!name || !pattern || !action) {
      return res.status(400).json({ success: false, error: 'Name, pattern, and action are required' });
    }

    const rule = await shieldService.createWAFRule({
      name,
      pattern,
      action,
    });

    return res.status(201).json({ success: true, data: rule });
  } catch (error) {
    return handleError(res, error, 'Failed to create WAF rule');
  }
}

export async function deleteWAFRule(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    await shieldService.deleteWAFRule(id);

    return res.json({ success: true });
  } catch (error) {
    return handleError(res, error, 'Failed to delete WAF rule');
  }
}

export async function listSecurityEvents(req: AuthenticatedRequest, res: Response) {
  try {
    const { severity, page, pageSize } = req.query;
    
    const events = await shieldService.listSecurityEvents({
      severity: typeof severity === 'string' ? severity : undefined,
      page: typeof page === 'string' ? parseInt(page, 10) : undefined,
      pageSize: typeof pageSize === 'string' ? parseInt(pageSize, 10) : undefined,
    });

    return res.json({ success: true, ...events });
  } catch (error) {
    return handleError(res, error, 'Failed to list security events');
  }
}

export async function getSecurityEvent(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const event = await shieldService.getSecurityEvent(id);

    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    return res.json({ success: true, data: event });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch security event');
  }
}

export async function getShieldAnalytics(req: AuthenticatedRequest, res: Response) {
  try {
    const { timeRange } = req.query;
    
    const analytics = await shieldService.getShieldAnalytics(
      typeof timeRange === 'string' ? timeRange : '24h'
    );

    return res.json({ success: true, data: analytics });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch analytics');
  }
}

export default {
  listPolicies,
  getPolicy,
  createPolicy,
  updatePolicy,
  deletePolicy,
  listWAFRules,
  createWAFRule,
  deleteWAFRule,
  listSecurityEvents,
  getSecurityEvent,
  getShieldAnalytics,
};
