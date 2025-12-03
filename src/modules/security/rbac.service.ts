import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';

// Enterprise permissions catalog
const PERMISSIONS_CATALOG = [
  // Platform permissions
  { id: 'platform.customers.read', name: 'View Customers', category: 'Platform' },
  { id: 'platform.customers.write', name: 'Manage Customers', category: 'Platform' },
  { id: 'platform.servers.read', name: 'View Servers', category: 'Platform' },
  { id: 'platform.servers.write', name: 'Manage Servers', category: 'Platform' },
  { id: 'platform.provisioning.read', name: 'View Provisioning', category: 'Platform' },
  { id: 'platform.provisioning.write', name: 'Manage Provisioning', category: 'Platform' },
  { id: 'platform.billing.read', name: 'View Billing', category: 'Platform' },
  { id: 'platform.billing.write', name: 'Manage Billing', category: 'Platform' },
  
  // Tenant permissions
  { id: 'tenant.cloudpods.read', name: 'View CloudPods', category: 'Tenant' },
  { id: 'tenant.cloudpods.write', name: 'Manage CloudPods', category: 'Tenant' },
  { id: 'tenant.users.read', name: 'View Users', category: 'Tenant' },
  { id: 'tenant.users.write', name: 'Manage Users', category: 'Tenant' },
  { id: 'tenant.billing.read', name: 'View Billing', category: 'Tenant' },
  
  // Security permissions
  { id: 'security.guardian.read', name: 'View Guardian', category: 'Security' },
  { id: 'security.guardian.write', name: 'Manage Guardian', category: 'Security' },
  { id: 'security.shield.read', name: 'View Migra Shield', category: 'Security' },
  { id: 'security.shield.write', name: 'Manage Migra Shield', category: 'Security' },
  { id: 'security.rbac.read', name: 'View Roles', category: 'Security' },
  { id: 'security.rbac.write', name: 'Manage Roles', category: 'Security' },
];

interface ListRolesParams {
  scope?: string;
  search?: string;
}

interface CreateRoleParams {
  name: string;
  description?: string;
  scope: string;
  permissions: string[];
}

export async function listRoles(params: ListRolesParams) {
  const { scope, search } = params;

  const where: any = {};

  if (scope) {
    where.scope = scope;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const roles = await prisma.role.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: {
          userRoles: true,
        },
      },
    },
  });

  return roles;
}

export async function getRole(id: string) {
  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      userRoles: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
        },
      },
    },
  });

  if (!role) {
    throw new Error('Role not found');
  }

  return role;
}

export async function createRole(params: CreateRoleParams) {
  const { name, description, scope, permissions } = params;

  const role = await prisma.role.create({
    data: {
      name,
      description,
      scope,
      permissions: JSON.stringify(permissions),
    },
  });

  logger.info('Role created', { roleId: role.id, name });

  return role;
}

export async function updateRole(id: string, data: any) {
  const role = await prisma.role.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      permissions: data.permissions ? JSON.stringify(data.permissions) : undefined,
    },
  });

  logger.info('Role updated', { roleId: id });

  return role;
}

export async function deleteRole(id: string) {
  // Check if role has users
  const userCount = await prisma.userRole.count({
    where: { roleId: id },
  });

  if (userCount > 0) {
    throw new Error('Cannot delete role with assigned users');
  }

  await prisma.role.delete({
    where: { id },
  });

  logger.warn('Role deleted', { roleId: id });
}

export async function listPermissions() {
  return PERMISSIONS_CATALOG;
}

export async function getRoleUsers(roleId: string) {
  const userRoles = await prisma.userRole.findMany({
    where: { roleId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          status: true,
          lastLoginAt: true,
        },
      },
    },
  });

  return userRoles.map((ur) => ur.user);
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
