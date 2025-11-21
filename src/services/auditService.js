/**
 * Audit Service
 * Comprehensive audit logging for compliance and security
 */

import pool from '../db/index.js';
import logger from '../utils/logger.js';

/**
 * Log an audit event
 */
export async function logAudit(auditData) {
  const {
    tenantId,
    userId,
    userEmail,
    userRole,
    action,
    resourceType,
    resourceId,
    description,
    changes,
    metadata,
    ipAddress,
    userAgent,
    requestId,
    severity = 'info',
    gdprRelevant = false,
    pciRelevant = false,
  } = auditData;
  
  try {
    await pool.query(
      `INSERT INTO audit_logs 
       (tenant_id, user_id, user_email, user_role, action, resource_type, resource_id,
        description, changes, metadata, ip_address, user_agent, request_id, severity,
        gdpr_relevant, pci_relevant)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        tenantId, userId, userEmail, userRole, action, resourceType, resourceId,
        description, changes ? JSON.stringify(changes) : null, metadata ? JSON.stringify(metadata) : null,
        ipAddress, userAgent, requestId, severity, gdprRelevant, pciRelevant,
      ]
    );
    
    // Log critical events to application logger too
    if (severity === 'critical' || severity === 'error') {
      logger.error(`AUDIT: ${action} - ${description}`, {
        userId,
        resourceType,
        resourceId,
        ipAddress,
      });
    }
  } catch (error) {
    logger.error('Error logging audit event:', error);
  }
}

/**
 * Get audit logs with filters
 */
export async function getAuditLogs(filters = {}) {
  const {
    tenantId,
    userId,
    action,
    resourceType,
    resourceId,
    severity,
    gdprRelevant,
    pciRelevant,
    startDate,
    endDate,
    limit = 100,
    offset = 0,
  } = filters;
  
  try {
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    
    if (tenantId) {
      conditions.push(`tenant_id = $${paramIndex++}`);
      params.push(tenantId);
    }
    
    if (userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(userId);
    }
    
    if (action) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(action);
    }
    
    if (resourceType) {
      conditions.push(`resource_type = $${paramIndex++}`);
      params.push(resourceType);
    }
    
    if (resourceId) {
      conditions.push(`resource_id = $${paramIndex++}`);
      params.push(resourceId);
    }
    
    if (severity) {
      conditions.push(`severity = $${paramIndex++}`);
      params.push(severity);
    }
    
    if (gdprRelevant !== undefined) {
      conditions.push(`gdpr_relevant = $${paramIndex++}`);
      params.push(gdprRelevant);
    }
    
    if (pciRelevant !== undefined) {
      conditions.push(`pci_relevant = $${paramIndex++}`);
      params.push(pciRelevant);
    }
    
    if (startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(startDate);
    }
    
    if (endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(endDate);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const result = await pool.query(
      `SELECT * FROM audit_logs 
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );
    
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM audit_logs ${whereClause}`,
      params
    );
    
    return {
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset,
    };
  } catch (error) {
    logger.error('Error getting audit logs:', error);
    throw error;
  }
}

/**
 * Get audit statistics
 */
export async function getAuditStats(tenantId, days = 30) {
  try {
    const result = await pool.query(
      `SELECT 
        COUNT(*) as total_events,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical_events,
        COUNT(*) FILTER (WHERE severity = 'error') as error_events,
        COUNT(*) FILTER (WHERE severity = 'warning') as warning_events,
        COUNT(*) FILTER (WHERE gdpr_relevant = true) as gdpr_events,
        COUNT(*) FILTER (WHERE pci_relevant = true) as pci_events,
        json_object_agg(action, action_count) as actions_by_type
       FROM (
         SELECT action, COUNT(*) as action_count
         FROM audit_logs
         WHERE tenant_id = $1 
           AND created_at >= NOW() - INTERVAL '${days} days'
         GROUP BY action
       ) action_counts,
       audit_logs
       WHERE tenant_id = $1 
         AND created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY tenant_id`,
      [tenantId]
    );
    
    return result.rows[0] || {
      total_events: 0,
      unique_users: 0,
      critical_events: 0,
      error_events: 0,
      warning_events: 0,
      gdpr_events: 0,
      pci_events: 0,
      actions_by_type: {},
    };
  } catch (error) {
    logger.error('Error getting audit stats:', error);
    throw error;
  }
}

/**
 * Export audit logs for compliance
 */
export async function exportAuditLogs(tenantId, startDate, endDate, format = 'json') {
  try {
    const result = await pool.query(
      `SELECT * FROM audit_logs
       WHERE tenant_id = $1
         AND created_at >= $2
         AND created_at <= $3
       ORDER BY created_at ASC`,
      [tenantId, startDate, endDate]
    );
    
    if (format === 'csv') {
      return convertToCSV(result.rows);
    }
    
    return result.rows;
  } catch (error) {
    logger.error('Error exporting audit logs:', error);
    throw error;
  }
}

/**
 * Middleware to auto-log API requests
 */
export function auditMiddleware(req, res, next) {
  // Store original end function
  const originalEnd = res.end;
  
  // Override end function to log after response
  res.end = function(...args) {
    // Log the request
    logAudit({
      tenantId: req.user?.tenantId,
      userId: req.user?.id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      action: `api.${req.method.toLowerCase()}.${req.path.replace(/\//g, '.')}`,
      description: `${req.method} ${req.path}`,
      metadata: {
        method: req.method,
        path: req.path,
        query: req.query,
        statusCode: res.statusCode,
      },
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      requestId: req.id,
      severity: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warning' : 'info',
    }).catch(err => logger.error('Audit middleware error:', err));
    
    // Call original end
    originalEnd.apply(res, args);
  };
  
  next();
}

/**
 * Convert audit logs to CSV
 */
function convertToCSV(logs) {
  const headers = [
    'timestamp', 'user_email', 'user_role', 'action', 'resource_type',
    'resource_id', 'description', 'ip_address', 'severity'
  ];
  
  const rows = logs.map(log => [
    log.created_at,
    log.user_email,
    log.user_role,
    log.action,
    log.resource_type,
    log.resource_id,
    log.description,
    log.ip_address,
    log.severity,
  ]);
  
  const csv = [headers.join(',')];
  rows.forEach(row => {
    csv.push(row.map(field => `"${field || ''}"`).join(','));
  });
  
  return csv.join('\n');
}

// Audit action constants
export const ACTIONS = {
  // User actions
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  USER_PASSWORD_CHANGED: 'user.password_changed',
  USER_2FA_ENABLED: 'user.2fa_enabled',
  USER_2FA_DISABLED: 'user.2fa_disabled',
  
  // Permission actions
  ROLE_ASSIGNED: 'role.assigned',
  ROLE_REMOVED: 'role.removed',
  PERMISSION_GRANTED: 'permission.granted',
  PERMISSION_REVOKED: 'permission.revoked',
  
  // Billing actions
  INVOICE_CREATED: 'invoice.created',
  INVOICE_PAID: 'invoice.paid',
  INVOICE_REFUNDED: 'invoice.refunded',
  PAYMENT_FAILED: 'payment.failed',
  
  // Server actions
  SERVER_CREATED: 'server.created',
  SERVER_UPDATED: 'server.updated',
  SERVER_DELETED: 'server.deleted',
  SERVER_RESTARTED: 'server.restarted',
  
  // Domain actions
  DOMAIN_REGISTERED: 'domain.registered',
  DOMAIN_TRANSFERRED: 'domain.transferred',
  DOMAIN_RENEWED: 'domain.renewed',
  DOMAIN_DELETED: 'domain.deleted',
  
  // Security actions
  SECURITY_BREACH: 'security.breach',
  SUSPICIOUS_ACTIVITY: 'security.suspicious_activity',
  ACCESS_DENIED: 'security.access_denied',
  
  // Data actions
  DATA_EXPORT: 'data.export',
  DATA_DELETION: 'data.deletion',
  GDPR_REQUEST: 'gdpr.request',
};

export default {
  logAudit,
  getAuditLogs,
  getAuditStats,
  exportAuditLogs,
  auditMiddleware,
  ACTIONS,
};
