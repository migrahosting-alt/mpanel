# CloudPods – API Endpoints

All endpoints are prefixed with: `/api/cloud-pods`.

---

## Public Endpoints

### `GET /api/cloud-pods/plans`

Returns all available plans.

```json
[
  {
    "code": "student",
    "name": "Student",
    "priceMonthly": 0,
    "vcpu": 1,
    "ramMb": 1024,
    "storageGb": 2,
    "bandwidthGb": 50
  },
  ...
]
```

### `GET /api/cloud-pods/plans/:code`

Returns a single plan by code.

### `GET /api/cloud-pods/compare`

Returns a comparison table suitable for pricing UI.

---

## Authenticated Endpoints

All require user auth + tenant context.

### `POST /api/cloud-pods/order`

Create a new CloudPod.

Body (example):

```json
{
  "planCode": "starter",
  "blueprintCode": "ubuntu-24-minimal",
  "name": "my-first-cloudpod"
}
```

Behavior:

1. Resolve plan.
2. Run `checkTenantQuota`.
3. Create `cloud_pods` row.
4. Enqueue `create` job.
5. Return pod + job information.

### `GET /api/cloud-pods`

List CloudPods for the current tenant/user.

### `GET /api/cloud-pods/:vmid`

Get details for a single pod. Must verify tenant owns the pod.

### `POST /api/cloud-pods/:vmid/destroy`

Request destruction of a pod. Enqueues `destroy` job.

### `POST /api/cloud-pods/:vmid/backup`

Trigger a backup of a pod. Enqueues `backup` job.

### `GET /api/cloud-pods/:vmid/health`

Return basic health info (reachable, powered on, etc.).

### `POST /api/cloud-pods/:vmid/scale`

Scale resources up/down.

Body includes requested new size or delta. Must run `checkTenantQuota` if scaling up.

---

## Quota Endpoints

### `GET /api/cloud-pods/my-quota`

Returns quota summary for current tenant:

```json
{
  "limits": {
    "max_pods": 2,
    "max_cpu_cores": 4,
    "max_memory_mb": 8192,
    "max_disk_gb": 200
  },
  "usage": {
    "pods": 1,
    "cpuCores": 1,
    "memoryMb": 1024,
    "diskGb": 30
  },
  "remaining": {
    "pods": 1,
    "cpuCores": 3,
    "memoryMb": 7168,
    "diskGb": 170
  }
}
```

### `GET /api/cloud-pods/check-quota?planCode={code}`

Pre-check whether the tenant can create a pod using the specified plan.

### `GET /api/cloud-pods/tenants/:id/quota` (Admin)

Admin-only view of any tenant's limits + usage.

### `POST /api/cloud-pods/tenants/:id/quota` (Admin)

Admin-only update of tenant limits.

Body example:

```json
{
  "max_pods": 5,
  "max_cpu_cores": 10,
  "max_memory_mb": 32768,
  "max_disk_gb": 1000
}
```
