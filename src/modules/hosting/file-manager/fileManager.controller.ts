/**
 * MODULE_FILE_MANAGER Controller
 */

import type { Request, Response, NextFunction } from 'express';
import * as fileManagerService from './fileManager.service.js';
import type { BrowseQuery, FileOperationRequest } from './fileManager.types.js';

export async function handleBrowseFiles(req: Request, res: Response, next: NextFunction) {
  try {
    const query: BrowseQuery = {
      serverId: req.query.serverId as string,
      root: req.query.root as string,
      path: req.query.path as string,
    };

    if (!query.serverId || !query.root || !query.path) {
      return res.status(400).json({ error: 'serverId, root, and path are required' });
    }

    const actorTenantId = (req as any).tenantId;
    const files = await fileManagerService.browseFiles(query, actorTenantId);

    return res.json(files);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleFileOperation(req: Request, res: Response, next: NextFunction) {
  try {
    const data: FileOperationRequest = req.body;
    const { serverId, root } = req.query;

    if (!serverId || !root) {
      return res.status(400).json({ error: 'serverId and root are required in query' });
    }

    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;

    const result = await fileManagerService.executeFileOperation(
      data,
      serverId as string,
      root as string,
      actorTenantId,
      actorId
    );

    return res.json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}
