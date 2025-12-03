/**
 * MODULE_SERVERS Service
 * Business logic for server management (NO direct SSH - queue-based provisioning)
 */

import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import type {
  Server,
  CreateServerRequest,
  ListServersQuery,
  ServerWithCounts,
  ServerAction,
} from './servers.types.js';

/**
 * List servers with filters and pagination
 */
export async function listServers(
  query: ListServersQuery,
  actorTenantId: string | null,
  isPlatformAdmin: boolean
): Promise<{ servers: Server[]; total: number }> {
  const { role, status, search, tenantId, page = 1, pageSize = 20 } = query;

  const where: any = {};

  // Multi-tenancy: scope to tenant unless platform admin viewing all
  if (!isPlatformAdmin) {
    where.tenantId = actorTenantId;
  } else if (tenantId) {
    where.tenantId = tenantId;
  }

  if (role) where.role = role;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
      { publicIp: { contains: search } },
      { privateIp: { contains: search } },
    ];
  }

  const [servers, total] = await Promise.all([
    prisma.server.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.server.count({ where }),
  ]);

  return { servers: servers as Server[], total };
}

/**
 * Get server by ID with related counts
 */
export async function getServerById(
  id: string,
  actorTenantId: string | null,
  isPlatformAdmin: boolean
): Promise<ServerWithCounts | null> {
  const where: any = { id };

  if (!isPlatformAdmin) {
    where.tenantId = actorTenantId;
  }

  const server = await prisma.server.findFirst({ where });

  if (!server) return null;

  // Get related counts (websites, databases, backups)
  // Note: These tables may not exist yet - use try/catch
  let websiteCount = 0;
  let databaseCount = 0;
  let backupCount = 0;

  try {
    // @ts-ignore - Website table may not exist yet
    websiteCount = await prisma.website.count({ where: { serverId: id } });
  } catch {}

  try {
    // @ts-ignore - Database table may not exist yet
    databaseCount = await prisma.database.count({
      where: { databaseServer: { serverId: id } },
    });
  } catch {}

  try {
    // @ts-ignore - Backup table may not exist yet
    backupCount = await prisma.backup.count({ where: { serverId: id } });
  } catch {}

  return {
    ...(server as Server),
    websiteCount,
    databaseCount,
    backupCount,
  };
}

/**
 * Create server (enqueues provisioning job)
 */
export async function createServer(
  data: CreateServerRequest,
  actorTenantId: string | null,
  actorId: string
): Promise<{ server: Server; jobId: string }> {
  const { name, role, type, provider, targetClusterId, templateId, region, plan, tenantId } = data;

  // Generate unique slug
  const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  // Create server in PENDING state
  const server = await prisma.server.create({
    data: {
      tenantId: tenantId || actorTenantId,
      name,
      slug,
      role,
      type,
      provider,
      region: region || null,
      status: 'PENDING',
      guardianStatus: 'NOT_SCANNED',
      maintenanceMode: false,
      metadata: {
        targetClusterId,
        templateId,
        plan,
      },
    },
  });

  // Enqueue provisioning job
  const job = await prisma.job.create({
    data: {
      tenantId: tenantId || actorTenantId,
      type: 'provision.server',
      status: 'pending',
      payload: {
        serverId: server.id,
        targetClusterId,
        templateId,
        plan,
        region,
      },
      createdBy: actorId,
    },
  });

  logger.info('Server created, provisioning job enqueued', {
    serverId: server.id,
    jobId: job.id,
    tenantId: server.tenantId,
  });

  return { server: server as Server, jobId: job.id };
}

/**
 * Execute server action (reboot, shutdown, maintenance, guardian scan, etc)
 */
export async function executeServerAction(
  id: string,
  action: ServerAction,
  actorTenantId: string | null,
  actorId: string,
  isPlatformAdmin: boolean
): Promise<{ server: Server; jobId?: string }> {
  const where: any = { id };

  if (!isPlatformAdmin) {
    where.tenantId = actorTenantId;
  }

  const server = await prisma.server.findFirst({ where });

  if (!server) {
    throw new Error('Server not found or access denied');
  }

  // Handle maintenance mode toggles (immediate)
  if (action === 'enable_maintenance') {
    const updated = await prisma.server.update({
      where: { id },
      data: { maintenanceMode: true },
    });
    return { server: updated as Server };
  }

  if (action === 'disable_maintenance') {
    const updated = await prisma.server.update({
      where: { id },
      data: { maintenanceMode: false },
    });
    return { server: updated as Server };
  }

  // Guardian scan request (emit event, no job needed if Guardian worker picks up events)
  if (action === 'run_guardian_scan') {
    // TODO: Emit guardian.scan.requested event
    logger.info('Guardian scan requested for server', { serverId: id });
    return { server: server as Server };
  }

  // Power operations: enqueue job
  const job = await prisma.job.create({
    data: {
      tenantId: server.tenantId,
      type: `server.action.${action}`,
      status: 'pending',
      payload: {
        serverId: id,
        action,
      },
      createdBy: actorId,
    },
  });

  logger.info('Server action enqueued', { serverId: id, action, jobId: job.id });

  return { server: server as Server, jobId: job.id };
}

/**
 * Delete server (soft-delete, enqueue deprovision job)
 */
export async function deleteServer(
  id: string,
  actorTenantId: string | null,
  actorId: string,
  isPlatformAdmin: boolean
): Promise<{ server: Server; jobId: string }> {
  const where: any = { id };

  if (!isPlatformAdmin) {
    where.tenantId = actorTenantId;
  }

  const server = await prisma.server.findFirst({ where });

  if (!server) {
    throw new Error('Server not found or access denied');
  }

  // Mark as DELETING
  const updated = await prisma.server.update({
    where: { id },
    data: { status: 'DELETING' },
  });

  // Enqueue deprovision job
  const job = await prisma.job.create({
    data: {
      tenantId: server.tenantId,
      type: 'provision.server.deprovision',
      status: 'pending',
      payload: {
        serverId: id,
      },
      createdBy: actorId,
    },
  });

  logger.info('Server deletion initiated', { serverId: id, jobId: job.id });

  return { server: updated as Server, jobId: job.id };
}
