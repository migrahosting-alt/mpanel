import type { Request, Response } from 'express';
import logger from '../../config/logger.js';
import { writeAuditEvent } from './auditService.js';
import * as rbacService from './rbac.service.js';

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

export async function listRoles(req: AuthenticatedRequest, res: Response) {
  try {
    const { scope, search } = req.query;
    
    const roles = await rbacService.listRoles({
      scope: typeof scope === 'string' ? scope : undefined,
      search: typeof search === 'string' ? search : undefined,
    });

    return res.json({ success: true, data: roles });
  } catch (error) {
    return handleError(res, error, 'Failed to list roles');
  }
}

export async function getRole(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const role = await rbacService.getRole(id);

    if (!role) {
      return res.status(404).json({ success: false, error: 'Role not found' });
    }

    return res.json({ success: true, data: role });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch role');
  }
}

export async function createRole(req: AuthenticatedRequest, res: Response) {
  try {
    const { name, description, scope, permissions } = req.body ?? {};

    if (!name || !scope) {
      return res.status(400).json({ success: false, error: 'Name and scope are required' });
    }

    const role = await rbacService.createRole({
      name,
      description,
      scope,
      permissions: permissions ?? [],
    });

    await writeAuditEvent({
      actorUserId: req.user?.userId ?? null,
      tenantId: null,
      type: 'ROLE_CREATED',
      metadata: { roleId: role.id, name: role.name },
    });

    return res.status(201).json({ success: true, data: role });
  } catch (error) {
    return handleError(res, error, 'Failed to create role');
  }
}

export async function updateRole(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const role = await rbacService.updateRole(id, req.body ?? {});

    await writeAuditEvent({
      actorUserId: req.user?.userId ?? null,
      tenantId: null,
      type: 'ROLE_UPDATED',
      metadata: { roleId: id },
    });

    return res.json({ success: true, data: role });
  } catch (error) {
    return handleError(res, error, 'Failed to update role');
  }
}

export async function deleteRole(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    await rbacService.deleteRole(id);

    await writeAuditEvent({
      actorUserId: req.user?.userId ?? null,
      tenantId: null,
      type: 'ROLE_DELETED',
      metadata: { roleId: id },
    });

    return res.json({ success: true });
  } catch (error) {
    return handleError(res, error, 'Failed to delete role');
  }
}

export async function listPermissions(req: AuthenticatedRequest, res: Response) {
  try {
    const permissions = await rbacService.listPermissions();
    return res.json({ success: true, data: permissions });
  } catch (error) {
    return handleError(res, error, 'Failed to list permissions');
  }
}

export async function getRoleUsers(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const users = await rbacService.getRoleUsers(id);

    return res.json({ success: true, data: users });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch role users');
  }
}

export default {
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  listPermissions,
  getRoleUsers,
};
