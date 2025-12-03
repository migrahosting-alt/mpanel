/**
 * Servers Controller - Platform server management
 */

import { Request, Response } from 'express';
import * as serversService from './servers.service.js';
import { writeAuditEvent } from '../security/auditService.js';
import logger from '../../config/logger.js';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    tenantId: string;
    role: string;
  };
}

/**
 * GET /api/platform/servers - List servers
 */
export async function listServers(req: AuthRequest, res: Response) {
  try {
    const servers = await serversService.listServers();

    await writeAuditEvent({
      actorUserId: req.user!.id,
      tenantId: null,
      type: 'PLATFORM_SERVERS_LISTED',
      metadata: { count: servers.length },
    });

    return res.json({
      success: true,
      data: servers,
    });
  } catch (error) {
    logger.error('Error listing servers', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to list servers',
    });
  }
}

/**
 * POST /api/platform/servers - Create server
 */
export async function createServer(req: AuthRequest, res: Response) {
  try {
    const {
      name,
      hostname,
      ipAddress,
      provider,
      location,
      role,
      cpu,
      ramGb,
      diskGb,
    } = req.body;

    if (!name || !ipAddress) {
      return res.status(400).json({
        success: false,
        error: 'Name and IP address are required',
      });
    }

    // Use first tenant or create platform-level tenant
    const tenantId = req.user!.tenantId;

    const server = await serversService.createServer({
      tenantId,
      name,
      hostname,
      ipAddress,
      provider,
      location,
      role,
      cpu,
      ramGb,
      diskGb,
    });

    await writeAuditEvent({
      actorUserId: req.user!.id,
      tenantId: null,
      type: 'PLATFORM_SERVER_CREATED',
      metadata: {
        serverId: server.id,
        name: server.name,
        ipAddress: server.ipAddress,
      },
    });

    return res.status(201).json({
      success: true,
      data: server,
    });
  } catch (error) {
    logger.error('Error creating server', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to create server',
    });
  }
}

/**
 * PATCH /api/platform/servers/:id - Update server
 */
export async function updateServer(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const server = await serversService.updateServer(id, req.body);

    await writeAuditEvent({
      actorUserId: req.user!.id,
      tenantId: null,
      type: 'PLATFORM_SERVER_UPDATED',
      metadata: { serverId: id },
    });

    return res.json({
      success: true,
      data: server,
    });
  } catch (error) {
    logger.error('Error updating server', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to update server',
    });
  }
}

/**
 * POST /api/platform/servers/:id/status - Change status
 */
export async function changeStatus(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive', 'draining', 'maintenance'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be: active, inactive, draining, or maintenance',
      });
    }

    const server = await serversService.markServerStatus(id, status);

    await writeAuditEvent({
      actorUserId: req.user!.id,
      tenantId: null,
      type: 'PLATFORM_SERVER_STATUS_CHANGED',
      metadata: { serverId: id, status },
    });

    return res.json({
      success: true,
      data: server,
    });
  } catch (error) {
    logger.error('Error changing server status', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to change server status',
    });
  }
}

/**
 * POST /api/platform/servers/:id/test-connection - Test connection
 */
export async function testConnection(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const result = await serversService.testServerConnection(id);

    await writeAuditEvent({
      actorUserId: req.user!.id,
      tenantId: null,
      type: 'PLATFORM_SERVER_HEALTH_CHECKED',
      metadata: { serverId: id, status: result.status },
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error testing server connection', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to test connection',
    });
  }
}

export default {
  listServers,
  createServer,
  updateServer,
  changeStatus,
  testConnection,
};
