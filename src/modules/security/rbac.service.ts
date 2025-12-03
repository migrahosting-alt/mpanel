import logger from '../../config/logger.js';

// Mock in-memory storage until RBAC tables are added to Prisma schema
const mockRoles: any[] = [];
const mockUserRoles: any[] = [];

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

  let filtered = [...mockRoles];

  if (scope) {
    filtered = filtered.filter((r) => r.scope === scope);
  }

  if (search) {
    filtered = filtered.filter(
      (r) =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(search.toLowerCase()))
    );
  }

  return filtered;
}

export async function getRole(id: string) {
  const role = mockRoles.find((r) => r.id === id);

  if (!role) {
    throw new Error('Role not found');
  }

  const users = mockUserRoles.filter((ur) => ur.roleId === id).map((ur) => ur.user);

  return {
    ...role,
    userRoles: users.map((user) => ({ user })),
  };
}

export async function createRole(params: CreateRoleParams) {
  const { name, description, scope, permissions } = params;

  const role = {
    id: `role_${Date.now()}`,
    name,
    description,
    scope,
    permissions: JSON.stringify(permissions),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  mockRoles.push(role);

  logger.info('Role created', { roleId: role.id, name });

  return role;
}

export async function updateRole(id: string, data: any) {
  const index = mockRoles.findIndex((r) => r.id === id);

  if (index === -1) {
    throw new Error('Role not found');
  }

  mockRoles[index] = {
    ...mockRoles[index],
    name: data.name ?? mockRoles[index].name,
    description: data.description ?? mockRoles[index].description,
    permissions: data.permissions ? JSON.stringify(data.permissions) : mockRoles[index].permissions,
    updatedAt: new Date(),
  };

  logger.info('Role updated', { roleId: id });

  return mockRoles[index];
}

export async function deleteRole(id: string) {
  const userCount = mockUserRoles.filter((ur) => ur.roleId === id).length;

  if (userCount > 0) {
    throw new Error('Cannot delete role with assigned users');
  }

  const index = mockRoles.findIndex((r) => r.id === id);

  if (index === -1) {
    throw new Error('Role not found');
  }

  mockRoles.splice(index, 1);

  logger.warn('Role deleted', { roleId: id });
}

export async function listPermissions() {
  return PERMISSIONS_CATALOG;
}

export async function getRoleUsers(roleId: string) {
  const userRoles = mockUserRoles.filter((ur) => ur.roleId === roleId);

  return userRoles.map((ur: any) => ur.user);
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
