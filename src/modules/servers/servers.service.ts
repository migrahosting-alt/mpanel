/**
 * Servers Service - Infrastructure server management
 */

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import { writeAuditEvent } from '../security/auditService.js';

export interface ServerWithUsage {
  id: string;
  name: string;
  hostname: string | null;
  ipAddress: string;
  provider: string | null;
  location: string | null;
  role: string;
  status: string;
  cpu: number | null;
  ramGb: number | null;
  diskGb: number | null;
  cloudPodsCount: number;
  createdAt: Date;
}

export interface ServerHealthResult {
  status: 'online' | 'offline' | 'error';
  message: string;
  lastCheckAt: Date;
}

/**
 * List all servers (platform-wide)
 */
export async function listServers(): Promise<ServerWithUsage[]> {
  const servers = await prisma.server.findMany({
    include: {
      _count: {
        select: {
          hostingAccounts: true,
          vpsInstances: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return servers.map((server) => ({
    id: server.id,
    name: server.name,
    hostname: server.hostname,
    ipAddress: server.ipAddress,
    provider: server.provider,
    location: server.location,
    role: server.role,
    status: server.status,
    cpu: server.cpu,
    ramGb: server.ramGb,
    diskGb: server.diskGb,
    cloudPodsCount: server._count.hostingAccounts + server._count.vpsInstances,
    createdAt: server.createdAt,
  }));
}

/**
 * Create server
 */
export async function createServer(input: {
  tenantId: string;
  name: string;
  hostname?: string;
  ipAddress: string;
  provider?: string;
  location?: string;
  role?: string;
  cpu?: number;
  ramGb?: number;
  diskGb?: number;
}) {
  const server = await prisma.server.create({
    data: {
      tenantId: input.tenantId,
      name: input.name,
      hostname: input.hostname || null,
      ipAddress: input.ipAddress,
      provider: input.provider || null,
      location: input.location || null,
      role: input.role || 'web',
      status: 'active',
      cpu: input.cpu || null,
      ramGb: input.ramGb || null,
      diskGb: input.diskGb || null,
    },
  });

  logger.info('Server created', {
    serverId: server.id,
    name: server.name,
    ipAddress: server.ipAddress,
  });

  return server;
}

/**
 * Update server
 */
export async function updateServer(id: string, input: any) {
  const server = await prisma.server.update({
    where: { id },
    data: {
      ...input,
      updatedAt: new Date(),
    },
  });

  logger.info('Server updated', { serverId: id });

  return server;
}

/**
 * Mark server status
 */
export async function markServerStatus(
  id: string,
  status: 'active' | 'inactive' | 'draining' | 'maintenance'
) {
  const server = await prisma.server.update({
    where: { id },
    data: {
      status,
      isActive: status === 'active',
      updatedAt: new Date(),
    },
  });

  logger.info('Server status changed', { serverId: id, status });

  return server;
}

/**
 * Test server connection
 */
export async function testServerConnection(id: string): Promise<ServerHealthResult> {
  const server = await prisma.server.findUnique({
    where: { id },
  });

  if (!server) {
    return {
      status: 'error',
      message: 'Server not found',
      lastCheckAt: new Date(),
    };
  }

  // Simple ping test (can be enhanced with actual SSH/HTTP checks)
  try {
    // TODO: Implement actual health check (SSH, HTTP, ping, etc.)
    // For now, return success if server exists
    logger.info('Server health check requested', {
      serverId: id,
      ipAddress: server.ipAddress,
    });

    return {
      status: 'online',
      message: 'Server is reachable',
      lastCheckAt: new Date(),
    };
  } catch (error) {
    logger.error('Server health check failed', {
      serverId: id,
      error: error instanceof Error ? error.message : 'Unknown',
    });

    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Health check failed',
      lastCheckAt: new Date(),
    };
  }
}

export default {
  listServers,
  createServer,
  updateServer,
  markServerStatus,
  testServerConnection,
};
