import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';

// Mock storage for user roles until RBAC schema is added
const mockUserRoles: any[] = [];

interface ListUsersParams {
  status?: string;
  type?: string;
  tenantId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

interface CreateUserParams {
  email: string;
  fullName: string;
  type: string;
  tenantId?: string;
  roleIds?: string[];
  createdBy?: string;
}

export async function listUsers(params: ListUsersParams) {
  const { status, type, tenantId, search, page = 1, pageSize = 50 } = params;

  const where: any = {};

  if (status) {
    where.status = status;
  }

  if (type) {
    where.type = type;
  }

  if (tenantId) {
    where.tenantId = tenantId;
  }

  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { fullName: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        tenantId: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getUser(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  return user;
}

export async function createUser(params: CreateUserParams) {
  const { email, fullName, type, tenantId, roleIds, createdBy } = params;

  // Check if email already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error('User with this email already exists');
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: fullName,
      passwordHash: 'INVITED', // Temporary until password is set
      role: type === 'PLATFORM' ? 'admin' : 'customer',
      tenantId,
      status: 'INVITED',
    },
  });

  // Create role assignments if provided (using mock storage)
  if (roleIds && roleIds.length > 0) {
    roleIds.forEach((roleId) => {
      mockUserRoles.push({
        userId: user.id,
        roleId,
        user,
      });
    });
  }

  logger.info('User created', { userId: user.id, email, createdBy });

  return user;
}

export async function updateUser(id: string, data: any) {
  const user = await prisma.user.update({
    where: { id },
    data: {
      name: data.fullName,
      // phone and timezone not in schema - skip
    },
  });

  logger.info('User updated', { userId: id });

  return user;
}

export async function updateUserStatus(id: string, status: string) {
  const user = await prisma.user.update({
    where: { id },
    data: { status },
  });

  logger.info('User status updated', { userId: id, status });

  return user;
}

export async function getUserRoles(userId: string) {
  const userRoles = mockUserRoles.filter((ur) => ur.userId === userId);

  return userRoles.map((ur: any) => ur.role || { id: ur.roleId, name: 'Mock Role' });
}

export async function setUserRoles(userId: string, roleIds: string[]) {
  // Delete existing roles
  const filtered = mockUserRoles.filter((ur) => ur.userId !== userId);
  mockUserRoles.length = 0;
  mockUserRoles.push(...filtered);

  // Create new role assignments
  if (roleIds.length > 0) {
    roleIds.forEach((roleId) => {
      mockUserRoles.push({
        userId,
        roleId,
        role: { id: roleId, name: 'Mock Role' },
      });
    });
  }

  logger.info('User roles updated', { userId, roleIds });

  return getUserRoles(userId);
}

export default {
  listUsers,
  getUser,
  createUser,
  updateUser,
  updateUserStatus,
  getUserRoles,
  setUserRoles,
};
