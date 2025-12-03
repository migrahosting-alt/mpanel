/**
 * MODULE_FILE_MANAGER Service
 */

import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import type { FileNode, BrowseQuery, FileOperationRequest } from './fileManager.types.js';

export async function browseFiles(
  query: BrowseQuery,
  actorTenantId: string
): Promise<FileNode[]> {
  const { serverId, root, path } = query;

  // Verify server access
  const server = await prisma.server.findFirst({
    where: { id: serverId, tenantId: actorTenantId },
  });

  if (!server) {
    throw new Error('Server not found or access denied');
  }

  // TODO: Call file service API on server to list files
  // For now, return placeholder structure

  logger.debug('File browse request', { serverId, root, path });

  return [];
}

export async function executeFileOperation(
  data: FileOperationRequest,
  serverId: string,
  root: string,
  actorTenantId: string,
  actorId: string
): Promise<{ jobId: string }> {
  // Verify server access
  const server = await prisma.server.findFirst({
    where: { id: serverId, tenantId: actorTenantId },
  });

  if (!server) {
    throw new Error('Server not found or access denied');
  }

  const { operation, args } = data;

  // Create file operation job
  const job = await prisma.job.create({
    data: {
      tenantId: actorTenantId,
      type: `file.${operation}`,
      status: 'pending',
      payload: {
        serverId,
        root,
        operation,
        args,
      },
      createdBy: actorId,
    },
  });

  logger.info('File operation enqueued', { jobId: job.id, operation });

  return { jobId: job.id };
}
