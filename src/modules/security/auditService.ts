/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * Audit Service - Central helper for all audit event logging.
 * Every sensitive action must emit an audit event through this service.
 */

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';

// ============================================
// TYPES
// ============================================

export type AuditEventType =
  // User events
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'USER_PASSWORD_CHANGED'
  | 'USER_2FA_ENABLED'
  | 'USER_2FA_DISABLED'
  // Tenant events
  | 'TENANT_CREATED'
  | 'TENANT_UPDATED'
  | 'TENANT_SUSPENDED'
  | 'TENANT_REACTIVATED'
  | 'TENANT_DELETED'
  // Subscription events
  | 'SUBSCRIPTION_CREATED'
  | 'SUBSCRIPTION_UPDATED'
  | 'SUBSCRIPTION_CANCELLED'
  | 'SUBSCRIPTION_RENEWED'
  | 'SUBSCRIPTION_SYNCED_FROM_PROVIDER'
  | 'SUBSCRIPTION_UPGRADE_REQUESTED'
  | 'SUBSCRIPTION_DOWNGRADE_REQUESTED'
  // CloudPod events
  | 'CLOUDPOD_CREATE_REQUESTED'
  | 'CLOUDPOD_PROVISIONING_STARTED'
  | 'CLOUDPOD_PROVISIONED'
  | 'CLOUDPOD_PROVISION_FAILED'
  | 'CLOUDPOD_STARTED'
  | 'CLOUDPOD_STOPPED'
  | 'CLOUDPOD_REBOOTED'
  | 'CLOUDPOD_SCALED'
  | 'CLOUDPOD_BACKUP_STARTED'
  | 'CLOUDPOD_BACKUP_COMPLETED'
  | 'CLOUDPOD_BACKUP_FAILED'
  | 'CLOUDPOD_DESTROY_REQUESTED'
  | 'CLOUDPOD_DESTROYED'
  // Domain events
  | 'DOMAIN_CREATED'
  | 'DOMAIN_UPDATED'
  | 'DOMAIN_DELETED'
  | 'DOMAIN_DNS_TEMPLATE_APPLIED'
  | 'DOMAIN_VERIFIED'
  // SSL events
  | 'SSL_ISSUE_REQUESTED'
  | 'SSL_ISSUED'
  | 'SSL_RENEWED'
  | 'SSL_REVOKED'
  | 'SSL_ISSUE_FAILED'
  // Billing events
  | 'INVOICE_CREATED'
  | 'INVOICE_PAID'
  | 'INVOICE_FAILED'
  | 'PAYMENT_METHOD_ADDED'
  | 'PAYMENT_METHOD_REMOVED'
  // Job events
  | 'JOB_STARTED'
  | 'JOB_COMPLETED'
  | 'JOB_FAILED'
  | 'JOB_RETRIED'
  // Security events
  | 'SECURITY_ALERT'
  | 'ACCESS_DENIED'
  | 'SUSPICIOUS_ACTIVITY'
  // Generic
  | string;

export interface AuditEventInput {
  /** User who performed the action (null for system actions) */
  actorUserId: string | null;
  /** Tenant context (null for platform-level actions) */
  tenantId: string | null;
  /** Event type - use constants from AuditEventType */
  type: AuditEventType;
  /** Additional structured data about the event */
  metadata?: Record<string, unknown>;
  /** IP address of the request (optional) */
  ipAddress?: string;
  /** Request ID for correlation (optional) */
  requestId?: string;
  /** Severity level */
  severity?: 'info' | 'warning' | 'error' | 'critical';
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Write an audit event to the database.
 * This is the central function for all audit logging.
 * 
 * @example
 * await writeAuditEvent({
 *   actorUserId: user.id,
 *   tenantId: tenant.id,
 *   type: 'CLOUDPOD_PROVISIONED',
 *   metadata: { cloudPodId, serverId, planCode }
 * });
 */
export async function writeAuditEvent(input: AuditEventInput): Promise<void> {
  const {
    actorUserId,
    tenantId,
    type,
    metadata = {},
    ipAddress,
    requestId,
    severity = 'info',
  } = input;

  try {
    await prisma.auditEvent.create({
      data: {
        actorUserId,
        tenantId,
        type,
        metadata: metadata as Record<string, unknown>,
        ipAddress: ipAddress ?? null,
        requestId: requestId ?? null,
        severity,
        createdAt: new Date(),
      },
    });

    // Also log to application logger for real-time visibility
    const logData = {
      type,
      actorUserId,
      tenantId,
      requestId,
      ...metadata,
    };

    switch (severity) {
      case 'critical':
      case 'error':
        logger.error(`AUDIT: ${type}`, logData);
        break;
      case 'warning':
        logger.warn(`AUDIT: ${type}`, logData);
        break;
      default:
        logger.info(`AUDIT: ${type}`, logData);
    }
  } catch (error) {
    // Never throw from audit logging - it shouldn't break the main flow
    logger.error('Failed to write audit event', {
      type,
      tenantId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Write multiple audit events in a batch.
 * Useful for complex operations that span multiple steps.
 */
export async function writeAuditEventBatch(events: AuditEventInput[]): Promise<void> {
  await Promise.all(events.map(event => writeAuditEvent(event)));
}

/**
 * Create an audit event builder for a specific context.
 * Useful when multiple events share the same actor/tenant.
 * 
 * @example
 * const audit = createAuditContext({ actorUserId: user.id, tenantId: tenant.id });
 * await audit('CLOUDPOD_PROVISIONING_STARTED', { cloudPodId });
 * await audit('CLOUDPOD_PROVISIONED', { cloudPodId, serverId });
 */
export function createAuditContext(context: {
  actorUserId: string | null;
  tenantId: string | null;
  requestId?: string;
  ipAddress?: string;
}) {
  return async (type: AuditEventType, metadata?: Record<string, unknown>) => {
    await writeAuditEvent({
      ...context,
      type,
      metadata,
    });
  };
}

// ============================================
// QUERY FUNCTIONS
// ============================================

export interface GetAuditEventsOptions {
  tenantId?: string;
  actorUserId?: string;
  type?: string;
  severity?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

/**
 * Get audit events with filtering and pagination.
 */
export async function getAuditEvents(options: GetAuditEventsOptions = {}) {
  const {
    tenantId,
    actorUserId,
    type,
    severity,
    startDate,
    endDate,
    page = 1,
    pageSize = 50,
  } = options;

  const where: Record<string, unknown> = {};

  if (tenantId) where.tenantId = tenantId;
  if (actorUserId) where.actorUserId = actorUserId;
  if (type) where.type = type;
  if (severity) where.severity = severity;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) (where.createdAt as Record<string, Date>).gte = startDate;
    if (endDate) (where.createdAt as Record<string, Date>).lte = endDate;
  }

  const [items, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditEvent.count({ where }),
  ]);

  return {
    data: items,
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export default {
  writeAuditEvent,
  writeAuditEventBatch,
  createAuditContext,
  getAuditEvents,
};
