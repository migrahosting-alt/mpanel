import type { Request, Response } from 'express';
import logger from '../../config/logger.js';
import { writeAuditEvent } from '../security/auditService.js';
import * as serversService from './servers.service.js';

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

export async function listServers(req: AuthenticatedRequest, res: Response) {
  try {
    const { status, type } = req.query;
    
    const servers = await serversService.listServers({
      status: typeof status === 'string' ? status : undefined,
      type: typeof type === 'string' ? type : undefined,
    });

    return res.json({ success: true, data: servers });
  } catch (error) {
    return handleError(res, error, 'Failed to list servers');
  }
}

export async function getServer(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const server = await serversService.getServer(id);

    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }

    return res.json({ success: true, data: server });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch server');
  }
}

export async function getServerMetrics(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { timeRange } = req.query;

    const metrics = await serversService.getServerMetrics(
      id,
      typeof timeRange === 'string' ? timeRange : '1h'
    );

    return res.json({ success: true, data: metrics });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch metrics');
  }
}

export async function runHealthCheck(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const result = await serversService.runHealthCheck(id);

    await writeAuditEvent({
      actorUserId: req.user?.userId ?? null,
      tenantId: null,
      type: 'SERVER_HEALTH_CHECK',
      metadata: { serverId: id },
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error, 'Health check failed');
  }
}

export async function restartService(req: AuthenticatedRequest, res: Response) {
  try {
    const { id, service } = req.params;
    const result = await serversService.restartService(id, service);

    await writeAuditEvent({
      actorUserId: req.user?.userId ?? null,
      tenantId: null,
      type: 'SERVICE_RESTARTED',
      metadata: { serverId: id, service },
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error, 'Service restart failed');
  }
}

export async function getGuardianStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const status = await serversService.getGuardianStatus(id);

    return res.json({ success: true, data: status });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch Guardian status');
  }
}

export default {
  listServers,
  getServer,
  getServerMetrics,
  runHealthCheck,
  restartService,
  getGuardianStatus,
};
