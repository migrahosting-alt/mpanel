# CloudPods Audit Log / Compliance Trail

> **Status**: Spec Complete  
> **Priority**: P0 - Required for enterprise compliance (SOC2, HIPAA, etc.)  
> **Depends On**: Base CloudPods system  

---

## 1. Overview

Complete audit trail of all CloudPod operations. See who did what to which pod and when – a hard requirement for serious enterprise clients.

### Goals
- Log ALL state-changing operations on CloudPods
- Log permission denials and access attempts
- Immutable, append-only audit records
- Queryable by tenant, user, pod, action type, and time range
- Support for compliance exports (JSON, CSV)

---

## 2. Database Schema

### 2.1 `cloud_pod_audit`

Main audit log table - append-only, no updates/deletes.

```sql
CREATE TABLE cloud_pod_audit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  user_id         UUID REFERENCES users(id),     -- nullable for system events
  pod_id          UUID REFERENCES cloud_pods(id), -- nullable for tenant-wide events
  vmid            INT,                            -- denormalized for quick lookup
  
  action          VARCHAR(50) NOT NULL,           -- 'CREATE', 'DESTROY', etc.
  category        VARCHAR(30) NOT NULL,           -- 'LIFECYCLE', 'ACCESS', 'QUOTA', 'SECURITY'
  severity        VARCHAR(10) DEFAULT 'INFO',     -- 'INFO', 'WARN', 'ERROR', 'CRITICAL'
  
  context         JSONB NOT NULL DEFAULT '{}',    -- action-specific details
  
  -- Request metadata
  ip_address      INET,
  user_agent      TEXT,
  request_id      UUID,                           -- correlation ID
  
  -- Timestamps
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Partitioning key (for future table partitioning)
  created_month   DATE GENERATED ALWAYS AS (DATE_TRUNC('month', created_at)) STORED
);

-- Indexes for common queries
CREATE INDEX idx_audit_tenant_time ON cloud_pod_audit(tenant_id, created_at DESC);
CREATE INDEX idx_audit_pod ON cloud_pod_audit(pod_id, created_at DESC) WHERE pod_id IS NOT NULL;
CREATE INDEX idx_audit_user ON cloud_pod_audit(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_action ON cloud_pod_audit(action, created_at DESC);
CREATE INDEX idx_audit_vmid ON cloud_pod_audit(vmid) WHERE vmid IS NOT NULL;
CREATE INDEX idx_audit_category ON cloud_pod_audit(category);
CREATE INDEX idx_audit_severity ON cloud_pod_audit(severity) WHERE severity != 'INFO';

-- Prevent modifications (audit log is immutable)
CREATE RULE audit_no_update AS ON UPDATE TO cloud_pod_audit DO INSTEAD NOTHING;
CREATE RULE audit_no_delete AS ON DELETE TO cloud_pod_audit DO INSTEAD NOTHING;
```

---

## 3. Audit Actions

### 3.1 Lifecycle Actions (category: `LIFECYCLE`)

| Action | Severity | Description |
|--------|----------|-------------|
| `POD_CREATE_REQUESTED` | INFO | User requested pod creation |
| `POD_CREATE_STARTED` | INFO | Provisioning worker started |
| `POD_CREATE_COMPLETED` | INFO | Pod successfully created |
| `POD_CREATE_FAILED` | ERROR | Pod creation failed |
| `POD_DESTROY_REQUESTED` | WARN | User requested destruction |
| `POD_DESTROY_STARTED` | WARN | Destruction in progress |
| `POD_DESTROY_COMPLETED` | INFO | Pod destroyed |
| `POD_DESTROY_FAILED` | ERROR | Destruction failed |
| `POD_SCALE_REQUESTED` | INFO | Scale request submitted |
| `POD_SCALE_COMPLETED` | INFO | Scale successful |
| `POD_SCALE_FAILED` | ERROR | Scale failed |
| `POD_BACKUP_REQUESTED` | INFO | Backup requested |
| `POD_BACKUP_COMPLETED` | INFO | Backup successful |
| `POD_BACKUP_FAILED` | ERROR | Backup failed |
| `POD_RESTORE_REQUESTED` | WARN | Restore from backup |
| `POD_RESTORE_COMPLETED` | INFO | Restore successful |

### 3.2 Access Actions (category: `ACCESS`)

| Action | Severity | Description |
|--------|----------|-------------|
| `POD_CONSOLE_ACCESS` | INFO | User accessed console/SSH |
| `POD_VIEWED` | INFO | User viewed pod details |
| `PERMISSION_DENIED` | WARN | Access denied due to RBAC |
| `LOGIN_SUCCESS` | INFO | User logged in |
| `LOGIN_FAILED` | WARN | Failed login attempt |

### 3.3 Quota Actions (category: `QUOTA`)

| Action | Severity | Description |
|--------|----------|-------------|
| `QUOTA_UPDATED` | INFO | Admin changed quota limits |
| `QUOTA_EXCEEDED` | WARN | Operation blocked by quota |
| `QUOTA_WARNING` | INFO | Usage > 80% of limit |
| `QUOTA_RECALCULATED` | INFO | Usage recalculated from pods |

### 3.4 Security Actions (category: `SECURITY`)

| Action | Severity | Description |
|--------|----------|-------------|
| `SECURITY_GROUP_CREATED` | INFO | New security group |
| `SECURITY_GROUP_UPDATED` | INFO | Rules modified |
| `SECURITY_GROUP_DELETED` | WARN | Security group removed |
| `SECURITY_GROUP_ATTACHED` | INFO | Attached to pod |
| `SECURITY_GROUP_DETACHED` | WARN | Detached from pod |
| `FIREWALL_RULE_TRIGGERED` | WARN | Blocked traffic |

### 3.5 Admin Actions (category: `ADMIN`)

| Action | Severity | Description |
|--------|----------|-------------|
| `ROLE_ASSIGNED` | INFO | Role assigned to user |
| `ROLE_REMOVED` | WARN | Role removed from user |
| `ROLE_CREATED` | INFO | Custom role created |
| `USER_INVITED` | INFO | User invited to tenant |
| `USER_REMOVED` | WARN | User removed from tenant |
| `SETTINGS_UPDATED` | INFO | Tenant settings changed |

---

## 4. Context Schemas

### 4.1 Lifecycle Context

```typescript
// POD_CREATE_REQUESTED
interface CreateRequestContext {
  planCode: string;
  primaryDomain?: string;
  blueprintId?: string;
  requestedResources: {
    cores: number;
    memoryMb: number;
    diskGb: number;
  };
}

// POD_CREATE_COMPLETED
interface CreateCompletedContext {
  vmid: number;
  ip: string;
  hostname: string;
  node: string;
  provisioningDurationMs: number;
}

// POD_DESTROY_REQUESTED
interface DestroyRequestContext {
  reason?: string;
  vmid: number;
  ip: string;
  planCode: string;
  ageHours: number; // how long pod existed
}

// POD_SCALE_COMPLETED
interface ScaleCompletedContext {
  previousCores: number;
  previousMemoryMb: number;
  newCores: number;
  newMemoryMb: number;
  reason?: string;
}

// POD_BACKUP_COMPLETED
interface BackupCompletedContext {
  snapshotName: string;
  mode: 'snapshot' | 'suspend' | 'stop';
  sizeBytes?: number;
  durationMs: number;
}
```

### 4.2 Access Context

```typescript
// PERMISSION_DENIED
interface PermissionDeniedContext {
  permission: string;
  path: string;
  method: string;
  userRoles: string[];
}

// POD_CONSOLE_ACCESS
interface ConsoleAccessContext {
  sessionId: string;
  duration?: number;
  bytesTransferred?: number;
}
```

### 4.3 Quota Context

```typescript
// QUOTA_UPDATED
interface QuotaUpdatedContext {
  previous: {
    maxPods: number;
    maxCpuCores: number;
    maxMemoryMb: number;
    maxDiskGb: number;
  };
  new: {
    maxPods: number;
    maxCpuCores: number;
    maxMemoryMb: number;
    maxDiskGb: number;
  };
  updatedBy: string;
  reason?: string;
}

// QUOTA_EXCEEDED
interface QuotaExceededContext {
  resource: 'pods' | 'cpu' | 'memory' | 'disk';
  current: number;
  limit: number;
  requested: number;
  operation: string;
}
```

---

## 5. Service Implementation

### 5.1 `src/services/auditService.js`

```javascript
// src/services/auditService.js
import { prisma } from '../config/database.js';

/**
 * Log an audit event
 * @param {Object} event - Audit event details
 */
export async function logAuditEvent({
  tenantId,
  userId = null,
  podId = null,
  vmid = null,
  action,
  category = 'LIFECYCLE',
  severity = 'INFO',
  context = {},
  ipAddress = null,
  userAgent = null,
  requestId = null,
}) {
  try {
    const event = await prisma.cloudPodAudit.create({
      data: {
        tenantId,
        userId,
        podId,
        vmid,
        action,
        category,
        severity,
        context,
        ipAddress,
        userAgent,
        requestId,
      },
    });
    
    // For critical events, also log to console/external system
    if (severity === 'CRITICAL' || severity === 'ERROR') {
      console.error(`[AUDIT][${severity}] ${action}`, {
        tenantId,
        userId,
        podId,
        context,
      });
    }
    
    return event;
  } catch (error) {
    // Audit logging should never crash the app
    console.error('[AUDIT] Failed to log event:', error, { action, tenantId });
    return null;
  }
}

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs({
  tenantId,
  podId,
  userId,
  vmid,
  action,
  category,
  severity,
  startDate,
  endDate,
  limit = 100,
  offset = 0,
}) {
  const where = {};
  
  if (tenantId) where.tenantId = tenantId;
  if (podId) where.podId = podId;
  if (userId) where.userId = userId;
  if (vmid) where.vmid = vmid;
  if (action) where.action = action;
  if (category) where.category = category;
  if (severity) where.severity = severity;
  
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }
  
  const [events, total] = await Promise.all([
    prisma.cloudPodAudit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        pod: { select: { id: true, hostname: true, vmid: true } },
      },
    }),
    prisma.cloudPodAudit.count({ where }),
  ]);
  
  return { events, total, limit, offset };
}

/**
 * Get audit trail for a specific pod
 */
export async function getPodAuditTrail(podId, { limit = 50, offset = 0 } = {}) {
  return queryAuditLogs({ podId, limit, offset });
}

/**
 * Get audit trail for a tenant
 */
export async function getTenantAuditTrail(tenantId, filters = {}) {
  return queryAuditLogs({ tenantId, ...filters });
}

/**
 * Get recent security events
 */
export async function getSecurityEvents(tenantId, { limit = 50 } = {}) {
  return queryAuditLogs({
    tenantId,
    severity: 'WARN',
    limit,
  });
}

/**
 * Export audit logs for compliance
 */
export async function exportAuditLogs({
  tenantId,
  startDate,
  endDate,
  format = 'json',
}) {
  const { events } = await queryAuditLogs({
    tenantId,
    startDate,
    endDate,
    limit: 10000, // Max export size
  });
  
  if (format === 'csv') {
    return convertToCSV(events);
  }
  
  return events;
}

function convertToCSV(events) {
  const headers = [
    'timestamp', 'action', 'category', 'severity',
    'user_email', 'pod_hostname', 'vmid', 'ip_address', 'context'
  ];
  
  const rows = events.map(e => [
    e.createdAt.toISOString(),
    e.action,
    e.category,
    e.severity,
    e.user?.email || 'SYSTEM',
    e.pod?.hostname || '',
    e.vmid || '',
    e.ipAddress || '',
    JSON.stringify(e.context),
  ]);
  
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Audit stats for dashboard
 */
export async function getAuditStats(tenantId, days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  
  const [byAction, bySeverity, byDay] = await Promise.all([
    // Events by action
    prisma.cloudPodAudit.groupBy({
      by: ['action'],
      where: { tenantId, createdAt: { gte: since } },
      _count: { id: true },
    }),
    
    // Events by severity
    prisma.cloudPodAudit.groupBy({
      by: ['severity'],
      where: { tenantId, createdAt: { gte: since } },
      _count: { id: true },
    }),
    
    // Events by day
    prisma.$queryRaw`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM cloud_pod_audit
      WHERE tenant_id = ${tenantId}::uuid AND created_at >= ${since}
      GROUP BY DATE(created_at)
      ORDER BY date
    `,
  ]);
  
  return {
    byAction: byAction.reduce((acc, r) => ({ ...acc, [r.action]: r._count.id }), {}),
    bySeverity: bySeverity.reduce((acc, r) => ({ ...acc, [r.severity]: r._count.id }), {}),
    byDay,
  };
}
```

---

## 6. Middleware for Auto-Logging

### 6.1 `src/middleware/auditMiddleware.js`

```javascript
// src/middleware/auditMiddleware.js
import { logAuditEvent } from '../services/auditService.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Add request ID to all requests
 */
export function requestIdMiddleware(req, res, next) {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('x-request-id', req.requestId);
  next();
}

/**
 * Auto-log destructive operations
 */
export function auditDestructiveOps(req, res, next) {
  // Store original end method
  const originalEnd = res.end;
  const startTime = Date.now();
  
  res.end = function(...args) {
    // Only log for authenticated, state-changing requests
    if (req.user && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const shouldLog = determineIfShouldLog(req);
      
      if (shouldLog) {
        const action = determineAction(req, res);
        const severity = res.statusCode >= 400 ? 'ERROR' : 'INFO';
        
        logAuditEvent({
          tenantId: req.user.tenantId,
          userId: req.user.id,
          podId: req.params.podId || req.params.vmid ? null : null, // resolve from params
          vmid: req.params.vmid ? parseInt(req.params.vmid) : null,
          action,
          category: determineCategory(req),
          severity,
          context: {
            path: req.path,
            method: req.method,
            statusCode: res.statusCode,
            durationMs: Date.now() - startTime,
            body: sanitizeBody(req.body),
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          requestId: req.requestId,
        });
      }
    }
    
    originalEnd.apply(res, args);
  };
  
  next();
}

function determineIfShouldLog(req) {
  const path = req.path;
  
  // Always log CloudPod operations
  if (path.includes('/cloud-pods/')) return true;
  
  // Always log RBAC operations
  if (path.includes('/rbac/')) return true;
  
  // Always log auth operations
  if (path.includes('/auth/')) return true;
  
  return false;
}

function determineAction(req, res) {
  const path = req.path;
  const method = req.method;
  
  // CloudPod actions
  if (path.includes('/cloud-pods/')) {
    if (path.includes('/order') && method === 'POST') return 'POD_CREATE_REQUESTED';
    if (path.includes('/destroy')) return 'POD_DESTROY_REQUESTED';
    if (path.includes('/scale')) return 'POD_SCALE_REQUESTED';
    if (path.includes('/backup')) return 'POD_BACKUP_REQUESTED';
    if (path.includes('/quota')) return 'QUOTA_UPDATED';
    if (path.includes('/security-groups')) return 'SECURITY_GROUP_UPDATED';
  }
  
  // RBAC actions
  if (path.includes('/rbac/')) {
    if (path.includes('/roles') && method === 'POST') return 'ROLE_CREATED';
    if (path.includes('/roles') && method === 'DELETE') return 'ROLE_REMOVED';
    if (path.includes('/users') && path.includes('/roles')) {
      return method === 'POST' ? 'ROLE_ASSIGNED' : 'ROLE_REMOVED';
    }
  }
  
  // Auth actions
  if (path.includes('/auth/')) {
    if (path.includes('/login')) {
      return res.statusCode < 400 ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED';
    }
  }
  
  return 'UNKNOWN_ACTION';
}

function determineCategory(req) {
  const path = req.path;
  
  if (path.includes('/quota')) return 'QUOTA';
  if (path.includes('/security')) return 'SECURITY';
  if (path.includes('/rbac/') || path.includes('/auth/')) return 'ACCESS';
  if (path.includes('/cloud-pods/')) return 'LIFECYCLE';
  
  return 'ADMIN';
}

function sanitizeBody(body) {
  if (!body) return {};
  
  const sanitized = { ...body };
  
  // Remove sensitive fields
  delete sanitized.password;
  delete sanitized.token;
  delete sanitized.secret;
  delete sanitized.apiKey;
  
  return sanitized;
}
```

---

## 7. API Routes

### 7.1 `src/routes/auditRoutes.js`

```javascript
// src/routes/auditRoutes.js
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import * as auditService from '../services/auditService.js';

const router = express.Router();

/**
 * GET /api/audit
 * Query audit logs for tenant
 */
router.get('/',
  authenticateToken,
  requirePermission('tenant.users.view'), // Basic tenant access
  async (req, res) => {
    try {
      const {
        podId,
        userId,
        vmid,
        action,
        category,
        severity,
        startDate,
        endDate,
        limit = 100,
        offset = 0,
      } = req.query;
      
      const result = await auditService.queryAuditLogs({
        tenantId: req.user.tenantId,
        podId,
        userId,
        vmid: vmid ? parseInt(vmid) : undefined,
        action,
        category,
        severity,
        startDate,
        endDate,
        limit: Math.min(parseInt(limit), 500),
        offset: parseInt(offset),
      });
      
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * GET /api/audit/stats
 * Get audit statistics for dashboard
 */
router.get('/stats',
  authenticateToken,
  requirePermission('tenant.users.view'),
  async (req, res) => {
    try {
      const { days = 7 } = req.query;
      
      const stats = await auditService.getAuditStats(
        req.user.tenantId,
        parseInt(days)
      );
      
      res.json({ success: true, stats });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * GET /api/audit/security
 * Get recent security events
 */
router.get('/security',
  authenticateToken,
  requirePermission('tenant.users.view'),
  async (req, res) => {
    try {
      const { limit = 50 } = req.query;
      
      const result = await auditService.getSecurityEvents(
        req.user.tenantId,
        { limit: parseInt(limit) }
      );
      
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * GET /api/audit/export
 * Export audit logs for compliance
 */
router.get('/export',
  authenticateToken,
  requirePermission('tenant.billing.view'), // Require higher permission for export
  async (req, res) => {
    try {
      const { startDate, endDate, format = 'json' } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'startDate and endDate are required',
        });
      }
      
      const data = await auditService.exportAuditLogs({
        tenantId: req.user.tenantId,
        startDate,
        endDate,
        format,
      });
      
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="audit-log-${startDate}-to-${endDate}.csv"`);
        return res.send(data);
      }
      
      res.json({
        success: true,
        exportedAt: new Date().toISOString(),
        dateRange: { startDate, endDate },
        events: data,
        count: data.length,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * GET /api/cloud-pods/:vmid/audit
 * Get audit trail for a specific pod
 */
router.get('/pods/:vmid',
  authenticateToken,
  requirePermission('cloudpods.view'),
  async (req, res) => {
    try {
      const { vmid } = req.params;
      const { limit = 50, offset = 0 } = req.query;
      
      // Find pod by vmid
      const pod = await prisma.cloudPod.findFirst({
        where: {
          vmid: parseInt(vmid),
          tenantId: req.user.tenantId,
        },
      });
      
      if (!pod) {
        return res.status(404).json({
          success: false,
          error: 'Pod not found',
        });
      }
      
      const result = await auditService.queryAuditLogs({
        tenantId: req.user.tenantId,
        vmid: parseInt(vmid),
        limit: parseInt(limit),
        offset: parseInt(offset),
      });
      
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

export default router;
```

---

## 8. Integration Points

### 8.1 CloudPod Worker Events

Add audit logging to `cloudPodWorkers.ts`:

```typescript
// In cloudPodCreateWorker - after successful create
await logAuditEvent({
  tenantId: payload.tenantId,
  userId: payload.requestedBy !== 'api' ? payload.requestedBy : null,
  podId: pod.id,
  vmid: payload.vmid,
  action: 'POD_CREATE_COMPLETED',
  category: 'LIFECYCLE',
  severity: 'INFO',
  context: {
    hostname: result.hostname,
    ip: result.ip,
    node: result.node || 'pve',
    provisioningDurationMs: Date.now() - startTime,
    planCode: payload.planId,
  },
});

// On failure
await logAuditEvent({
  tenantId: payload.tenantId,
  userId: payload.requestedBy !== 'api' ? payload.requestedBy : null,
  vmid: payload.vmid,
  action: 'POD_CREATE_FAILED',
  category: 'LIFECYCLE',
  severity: 'ERROR',
  context: {
    error: error.message,
    attempt: job.attemptsMade,
  },
});
```

### 8.2 Quota Service Integration

Add audit logging to `cloudPodQuotas.js`:

```javascript
// When quota is exceeded
await logAuditEvent({
  tenantId,
  userId,
  action: 'QUOTA_EXCEEDED',
  category: 'QUOTA',
  severity: 'WARN',
  context: {
    resource: 'pods', // or cpu/memory/disk
    current: usage.pods,
    limit: quota.maxCloudPods,
    requested: 1,
    operation: 'CREATE_POD',
  },
});

// When quota is updated
await logAuditEvent({
  tenantId,
  userId: adminUserId,
  action: 'QUOTA_UPDATED',
  category: 'QUOTA',
  severity: 'INFO',
  context: {
    previous: { maxPods: oldQuota.maxCloudPods, ... },
    new: { maxPods: newQuota.maxCloudPods, ... },
  },
});
```

---

## 9. Prisma Schema Addition

```prisma
// Add to prisma/schema.prisma

model CloudPodAudit {
  id          String    @id @default(uuid())
  tenantId    String    @map("tenant_id")
  userId      String?   @map("user_id")
  podId       String?   @map("pod_id")
  vmid        Int?
  
  action      String
  category    String
  severity    String    @default("INFO")
  
  context     Json      @default("{}")
  
  ipAddress   String?   @map("ip_address")
  userAgent   String?   @map("user_agent")
  requestId   String?   @map("request_id")
  
  createdAt   DateTime  @default(now()) @map("created_at")
  
  tenant      Tenant    @relation(fields: [tenantId], references: [id])
  user        User?     @relation(fields: [userId], references: [id])
  pod         CloudPod? @relation(fields: [podId], references: [id])
  
  @@index([tenantId, createdAt(sort: Desc)])
  @@index([podId, createdAt(sort: Desc)])
  @@index([userId, createdAt(sort: Desc)])
  @@index([action, createdAt(sort: Desc)])
  @@index([vmid])
  @@index([category])
  @@map("cloud_pod_audit")
}
```

---

## 10. TypeScript Types

```typescript
// src/types/audit.d.ts

export type AuditCategory = 'LIFECYCLE' | 'ACCESS' | 'QUOTA' | 'SECURITY' | 'ADMIN';
export type AuditSeverity = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

export type LifecycleAction =
  | 'POD_CREATE_REQUESTED'
  | 'POD_CREATE_STARTED'
  | 'POD_CREATE_COMPLETED'
  | 'POD_CREATE_FAILED'
  | 'POD_DESTROY_REQUESTED'
  | 'POD_DESTROY_STARTED'
  | 'POD_DESTROY_COMPLETED'
  | 'POD_DESTROY_FAILED'
  | 'POD_SCALE_REQUESTED'
  | 'POD_SCALE_COMPLETED'
  | 'POD_SCALE_FAILED'
  | 'POD_BACKUP_REQUESTED'
  | 'POD_BACKUP_COMPLETED'
  | 'POD_BACKUP_FAILED';

export type AccessAction =
  | 'POD_CONSOLE_ACCESS'
  | 'POD_VIEWED'
  | 'PERMISSION_DENIED'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED';

export type QuotaAction =
  | 'QUOTA_UPDATED'
  | 'QUOTA_EXCEEDED'
  | 'QUOTA_WARNING'
  | 'QUOTA_RECALCULATED';

export type SecurityAction =
  | 'SECURITY_GROUP_CREATED'
  | 'SECURITY_GROUP_UPDATED'
  | 'SECURITY_GROUP_DELETED'
  | 'SECURITY_GROUP_ATTACHED'
  | 'SECURITY_GROUP_DETACHED';

export type AdminAction =
  | 'ROLE_ASSIGNED'
  | 'ROLE_REMOVED'
  | 'ROLE_CREATED'
  | 'USER_INVITED'
  | 'USER_REMOVED'
  | 'SETTINGS_UPDATED';

export type AuditAction =
  | LifecycleAction
  | AccessAction
  | QuotaAction
  | SecurityAction
  | AdminAction;

export interface AuditEvent {
  id: string;
  tenantId: string;
  userId?: string | null;
  podId?: string | null;
  vmid?: number | null;
  action: AuditAction;
  category: AuditCategory;
  severity: AuditSeverity;
  context: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  createdAt: string;
  
  // Expanded relations
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  } | null;
  pod?: {
    id: string;
    hostname: string;
    vmid: number;
  } | null;
}

export interface AuditQueryFilters {
  tenantId?: string;
  podId?: string;
  userId?: string;
  vmid?: number;
  action?: AuditAction;
  category?: AuditCategory;
  severity?: AuditSeverity;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface AuditQueryResult {
  events: AuditEvent[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditStats {
  byAction: Record<string, number>;
  bySeverity: Record<AuditSeverity, number>;
  byDay: Array<{ date: string; count: number }>;
}

export interface LogAuditEventParams {
  tenantId: string;
  userId?: string | null;
  podId?: string | null;
  vmid?: number | null;
  action: AuditAction;
  category?: AuditCategory;
  severity?: AuditSeverity;
  context?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}
```

---

## 11. Test Checklist

```bash
#!/bin/bash
# Audit Log Test Checklist

BASE="http://100.97.213.11:2271"

# 1. Query audit logs
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/audit" | jq

# 2. Filter by action
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/audit?action=POD_CREATE_COMPLETED&limit=10" | jq

# 3. Filter by date range
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/audit?startDate=2025-11-01&endDate=2025-11-30" | jq

# 4. Filter by severity (warnings and errors)
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/audit?severity=WARN" | jq

# 5. Get audit stats
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/audit/stats?days=7" | jq

# 6. Get security events
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/audit/security" | jq

# 7. Get audit trail for specific pod
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/audit/pods/107" | jq

# 8. Export audit logs (JSON)
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/audit/export?startDate=2025-11-01&endDate=2025-11-30" | jq

# 9. Export audit logs (CSV)
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/audit/export?startDate=2025-11-01&endDate=2025-11-30&format=csv" > audit.csv

# 10. Trigger an action and verify it appears in audit
# Create a pod, then check audit:
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/audit?action=POD_CREATE_REQUESTED&limit=1" | jq
```

---

## 12. Migration Script

```sql
-- migrations/YYYYMMDD_add_audit_table.sql

-- Create audit log table
CREATE TABLE IF NOT EXISTS cloud_pod_audit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  user_id         UUID,
  pod_id          UUID,
  vmid            INT,
  
  action          VARCHAR(50) NOT NULL,
  category        VARCHAR(30) NOT NULL,
  severity        VARCHAR(10) DEFAULT 'INFO',
  
  context         JSONB NOT NULL DEFAULT '{}',
  
  ip_address      INET,
  user_agent      TEXT,
  request_id      UUID,
  
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for common queries
CREATE INDEX idx_audit_tenant_time ON cloud_pod_audit(tenant_id, created_at DESC);
CREATE INDEX idx_audit_pod ON cloud_pod_audit(pod_id, created_at DESC) WHERE pod_id IS NOT NULL;
CREATE INDEX idx_audit_user ON cloud_pod_audit(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_action ON cloud_pod_audit(action, created_at DESC);
CREATE INDEX idx_audit_vmid ON cloud_pod_audit(vmid) WHERE vmid IS NOT NULL;
CREATE INDEX idx_audit_category ON cloud_pod_audit(category);
CREATE INDEX idx_audit_severity ON cloud_pod_audit(severity) WHERE severity != 'INFO';

-- Prevent modifications (audit log is immutable)
CREATE OR REPLACE RULE audit_no_update AS ON UPDATE TO cloud_pod_audit DO INSTEAD NOTHING;
CREATE OR REPLACE RULE audit_no_delete AS ON DELETE TO cloud_pod_audit DO INSTEAD NOTHING;

-- Foreign keys (optional - may impact write performance)
-- ALTER TABLE cloud_pod_audit ADD CONSTRAINT fk_audit_tenant 
--   FOREIGN KEY (tenant_id) REFERENCES tenants(id);
-- ALTER TABLE cloud_pod_audit ADD CONSTRAINT fk_audit_user 
--   FOREIGN KEY (user_id) REFERENCES users(id);
-- ALTER TABLE cloud_pod_audit ADD CONSTRAINT fk_audit_pod 
--   FOREIGN KEY (pod_id) REFERENCES cloud_pods(id);

-- Comment
COMMENT ON TABLE cloud_pod_audit IS 'Immutable audit log for CloudPods compliance trail';
```

---

## 13. Retention Policy

For long-term storage efficiency:

```sql
-- Create partitioned table (optional, for high-volume tenants)
-- Partition by month for easy archival

-- Archive old audit logs to cold storage
CREATE TABLE cloud_pod_audit_archive (
  LIKE cloud_pod_audit INCLUDING ALL
);

-- Move data older than 90 days to archive (run monthly)
INSERT INTO cloud_pod_audit_archive
SELECT * FROM cloud_pod_audit
WHERE created_at < NOW() - INTERVAL '90 days';

DELETE FROM cloud_pod_audit
WHERE created_at < NOW() - INTERVAL '90 days';

-- Or use pg_partman for automatic partitioning
```
