# 🌩 CloudPods – Master System Specification (mPanel)

> **Source of Truth**  
> This document is the canonical reference for the CloudPods subsystem in mPanel.  
> All code changes, Copilot suggestions, and future features MUST follow this spec.

---

## 0. Glossary

- **CloudPod** – A virtual machine (VM) provisioned on Proxmox and managed via mPanel.
- **Tenant** – Logical customer (business or individual) that owns CloudPods.
- **Plan** – Commercial product defining resources (vCPU, RAM, disk, bandwidth) and price.
- **Blueprint** – Technical template describing how to build a VM on Proxmox.
- **Quota** – Limits per tenant on total pods, CPU, memory, and disk.
- **Worker** – Background process that executes long-running operations via SSH on Proxmox.
- **Queue** – Database-backed job queue for CloudPod operations.

---

## 1. System Overview

CloudPods is MigraHosting's internal cloud compute platform:

- Exposes REST APIs under `/api/cloud-pods/*`.
- Manages VM lifecycle:
  - Create → Provision → Active → Scale → Backup → Destroy.
- Executes provisioning on Proxmox over SSH (no direct DB from Proxmox).
- Enforces tenant resource quotas.
- Integrates with plan config (`CLOUD_POD_PLANS`) and billing.
- Designed as a modular subsystem in mPanel with strict separation of concerns.

---

## 2. High-Level Architecture

**Layers (top → bottom):**

1. **UI Layer (mPanel frontend)**
   - Calls CloudPods API.
   - Shows plans, quotas, pod status.

2. **API Routes**
   - File: `src/routes/cloudPodRoutes.js`
   - Validates input, auth, and authorization.
   - Delegates to service layer.
   - Never touches SSH or raw SQL directly.

3. **Service Layer**
   - Files:
     - `src/services/cloudPodService.js` (if not present, must be created)
     - `src/services/cloudPodQueues.js`
     - `src/services/cloudPodQuotas.js`
   - Encapsulates business logic, DB access, and queueing.
   - No SSH; calls lower-level Proxmox service if needed via worker.

4. **Worker Layer**
   - File: `cloudPodWorker.js`
   - Polls queue, executes operations on Proxmox via SSH.
   - Updates pod state and queue status in DB.

5. **Infrastructure Layer**
   - File: `src/services/proxmoxSsh.js`
   - SSH client for Proxmox commands.
   - Reads connection info from environment/config, never hard-coded.

All CloudPods behavior must flow **top-to-bottom**:

`UI → API Routes → Services → Queue/Worker → Proxmox SSH`

Never the other way around.

---

## 3. Data Model (Canonical Tables)

### 3.1 `cloud_pods`

Authoritative record of each CloudPod.

Essential columns:

- `id` – Internal pod ID (e.g. `pod-1764399306066`).
- `tenant_id` – Tenant owner.
- `user_id` – User that created it (optional).
- `plan_code` – Key into `CLOUD_POD_PLANS`.
- `vmid` – Proxmox VM ID.
- `node` – Proxmox node name.
- `ip_address` – Assigned IP (nullable until ready).
- `status` – `pending`, `provisioning`, `active`, `error`, `deleting`, `deleted`.
- `cpu_cores`, `memory_mb`, `disk_gb` – Effective resources.
- `provisioning_state` – JSON/text for extra metadata/logs.
- `created_at`, `updated_at`, `deleted_at`.

**Invariant:**  
Every real VM in Proxmox managed by CloudPods must have an entry in `cloud_pods`.

---

### 3.2 `cloud_pod_queue`

Job queue for actions.

Columns (conceptual):

- `id` – Queue item ID.
- `pod_id` – References `cloud_pods.id`.
- `action` – `create`, `destroy`, `start`, `stop`, `reboot`, `backup`, `scale`, `sync`.
- `payload` – JSON with parameters.
- `status` – `queued`, `running`, `success`, `failed`.
- `retry_count` – Int.
- `error_message` – Last error (if any).
- `created_at`, `updated_at`, `processed_at`.

Only the **worker** should set `status='running' | 'success' | 'failed'`.

---

### 3.3 `cloud_pod_jobs` (optional grouping)

Tracks one higher-level user action that may span multiple queue items.

Columns (conceptual):

- `id` – Job ID.
- `tenant_id`, `user_id`.
- `type` – `provision`, `destroy`, `scale`, etc.
- `status` – `pending`, `running`, `success`, `failed`.
- `queue_item_ids` – JSON array of queue IDs.
- `created_at`, `updated_at`.

---

### 3.4 `cloud_pod_plans`

Commercial plan definitions (backed by `CLOUD_POD_PLANS` config and/or DB).

Key attributes:

- `code` – Primary key used in APIs (e.g. `student`, `starter`, `premium`, `business`).
- `name`, `description`.
- `price_monthly`.
- `vcpu`, `ram_mb`, `storage_gb`, `bandwidth_gb` (or `bandwidth_type`).
- `is_active`.
- Optional: `max_pods_per_tenant`, `billing_product_id`.

API: `GET /api/cloud-pods/plans`, `GET /api/cloud-pods/plans/:code`, `GET /api/cloud-pods/compare`.

---

### 3.5 `cloud_pod_blueprints`

Technical templates for Proxmox.

Key attributes:

- `id` / `code` – e.g. `ubuntu-24-minimal`.
- `name`, `description`.
- `proxmox_template_vmid`.
- `default_node`.
- `storage_pool`.
- `network_bridge`.
- `cloud_init_profile` / metadata for automation.
- `is_active`.

Blueprint + Plan = concrete VM configuration.

---

### 3.6 `cloud_pod_quotas`

Per-tenant limits. See `quota-system.md` for full details.

Minimal fields:

- `tenant_id`
- `max_pods`
- `max_cpu_cores`
- `max_memory_mb`
- `max_disk_gb`

---

## 4. Core Runtime Flows

### 4.1 Create CloudPod

1. **UI →** `POST /api/cloud-pods/order`
2. **Route** validates auth, body (planCode, blueprint, name, options).
3. **Route** resolves plan from `CLOUD_POD_PLANS`.
4. **Route** calls `checkTenantQuota({ tenantId, requested })` with:
   - `pods: 1`
   - `cpuCores: plan.vcpu`
   - `memoryMb: plan.ramMb`
   - `diskGb: plan.storageGb`
5. If **not allowed**, respond `403 QUOTA_EXCEEDED` with structured details.
6. If allowed:
   - Create `cloud_pods` record with `status='pending'`.
   - Enqueue `create` in `cloud_pod_queue`.
   - Optionally create `cloud_pod_jobs` record.
7. **Worker** picks up job:
   - Marks queue item `running`.
   - Uses `proxmoxSsh` to:
     - Clone template.
     - Set VM resources (CPU/RAM/disk).
     - Configure network & cloud-init.
     - Start VM.
   - Writes `vmid`, `ip_address`, `status='active'` to `cloud_pods`.
   - Marks queue `success` or `failed`.

---

### 4.2 Pod Actions

All actions go through **API → Service → Queue → Worker**:

- `POST /api/cloud-pods/:vmid/destroy`
- `POST /api/cloud-pods/:vmid/scale`
- `POST /api/cloud-pods/:vmid/backup`
- `POST /api/cloud-pods/:vmid/reboot`, etc.

The route:

1. Auth + tenant ownership check.
2. Builds requested delta resources (scale only).
3. Optional quota check for scale.
4. Enqueues queue item with action + payload.

Worker executes via `proxmoxSsh` and updates `cloud_pods` state.

---

### 4.3 Quota Checks

Centralized in `src/services/cloudPodQuotas.js`.

Key functions:

- `getTenantQuota(tenantId)`  
- `getTenantUsage(tenantId)`  
- `checkTenantQuota({ tenantId, requested })`  
- `getQuotaSummary(tenantId)`  
- `recalculateUsage(tenantId)`

Default global limits (if no row in DB):

- **Pods**: 2  
- **CPU**: 4 cores  
- **Memory**: 8 GB  
- **Disk**: 200 GB  

`checkTenantQuota` returns:

```ts
{
  allowed: boolean;
  message?: string;
  details?: {
    max_pods: number;
    current_pods: number;
    requested_pods: number;
    max_cpu_cores: number;
    current_cpu_cores: number;
    requested_cpu_cores: number;
    max_memory_mb: number;
    current_memory_mb: number;
    requested_memory_mb: number;
    max_disk_gb: number;
    current_disk_gb: number;
    requested_disk_gb: number;
    error_field?: string;
    error_code?: string;
  }
}
```

---

## 5. API Endpoints (Summary)

See `api-endpoints.md` for full request/response shapes.

### Public (no auth)

- `GET /api/cloud-pods/plans` – list plans.
- `GET /api/cloud-pods/plans/:code` – plan detail.
- `GET /api/cloud-pods/compare` – comparison table.

### Protected (auth required)

- `POST /api/cloud-pods/order` – Create CloudPod.
- `GET /api/cloud-pods` – List pods for tenant/user.
- `GET /api/cloud-pods/:vmid` – Pod details.
- `POST /api/cloud-pods/:vmid/destroy` – Destroy pod.
- `POST /api/cloud-pods/:vmid/backup` – Trigger backup.
- `GET /api/cloud-pods/:vmid/health` – Health check.
- `POST /api/cloud-pods/:vmid/scale` – Scale resources.

### Quota-related

- `GET /api/cloud-pods/my-quota` – Tenant's quota summary.
- `GET /api/cloud-pods/check-quota?planCode={code}` – Pre-check capacity for plan.
- `GET /api/cloud-pods/tenants/:id/quota` – Admin view quota.
- `POST /api/cloud-pods/tenants/:id/quota` – Admin update quota.

### Admin stats

- `GET /api/cloud-pods/admin/stats` – System-wide metrics.

---

## 6. Proxmox Integration

- All SSH communication is centralized in `src/services/proxmoxSsh.js`.
- The worker is the only component that calls `proxmoxSsh`.
- Configuration (host, user, key path, ports) must come from environment or secure config.
- Absolutely no hard-coded secrets.

Worker uses `proxmoxSsh` for:

- `cloneTemplate`
- `configureCloudInit`
- `setResources`
- `startVm`, `stopVm`, `rebootVm`
- `deleteVm`
- Optional: `snapshot`, `restore`, `backup`

---

## 7. Security & Multi-Tenancy

- All protected endpoints require auth middleware.
- Tenant isolation:
  - Routes must verify that the pod belongs to the authenticated tenant.
  - Quota update endpoints must require admin-level role.
- Logs:
  - Must not include secrets (SSH keys, tokens).
  - Should log `tenantId`, `podId`, `vmid`, `action` for traceability.

---

## 8. Copilot Rules of Engagement (Global)

These rules are hard constraints for Copilot and any future refactors.

**Do not change table names:**

- `cloud_pods`, `cloud_pod_queue`, `cloud_pod_jobs`, `cloud_pod_quotas`, `cloud_pod_plans`, `cloud_pod_blueprints`.

**Do not move responsibilities:**

- Quotas stay in `cloudPodQuotas.js`.
- Queue DB logic stays in `cloudPodQueues.js`.
- SSH / Proxmox stays in `proxmoxSsh.js`.
- Long-running operations stay in `cloudPodWorker.js`.
- Request validation + auth stay in `cloudPodRoutes.js`.

**Do not bypass `checkTenantQuota`:**

- Any create/scale-like operation must go through it.

**Do not add SSH calls in routes or generic services.**

**Do prefer idempotent scripts and APIs:**

- Seed scripts may be safely re-run.
- Admin quota updates must not create duplicates.

**Do update this MASTER spec when making breaking design changes.**

---

## 9. File Map

Recommended structure:

```
docs/
  CLOUDPODS_MASTER_SPEC.md

  cloudpods/
    overview.md
    architecture.md
    plans.md
    blueprints.md
    quota-system.md
    queue-worker.md
    api-endpoints.md
    ui-spec.md
    copilot-rules.md
```

Each sub-doc focuses on one aspect; this MASTER spec ties everything together.
