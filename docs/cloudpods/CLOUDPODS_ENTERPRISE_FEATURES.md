# ☁️ CloudPods – Enterprise Features Spec

> **Document Version**: 1.0  
> **Last Updated**: 2025-11-29  
> **Status**: Ready for Implementation

This document extends the base CloudPods system with **enterprise-grade capabilities**:

| # | Feature | Spec Document | Status |
|---|---------|--------------|--------|
| 1 | Audit Log | [`audit-log.md`](./audit-log.md) | ✅ Spec Complete |
| 2 | Per-tenant RBAC | [`rbac.md`](./rbac.md) | ✅ Spec Complete |
| 3 | Security Groups | [`security-groups.md`](./security-groups.md) | ✅ Spec Complete |
| 4 | Health Monitoring & Auto-heal | [`health-monitoring.md`](./health-monitoring.md) | ✅ Spec Complete |
| 5 | Usage Metering & Budgets | [`usage-metering.md`](./usage-metering.md) | ✅ Spec Complete |
| 6 | Snapshot & Backup Policies | [`snapshot-policies.md`](./snapshot-policies.md) | ✅ Spec Complete |
| 7 | Webhooks | [`webhooks.md`](./webhooks.md) | ✅ Spec Complete |

---

## Infrastructure Reference

### Tailscale Hosts

| Alias | Purpose | IP |
|-------|---------|-----|
| `pve` | Proxmox host | 100.73.199.109 |
| `srv1-web` | Main web/hosting node | 100.68.239.94 |
| `cloud-core` | MinIO / object storage | 100.65.164.127 |
| `db-core` | Database node | 100.98.54.45 |
| `dns-core` | PowerDNS / DNS | 100.73.241.82 |
| `mail-core` | Primary mail server | 100.64.119.23 |
| `mail-vps` | Legacy/secondary mail VPS | 100.123.151.26 |
| `mpanel-core` | mPanel backend API | 100.97.213.11 |
| `vps-web-hosting` | Client sites VPS | 100.119.108.65 |
| `srv2` | Old node (legacy) | 100.87.67.45 |

### SSH Access

```bash
ssh mpanel-core    # mPanel backend
ssh pve            # Proxmox
ssh db-core        # PostgreSQL
```

---

## Database Schema Overview

### New Tables (25 total)

#### Audit & RBAC (4 tables)
```
cloud_pod_audit
tenant_roles
tenant_user_roles  
tenant_role_permissions
```

#### Security Groups (3 tables)
```
cloud_pod_security_groups
cloud_pod_security_group_rules
cloud_pod_security_group_assignments
```

#### Health Monitoring (5 tables)
```
cloud_pod_health_checks
cloud_pod_health_results
cloud_pod_health_status
cloud_pod_auto_heal_policies
cloud_pod_auto_heal_events
```

#### Usage Metering (6 tables)
```
cloud_pod_usage_samples
cloud_pod_usage_hourly
cloud_pod_usage_daily
cloud_pod_usage_monthly
cloud_pod_budgets
cloud_pod_budget_alerts
cloud_pod_pricing
```

#### Snapshot Policies (4 tables)
```
cloud_pod_snapshot_policies
cloud_pod_snapshot_policy_assignments
cloud_pod_snapshots
cloud_pod_snapshot_restores
cloud_pod_snapshot_jobs
```

#### Webhooks (3 tables)
```
cloud_pod_webhooks
cloud_pod_webhook_deliveries
cloud_pod_events
```

---

## Permission Keys

### CloudPods Permissions

| Permission | Description |
|------------|-------------|
| `cloudpods.view` | View pods, metrics, quotas |
| `cloudpods.manage` | Create, start, stop, reboot, scale |
| `cloudpods.destroy` | Delete/destroy pods |
| `cloudpods.security.manage` | Security groups |
| `cloudpods.backups.manage` | Snapshot policies & manual backups |
| `cloudpods.metrics.view` | Usage charts, health metrics |
| `cloudpods.quota.view` | View quota usage |
| `cloudpods.quota.manage` | Modify tenant quotas (admin) |
| `cloudpods.webhooks.manage` | Webhook configuration |
| `audit.view` | View audit logs |

### Role Mappings

| Role | Permissions |
|------|-------------|
| `cloud_admin` | All CloudPods permissions |
| `cloud_devops` | All except `quota.manage` |
| `cloud_developer` | `view`, `manage`, `metrics.view` |
| `cloud_viewer` | `view`, `metrics.view` (read-only) |

---

## API Endpoints Summary

### Audit Log
- `GET /api/cloud-pods/audit` - Query audit events
- `GET /api/cloud-pods/:vmid/audit` - Pod-specific audit

### Security Groups
- `GET /api/cloud-pods/security-groups` - List
- `POST /api/cloud-pods/security-groups` - Create
- `PUT /api/cloud-pods/security-groups/:id` - Update
- `DELETE /api/cloud-pods/security-groups/:id` - Delete
- `POST /api/cloud-pods/:id/security-groups/attach` - Attach to pod
- `POST /api/cloud-pods/:id/security-groups/detach` - Detach from pod

### Health Monitoring
- `GET /api/cloud-pods/:id/health` - Current health status
- `GET /api/cloud-pods/:id/health/history` - Health history
- `PUT /api/cloud-pods/:id/health/config` - Configure health checks
- `GET /api/cloud-pods/health/overview` - Tenant health overview
- `GET /api/cloud-pods/auto-heal/policies` - Auto-heal policies
- `POST /api/cloud-pods/auto-heal/policies` - Create/update policy

### Usage Metering
- `GET /api/cloud-pods/usage/current` - Current month usage
- `GET /api/cloud-pods/:id/usage` - Pod usage history
- `GET /api/cloud-pods/:id/usage/realtime` - Real-time metrics
- `POST /api/cloud-pods/usage/estimate` - Cost estimator
- `GET /api/cloud-pods/budget` - Budget config
- `PUT /api/cloud-pods/budget` - Set budget
- `GET /api/cloud-pods/budget/alerts` - Alert history

### Snapshot Policies
- `GET /api/cloud-pods/snapshot-policies` - List policies
- `POST /api/cloud-pods/snapshot-policies` - Create policy
- `PUT /api/cloud-pods/snapshot-policies/:id` - Update policy
- `DELETE /api/cloud-pods/snapshot-policies/:id` - Delete policy
- `POST /api/cloud-pods/snapshot-policies/:id/assign` - Assign to pods
- `GET /api/cloud-pods/:id/snapshots` - List pod snapshots
- `POST /api/cloud-pods/:id/snapshots` - Create manual snapshot
- `POST /api/cloud-pods/:id/snapshots/:snapId/restore` - Restore

### Webhooks
- `GET /api/cloud-pods/webhooks` - List webhooks
- `POST /api/cloud-pods/webhooks` - Create webhook
- `PUT /api/cloud-pods/webhooks/:id` - Update webhook
- `DELETE /api/cloud-pods/webhooks/:id` - Delete webhook
- `POST /api/cloud-pods/webhooks/:id/test` - Test webhook
- `POST /api/cloud-pods/webhooks/:id/rotate-secret` - Rotate secret
- `GET /api/cloud-pods/webhooks/:id/deliveries` - Delivery history

---

## Workers Required

| Worker | Queue | Purpose |
|--------|-------|---------|
| `healthCheckWorker` | `cloudpod-health-checks` | Execute health probes |
| `meteringWorker` | `cloudpod-metering` | Collect/aggregate usage |
| `snapshotWorker` | `cloudpod-snapshots` | Execute scheduled backups |
| `webhookWorker` | `cloudpod-webhooks` | Deliver webhook events |
| `securityGroupWorker` | `cloudpod-security` | Sync firewall rules to Proxmox |

---

## Event Types (for Audit + Webhooks)

### Lifecycle Events
```
POD_CREATE_REQUEST, POD_CREATED, POD_CREATE_FAILED
POD_DESTROY_REQUEST, POD_DESTROYED, POD_DESTROY_FAILED
POD_START, POD_STOP, POD_REBOOT
POD_SCALE_REQUEST, POD_SCALED
```

### Security Events
```
SECURITY_GROUP_CREATED, SECURITY_GROUP_UPDATED, SECURITY_GROUP_DELETED
SECURITY_GROUP_ATTACHED, SECURITY_GROUP_DETACHED
```

### Health Events
```
HEALTH_CHECK_FAILED, HEALTH_CHECK_RECOVERED
POD_AUTORESTART_TRIGGERED, AUTO_HEAL_RESET
```

### Backup Events
```
BACKUP_POLICY_CREATED, BACKUP_POLICY_UPDATED, BACKUP_POLICY_DELETED
POD_BACKUP_STARTED, POD_BACKUP_COMPLETED, POD_BACKUP_FAILED
POD_RESTORE_STARTED, POD_RESTORE_COMPLETED, POD_RESTORE_FAILED
```

### Quota/Budget Events
```
QUOTA_CHECK_FAILED, TENANT_QUOTA_UPDATED
BUDGET_THRESHOLD_REACHED, BUDGET_LIMIT_EXCEEDED
```

### Webhook Events
```
WEBHOOK_CREATED, WEBHOOK_UPDATED, WEBHOOK_DELETED
WEBHOOK_DELIVERY_ATTEMPT, WEBHOOK_DELIVERY_FAILED
WEBHOOK_AUTO_DISABLED
```

---

## Implementation Order

### Phase 1: Foundation (Week 1)
1. **Audit Log** - Required for all other features
2. **RBAC** - Permission enforcement

### Phase 2: Security (Week 2)
3. **Security Groups** - Firewall rules

### Phase 3: Observability (Week 3)
4. **Health Monitoring** - Health checks + auto-heal
5. **Usage Metering** - Metrics + budgets

### Phase 4: Data Protection (Week 4)
6. **Snapshot Policies** - Automated backups

### Phase 5: Integration (Week 5)
7. **Webhooks** - Event notifications

---

## Copilot Implementation Rules

### Do Not Leak Logic
```javascript
// ❌ BAD - Logic in route handler
router.post('/pods', async (req, res) => {
  await prisma.cloudPodAudit.create({ ... }); // No!
});

// ✅ GOOD - Dedicated service
router.post('/pods', async (req, res) => {
  await auditService.log(podId, userId, 'POD_CREATED', { ... });
});
```

### Always Write Audit Records
```javascript
// Every major action must audit
await auditLog(podId, userId, 'POD_CREATED', details);
await auditLog(null, userId, 'SECURITY_GROUP_CREATED', details, tenantId);
await auditLog(podId, null, 'POD_AUTORESTART_TRIGGERED', details); // System action
```

### Never Leak Tenant Data
```javascript
// ❌ BAD
const pods = await prisma.cloudPod.findMany();

// ✅ GOOD
const pods = await prisma.cloudPod.findMany({
  where: { tenantId: req.user.tenantId }
});
```

### Use Permission Keys
```javascript
// ❌ BAD
if (user.isAdmin) { ... }

// ✅ GOOD
requirePermission('cloudpods.manage')
requirePermission('cloudpods.security.manage')
```

### No Direct Proxmox Calls
```javascript
// ❌ BAD - Direct API call from service
await axios.post('https://pve:8006/api2/json/...');

// ✅ GOOD - Through SSH worker
await runProxmoxCommand('qm start 101');
```

### Idempotent Workers
```javascript
// Workers must handle restarts gracefully
async function processJob(job) {
  // Check if already processed
  const existing = await prisma.cloudPodSnapshot.findUnique({
    where: { id: job.data.snapshotId }
  });
  if (existing?.status === 'completed') {
    return { skipped: true, reason: 'Already completed' };
  }
  // ... proceed
}
```

### Configurable Thresholds
```javascript
// ❌ BAD - Hard-coded
const MAX_FAILURES = 3;

// ✅ GOOD - From config/settings
const MAX_FAILURES = config.autoHeal.maxFailures || 3;
const RETENTION_DAYS = await getSystemSetting('audit.retentionDays', 180);
```

---

## File Structure

```
src/
├── services/
│   ├── cloudPodAudit.js
│   ├── cloudPodRbac.js
│   ├── cloudPodSecurityGroups.js
│   ├── cloudPodHealth.js
│   ├── cloudPodMetering.js
│   ├── cloudPodSnapshots.js
│   └── cloudPodWebhooks.js
├── workers/
│   ├── healthCheckWorker.js
│   ├── meteringWorker.js
│   ├── snapshotWorker.js
│   ├── webhookWorker.js
│   └── securityGroupWorker.js
├── middleware/
│   └── cloudPodRbac.js
└── routes/
    └── cloudPodRoutes.js  (extended)

docs/cloudpods/
├── CLOUDPODS_ENTERPRISE_FEATURES.md  (this file)
├── audit-log.md
├── rbac.md
├── security-groups.md
├── health-monitoring.md
├── usage-metering.md
├── snapshot-policies.md
└── webhooks.md
```

---

## Prisma Migration

Generate combined migration:

```bash
# On mpanel-core
cd /opt/mpanel
npx prisma migrate dev --name enterprise_features
```

This will create all 25 tables in a single migration.

---

## Deployment Checklist

- [ ] Run Prisma migration on `db-core`
- [ ] Deploy updated backend to `mpanel-core`
- [ ] Start all workers with PM2
- [ ] Configure default tenant roles
- [ ] Set up system settings (retention, thresholds)
- [ ] Update dashboard UI
- [ ] Create customer documentation
- [ ] Test webhook integrations
- [ ] Configure monitoring/alerting

---

## Related Documents

- [CloudPods Master Spec](../CLOUDPODS_MASTER_SPEC.md)
- [CloudPods Quota System](./cloudPodQuotas.md)
- [Proxmox SSH Integration](../PROXMOX_SSH.md)
- [BullMQ Queue Architecture](../QUEUE_ARCHITECTURE.md)
