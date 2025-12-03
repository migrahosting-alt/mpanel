/**
 * MODULE_SERVERS Controller
 * HTTP handlers for server management
 */

import type { Request, Response, NextFunction } from 'express';
import * as serversService from './servers.service.js';
import type { CreateServerRequest, ServerActionRequest, ListServersQuery } from './servers.types.js';

/**
 * GET /api/hosting/servers
 */
export async function handleListServers(req: Request, res: Response, next: NextFunction) {
  try {
    const query: ListServersQuery = {
      role: req.query.role as any,
      status: req.query.status as any,
      search: req.query.search as string,
      tenantId: req.query.tenantId as string,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20,
    };

    const actorTenantId = (req as any).tenantId || null;
    const isPlatformAdmin = (req as any).user?.platformAdmin || false;

    const result = await serversService.listServers(query, actorTenantId, isPlatformAdmin);

    return res.json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

/**
 * GET /api/hosting/servers/:id
 */
export async function handleGetServer(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorTenantId = (req as any).tenantId || null;
    const isPlatformAdmin = (req as any).user?.platformAdmin || false;

    const server = await serversService.getServerById(id, actorTenantId, isPlatformAdmin);

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    return res.json(server);
  } catch (error) {
    return next(error);
    next(error);
  }
}

/**
 * POST /api/hosting/servers
 */
export async function handleCreateServer(req: Request, res: Response, next: NextFunction) {
  try {
    const data: CreateServerRequest = req.body;
    const actorTenantId = (req as any).tenantId || null;
    const actorId = (req as any).user?.id;

    if (!actorId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await serversService.createServer(data, actorTenantId, actorId);

    return res.status(201).json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

/**
 * POST /api/hosting/servers/:id/actions
 */
export async function handleServerAction(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { action }: ServerActionRequest = req.body;
    const actorTenantId = (req as any).tenantId || null;
    const actorId = (req as any).user?.id;
    const isPlatformAdmin = (req as any).user?.platformAdmin || false;

    if (!actorId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!action) {
      return res.status(400).json({ error: 'Action is required' });
    }

    const result = await serversService.executeServerAction(
      id,
      action,
      actorTenantId,
      actorId,
      isPlatformAdmin
    );

    return res.json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

/**
 * DELETE /api/hosting/servers/:id
 */
export async function handleDeleteServer(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorTenantId = (req as any).tenantId || null;
    const actorId = (req as any).user?.id;
    const isPlatformAdmin = (req as any).user?.platformAdmin || false;

    if (!actorId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await serversService.deleteServer(id, actorTenantId, actorId, isPlatformAdmin);

    return res.json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}
