/**
 * CloudPods Audit Service
 * Records all CloudPods actions for compliance, debugging, and analytics
 */

import { prisma } from '../config/database.js';
import type { CloudPodAuditCategory, CloudPodAuditAction, CloudPodAuditContext } from './cloudPodsEnterpriseTypes';

export interface AuditLogParams {
  action: CloudPodAuditAction;
  category: CloudPodAuditCategory;
  ctx: CloudPodAuditContext;
  details?: Record<string, unknown>;
}

export interface AuditListParams {
  tenantId: string;
  podId?: string;
  category?: CloudPodAuditCategory;
  action?: CloudPodAuditAction;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Log an audit event
 */
export async function log(params: AuditLogParams): Promise<void> {
  const { action, category, ctx, details } = params;

  try {
    await prisma.cloudPodAudit.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId || null,
        podId: ctx.podId || null,
        vmid: ctx.vmid || null,
        action,
        category,
        ipAddress: ctx.ipAddress || null,
        userAgent: ctx.userAgent || null,
        details: details ? JSON.parse(JSON.stringify(details)) : null,
      },
    });
  } catch (err) {
    // Audit logging should never break the main flow
    console.error('[CloudPodsAudit] Failed to log audit event:', err);
  }
}

/**
 * List audit events with filtering and pagination
 */
export async function list(params: AuditListParams) {
  const {
    tenantId,
    podId,
    category,
    action,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
  } = params;

  const where: Record<string, unknown> = { tenantId };

  if (podId) where.podId = podId;
  if (category) where.category = category;
  if (action) where.action = action;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) (where.createdAt as Record<string, Date>).gte = startDate;
    if (endDate) (where.createdAt as Record<string, Date>).lte = endDate;
  }

  const [items, total] = await Promise.all([
    prisma.cloudPodAudit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.cloudPodAudit.count({ where }),
  ]);

  return {
    items,
    total,
    limit,
    offset,
    hasMore: offset + items.length < total,
  };
}

/**
 * Get audit log for a specific pod
 */
export async function getPodAuditLog(
  tenantId: string,
  podId: string,
  options: { limit?: number; offset?: number } = {}
) {
  return list({
    tenantId,
    podId,
    limit: options.limit || 50,
    offset: options.offset || 0,
  });
}

/**
 * Get recent security-related audit events
 */
export async function getSecurityAuditLog(
  tenantId: string,
  options: { limit?: number; startDate?: Date } = {}
) {
  return list({
    tenantId,
    category: 'security',
    limit: options.limit || 100,
    startDate: options.startDate,
  });
}

/**
 * Helper to create audit context from Express request
 */
export function createAuditContext(
  tenantId: string,
  req?: { userId?: string; ip?: string; headers?: Record<string, string | string[] | undefined> },
  podId?: string,
  vmid?: number
): CloudPodAuditContext {
  return {
    tenantId,
    userId: req?.userId,
    podId,
    vmid,
    ipAddress: req?.ip || req?.headers?.['x-forwarded-for']?.toString(),
    userAgent: req?.headers?.['user-agent']?.toString(),
  };
}

export const CloudPodsAuditService = {
  log,
  list,
  getPodAuditLog,
  getSecurityAuditLog,
  createAuditContext,
};

export default CloudPodsAuditService;
