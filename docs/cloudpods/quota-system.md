# CloudPods – Quota System

The quota system prevents any tenant from consuming more resources than allowed.

## Goals

- Enforce fair usage across tenants.
- Support free tiers (e.g. Student plan).
- Support enterprise overrides (custom per-tenant quota rows).
- Provide UI-friendly summaries for mPanel.

## Data Model

Table: `cloud_pod_quotas` (per tenant)

- `tenant_id`
- `max_pods`
- `max_cpu_cores`
- `max_memory_mb`
- `max_disk_gb`

**Default limits** (when no row exists):

- Pods: 2
- CPU: 4 cores
- Memory: 8 GB
- Disk: 200 GB

Usage is computed from `cloud_pods` where `status` in:

```text
pending, provisioning, active
```

Summed fields:

- `pods` (count rows)
- `cpuCores` (sum)
- `memoryMb` (sum)
- `diskGb` (sum)

## Quota Service Contract

File: `src/services/cloudPodQuotas.js`

Key exports:

```js
DEFAULT_TENANT_QUOTA: { ... }

getTenantQuota(tenantId): Promise<QuotaLimits>
getTenantUsage(tenantId): Promise<QuotaUsage>

checkTenantQuota({
  tenantId,
  requested: {
    pods: number
    cpuCores: number
    memoryMb: number
    diskGb: number
  }
}): Promise<{
  allowed: boolean
  message?: string
  details?: {
    max_pods: number
    current_pods: number
    requested_pods: number
    max_cpu_cores: number
    current_cpu_cores: number
    requested_cpu_cores: number
    max_memory_mb: number
    current_memory_mb: number
    requested_memory_mb: number
    max_disk_gb: number
    current_disk_gb: number
    requested_disk_gb: number
    error_field?: string
    error_code?: string
  }
}>
```

Additional helpers (already implemented):

- `getQuotaSummary(tenantId)`
- `recalculateUsage(tenantId)`

Legacy-compatible wrappers: `checkCreateCapacity`, `checkScaleCapacity`, `ensureTenantHasCapacity`.

## Integration Points

**`POST /api/cloud-pods/order`:**

- Must call `checkTenantQuota` before creating a pod.

**`POST /api/cloud-pods/:vmid/scale`:**

- Must call `checkTenantQuota` with additional resources requested.

## Quota-related Endpoints

- `GET /api/cloud-pods/my-quota` – Current tenant's summary.
- `GET /api/cloud-pods/check-quota?planCode={code}` – Pre-check a specific plan.
- `GET /api/cloud-pods/tenants/:id/quota` – Admin view.
- `POST /api/cloud-pods/tenants/:id/quota` – Admin update limits.
