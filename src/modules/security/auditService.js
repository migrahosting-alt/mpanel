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
  | 'USER_LOGIN_FAILED'
  | 'USER_LOGOUT'
  | 'USER_PASSWORD_CHANGED'
  | 'USER_2FA_ENABLED'
  | 'USER_2FA_DISABLED'
  // Auth events
  | 'ACCOUNT_DISABLED_LOGIN_ATTEMPT'
  | 'TENANT_SWITCHED'
  | 'TOKEN_REFRESHED'
  // Tenant events
  | 'TENANT_CREATED'
  | 'TENANT_UPDATED'
  | 'TENANT_SUSPENDED'
  | 'TENANT_REACTIVATED'
  | 'TENANT_DELETED'
  // Product events
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_DELETED'
  | 'PRICE_CREATED'
  | 'PRICE_UPDATED'
  | 'PRICE_DELETED'
  // Order events
  | 'ORDER_CREATED'
  | 'ORDER_PAID'
  | 'ORDER_FAILED'
  | 'ORDER_CANCELLED'
  | 'ORDER_REFUNDED'
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
 * SCHEMA ALIGNMENT (from prisma/schema.prisma AuditLog model):
 * - id, tenantId, userId (not actorUserId), action (not type)
 * - resourceType, resourceId, ipAddress, userAgent, details (not metadata)
 * - createdAt
 * - No severity or requestId fields
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

  // tenantId is required by the schema - skip if not provided
  if (!tenantId) {
    logger.debug('Skipping audit event - no tenantId', { type, actorUserId });
    return;
  }

  try {
    // Extract resource info from metadata if available
    const resourceType = (metadata.resourceType as string) ?? 
                         (metadata.cloudPodId ? 'CloudPod' : 
                          metadata.subscriptionId ? 'Subscription' : 
                          metadata.domainId ? 'Domain' : null);
    const resourceId = (metadata.resourceId as string) ?? 
                       (metadata.cloudPodId as string) ?? 
                       (metadata.subscriptionId as string) ?? 
                       (metadata.domainId as string) ?? null;

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorUserId,
        action: type,
        resourceType,
        resourceId,
        ipAddress: ipAddress ?? null,
        userAgent: null, // Could be extracted from request
        details: {
          ...metadata,
          requestId,
          severity,
        },
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
 * Uses 'action' field (not 'type') and 'details' JSON for additional data.
 */
export async function getAuditEvents(options: GetAuditEventsOptions = {}) {
  const {
    tenantId,
    actorUserId,
    type, // Maps to 'action' field in schema
    severity, // Stored in details JSON
    startDate,
    endDate,
    page = 1,
    pageSize = 50,
  } = options;

  const where: Record<string, unknown> = {};

  if (tenantId) where.tenantId = tenantId;
  if (actorUserId) where.userId = actorUserId; // Schema uses 'userId' not 'actorUserId'
  if (type) where.action = type; // Schema uses 'action' not 'type'
  // severity is in details JSON - can't filter easily in Prisma
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) (where.createdAt as Record<string, Date>).gte = startDate;
    if (endDate) (where.createdAt as Record<string, Date>).lte = endDate;
  }

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
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
