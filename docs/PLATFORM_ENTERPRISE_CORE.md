# 🏢 mPanel / CloudPods – Enterprise Core Spec

This document extends mPanel + CloudPods with enterprise features:

1. System Settings (global config)
2. CloudPods Admin Dashboard
3. Tenant Resource Plans (cloud billing layer)
4. Templates & Blueprints v2
5. Logging & Observability
6. Worker Orchestration System (Jobs v2)
7. Volumes & Storage Manager
8. DNS Integration for Pods
9. Pod Lifecycle Hooks

It defines data models, APIs, and responsibilities so Copilot has a **single source of truth**.

---

## 1. System Settings (Global Config)

### 1.1 Goals

Central place to configure:

- Backup retention defaults
- Auto-heal thresholds
- Metrics/health intervals
- Webhook retry policy
- Audit/log retention
- Default CloudPods quotas
- Global branding, email, security

### 1.2 Data Model

```txt
Table: system_settings
- id (PK)
- namespace (string)   e.g. "cloudpods", "billing", "branding"
- key (string)         e.g. "auto_heal.enabled"
- value (text/json)
- value_type (string)  "string" | "number" | "boolean" | "json"
- updated_by (user_id)
- updated_at (timestamp)
```

Uniqueness: namespace + key.

### 1.3 Access

Managed through /admin/settings UI (System Settings module).

Only roles with settings.manage can change values.

Backend uses a SystemSettingsService (below in code section) to read typed values with defaults.

### 1.4 Example Keys

Namespace cloudpods:

- `cloudpods.auto_heal.enabled` – boolean
- `cloudpods.auto_heal.failure_threshold` – number (e.g. 3)
- `cloudpods.backup.default_retention_count` – number
- `cloudpods.metrics.sample_interval_seconds` – number
- `cloudpods.audit.retention_days` – number
- `cloudpods.webhooks.max_attempts` – number
- `cloudpods.webhooks.initial_retry_delay_seconds` – number

Namespace platform:

- `platform.timezone`
- `platform.brand_name`
- `platform.primary_color`

Workers and services must read from settings, never hardcode these.

---

## 2. CloudPods Admin Dashboard

### 2.1 Goals

Admin-only dashboard for:

- Global pod stats
- Tenant usage ranking
- Health, failures, queues
- Recent audit events

### 2.2 API

`GET /api/cloud-pods/admin/overview` (requires cloudpods.view + health.view + admin scope)

Returns:

```json
{
  "totals": {
    "pods": { "total": 123, "active": 97, "error": 3, "deleting": 2 },
    "tenants": 24
  },
  "resources": {
    "cpuCores": { "allocated": 320, "usedApprox": 210 },
    "memoryMb": { "allocated": 512000, "usedApprox": 320000 },
    "diskGb": { "allocated": 10000, "usedApprox": 6200 }
  },
  "health": {
    "unhealthyPods": 5,
    "autoHealTriggeredLast24h": 3
  },
  "recentEvents": [
    /* last N audit items with category=lifecycle|health|backup|quota */
  ],
  "topTenantsByUsage": [
    { "tenantId": "...", "name": "...", "pods": 10, "cpuCores": 40, "memoryMb": 64000 }
  ]
}
```

UI:

- Cards: total pods, tenants, unhealthy pods, last 24h backups.
- Chart: pods created vs destroyed (7d).
- Table: top 10 tenants by usage.

---

## 3. Tenant Resource Plans (Cloud Billing Layer)

### 3.1 Goals

Introduce resource packs separate from individual pods:

- CPU, RAM, disk, bandwidth, IPs.
- Plans that tenants subscribe to.
- Quotas derived from these subscriptions.

### 3.2 Data Model

```txt
Table: cloud_resource_plans
- id
- code (string)     e.g. "cloud-basic", "cloud-plus"
- name
- description
- cpu_cores (int)
- memory_mb (int)
- disk_gb (int)
- bandwidth_gb (int nullable)
- price_monthly (decimal)
- is_active (bool)

Table: cloud_tenant_resource_subscriptions
- id
- tenant_id
- plan_id
- quantity (int)            # number of plan units
- status ("active","cancelled")
- started_at
- ends_at (nullable)

Table: cloud_tenant_resource_totals (materialized view or table)
- id
- tenant_id
- cpu_cores_total
- memory_mb_total
- disk_gb_total
- bandwidth_gb_total
- updated_at
```

### 3.3 Integration with Quotas

`cloud_pod_quotas` default limits become:

- Derived from `cloud_tenant_resource_totals` (sum of active subscriptions).

`CloudPodQuotasService.getTenantQuota()`:

- If per-tenant quota row exists → use it.
- Else → compute from resource subscriptions OR fallback default.

---

## 4. Templates & Blueprints v2

### 4.1 Goals

Richer templates:

- OS-only templates (Ubuntu, Debian, etc.)
- App stacks (WordPress, Laravel, Node, etc.)
- Additional install options (DB, Redis)

### 4.2 Data Model (extends existing blueprints)

```txt
Table: cloud_pod_templates
- id
- code
- name
- type ("os", "app")
- description
- proxmox_template_vmid
- default_node
- storage_pool
- network_bridge
- app_stack (nullable)     e.g. "wordpress","laravel"
- minimum_plan_code (nullable)
- tags (json array)
- is_active (bool)
```

API:

- `GET /api/cloud-pods/templates` – list active templates.
- `GET /api/cloud-pods/templates/:code`

On order:

- Validate plan supports template (minimum_plan_code).
- Worker uses template's VMID and app_stack to run relevant cloud-init/bootstrap.

---

## 5. Logging & Observability

### 5.1 Goals

Centralized observability for:

- CloudPods actions
- Workers
- API calls

### 5.2 Strategy

Use:

- Existing `cloud_pod_audit` for business actions.
- Standard logger (pino/winston) for backend logs.
- Optional integration with external stack (ELK, Loki, etc.).

Additional table (optional):

```txt
Table: system_events
- id
- service ("api","cloudpods-worker",...)
- level ("info","warn","error")
- message
- context (JSON)
- created_at
```

Admin UI:

- `GET /api/admin/system-events?service=&level=&from=&to=`
- Used by System Health page.

---

## 6. Worker Orchestration (Jobs v2)

### 6.1 Goals

Unified job engine for:

- CloudPod provisioning
- Backups
- Health checks
- Metrics
- Webhooks

We'll use:

- `jobs` table
- `job_attempts`
- `job_workers` (optional)

### 6.2 Data Model

```txt
Table: jobs
- id
- queue (string)           e.g. "cloudpods", "metrics", "backups", "webhooks"
- type (string)            e.g. "pod.provision","pod.destroy","pod.health.check"
- payload (json)
- status ("pending","running","completed","failed","dead")
- priority (int)
- attempts (int)
- max_attempts (int)
- scheduled_at (timestamp)
- started_at (timestamp)
- completed_at (timestamp)
- last_error (text nullable)
- created_at
- updated_at

Table: job_workers
- id
- name
- queue
- last_heartbeat_at
- status ("online","offline","draining")
```

Job Engine rules:

Workers poll jobs where:

- `status="pending"`
- `scheduled_at <= now()`

Mark as running → process → completed or failed.

If failed and attempts < max → reschedule with backoff.

If attempts >= max → dead (and audit if critical).

Queues:

- `cloudpods` – lifecycle & security.
- `metrics` – usage collection.
- `health` – health checks & auto-heal.
- `backups` – backup & retention.
- `webhooks` – webhook deliveries.

---

## 7. Volumes & Storage Manager

### 7.1 Goals

Per-pod volumes:

- Create additional disks/volumes.
- Attach/detach.
- Resize.
- (Future) Move between nodes.

### 7.2 Data Model

```txt
Table: cloud_pod_volumes
- id
- tenant_id
- pod_id
- name
- size_gb
- storage_pool
- status ("creating","attached","detached","error","deleting")
- proxmox_volume_id (nullable)
- created_at
- updated_at
```

Actions:

- `POST /api/cloud-pods/:podId/volumes`
  - Creates volume + job `volume.create`.
- `POST /api/cloud-pods/:podId/volumes/:id/attach`
  - Job `volume.attach`.
- `POST /api/cloud-pods/:podId/volumes/:id/detach`
- `POST /api/cloud-pods/:podId/volumes/:id/resize`
- `DELETE /api/cloud-pods/:podId/volumes/:id`

Permissions:

- `cloudpods.manage` (or dedicated `cloudpods.volumes.manage` if you want).

Worker:

- Uses `proxmoxSsh` to create/attach LVM/ZFS volume and update VM config.

---

## 8. DNS Integration for Pods

### 8.1 Goals

Automatic DNS records for CloudPods:

- A records for pod hostnames.
- Optional PTR / rDNS.
- Basic health checks.

### 8.2 Data Model

```txt
Table: cloud_pod_dns_records
- id
- tenant_id
- pod_id
- zone_name     e.g. "clientdomain.com"
- hostname      e.g. "app.clientdomain.com"
- ip_address
- type          "A" | "AAAA"
- status        "pending","active","error"
- created_at
- updated_at
```

Interaction with your DNS stack (PowerDNS/PDNS-Admin) via:

- `DnsService.createARecord(zone, host, ip)`
- `DnsService.deleteRecord(id)`
- Health check worker for DNS if needed.

Events:

- On `pod.created` with hostname → create record.
- On `pod.deleted` → delete record.

---

## 9. Pod Lifecycle Hooks

### 9.1 Goals

Event hooks for:

- Pre- and post- actions around key lifecycle steps.

### 9.2 Data Model

```txt
Table: cloud_pod_hooks
- id
- tenant_id
- name
- event ("pod.pre_create","pod.post_create","pod.pre_destroy","pod.post_destroy","pod.post_backup")
- type ("http","script")
- target (string)         # URL or script identifier
- is_active (bool)
- config (json)           # headers, timeout, env, etc.
- created_at
- updated_at
```

Execution:

Worker subscribes to internal events like `pod.created` etc.

For each active hook matching event & tenant:

- Enqueue `hook.execute` job:
  - If `type="http"` → POST to URL with event payload.
  - If `type="script"` → call local/external script runner.

Important: lifecycle hooks do not block core system; failures are logged but pod lifecycle continues, unless you explicitly configure "blocking hooks" for special cases.

---

## Implementation Priority

1. **Phase 1 - Foundation**
   - System Settings
   - Job Engine
   - Admin Dashboard

2. **Phase 2 - Storage & DNS**
   - Volumes & Storage Manager
   - DNS Integration

3. **Phase 3 - Advanced**
   - Lifecycle Hooks
   - Templates v2
   - Resource Plans

---

## Related Files

- `src/services/systemSettingsService.ts` - Settings service
- `src/services/jobEngine.ts` - Job engine
- `src/workers/cloudPodsWorker.ts` - CloudPods worker using job engine
- `prisma/migrations/20251129_platform_enterprise/migration.sql` - Database migration
