/**
 * SECURITY CENTER Controller
 */

import type { Request, Response, NextFunction } from 'express';
import * as securityCenterService from './security-center.service.js';
import type {
  EnableMfaRequest,
  ConfirmMfaRequest,
  CreateApiTokenRequest,
  UpdateSecurityPolicyRequest,
} from './security-center.types.js';

export async function handleGetSecurityProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const profile = await securityCenterService.getSecurityProfile(userId);
    return res.json(profile || {});
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleEnableMfa(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const data: EnableMfaRequest = req.body;
    const result = await securityCenterService.enableMfa(userId, data);
    return res.json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleConfirmMfa(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const profile = await securityCenterService.confirmMfa(userId);
    return res.json(profile);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleDisableMfa(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const profile = await securityCenterService.disableMfa(userId);
    return res.json(profile);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleListSessions(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const sessions = await securityCenterService.listSessions(userId);
    return res.json(sessions);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleRevokeSession(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { sessionId } = req.params;
    const session = await securityCenterService.revokeSession(sessionId, userId);
    return res.json(session);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleRevokeAllSessions(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const currentSessionId = (req as any).sessionId || null;
    const count = await securityCenterService.revokeAllSessions(userId, currentSessionId, userId);
    return res.json({ revokedCount: count });
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleListApiTokens(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const tokens = await securityCenterService.listApiTokens(userId);
    return res.json(tokens);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleCreateApiToken(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const data: CreateApiTokenRequest = req.body;
    const result = await securityCenterService.createApiToken(userId, data);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleRevokeApiToken(req: Request, res: Response, next: NextFunction) {
  try {
    const { tokenId } = req.params;
    const token = await securityCenterService.revokeApiToken(tokenId);
    return res.json(token);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleListSecurityEvents(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const events = await securityCenterService.listSecurityEvents(userId, limit);
    return res.json(events);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleGetSecurityPolicy(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const policy = await securityCenterService.getTenantSecurityPolicy(tenantId);
    return res.json(policy || {});
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleUpdateSecurityPolicy(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.id;
    const tenantId = (req as any).user?.tenantId;
    if (!userId || !tenantId) {
      return res.status(400).json({ error: 'User and tenant required' });
    }

    const data: UpdateSecurityPolicyRequest = req.body;
    const policy = await securityCenterService.updateTenantSecurityPolicy(tenantId, data, userId);
    return res.json(policy);
  } catch (error) {
    return next(error);
    next(error);
  }
}
