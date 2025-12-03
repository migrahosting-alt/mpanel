/**
 * MODULE_DATABASES Service
 */

import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import type { Database, CreateDatabaseRequest } from './databases.types.js';

export async function listDatabases(actorTenantId: string): Promise<Database[]> {
  try {
    // @ts-ignore
    const databases = await prisma.database.findMany({
      where: { tenantId: actorTenantId },
      orderBy: { createdAt: 'desc' },
    });
    return databases;
  } catch {
    return [];
  }
}

export async function getDatabaseById(id: string, actorTenantId: string): Promise<Database | null> {
  try {
    // @ts-ignore
    const database = await prisma.database.findFirst({
      where: { id, tenantId: actorTenantId },
    });
    return database;
  } catch {
    return null;
  }
}

export async function createDatabase(
  data: CreateDatabaseRequest,
  actorTenantId: string,
  actorId: string
): Promise<{ database: Database; jobId: string }> {
  const { databaseServerId, name, charset, collation, associatedWebsiteId, createUser } = data;

  // Get default database server for tenant if not specified
  let finalServerId = databaseServerId;
  if (!finalServerId) {
    // @ts-ignore
    const defaultServer = await prisma.databaseServer.findFirst({
      where: {
        OR: [{ tenantId: actorTenantId }, { tenantId: null }],
        defaultForTenant: true,
      },
    });

    if (!defaultServer) {
      throw new Error('No database server available');
    }

    finalServerId = defaultServer.id;
  }

  // @ts-ignore
  const database = await prisma.database.create({
    data: {
      tenantId: actorTenantId,
      databaseServerId: finalServerId,
      name,
      charset: charset || 'utf8mb4',
      collation: collation || 'utf8mb4_unicode_ci',
      associatedWebsiteId: associatedWebsiteId || null,
      status: 'ACTIVE',
    },
  });

  const job = await prisma.job.create({
    data: {
      tenantId: actorTenantId,
      type: 'database.create',
      status: 'pending',
      payload: {
        databaseId: database.id,
        createUser,
      },
      createdBy: actorId,
    },
  });

  logger.info('Database created, provisioning job enqueued', {
    databaseId: database.id,
    jobId: job.id,
  });

  return { database, jobId: job.id };
}

export async function deleteDatabase(
  id: string,
  actorTenantId: string,
  actorId: string
): Promise<{ jobId: string }> {
  try {
    // @ts-ignore
    const database = await prisma.database.update({
      where: { id, tenantId: actorTenantId },
      data: { status: 'DELETING' },
    });

    const job = await prisma.job.create({
      data: {
        tenantId: actorTenantId,
        type: 'database.delete',
        status: 'pending',
        payload: {
          databaseId: id,
          autoBackupFirst: true,
        },
        createdBy: actorId,
      },
    });

    logger.info('Database deletion initiated', { databaseId: id, jobId: job.id });

    return { jobId: job.id };
  } catch (error) {
    throw new Error('Database deletion failed');
  }
}
