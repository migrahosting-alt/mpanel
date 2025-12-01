# 🌩 CloudPods System – End-to-End Guide (mPanel)

> **Goal:** CloudPods is fully operational. This doc locks in the architecture and gives Copilot strict rules, plus a real `cloudPodQuotas.js` implementation (no more stub).

---

## 1. Current Status (from Audit)

**Components (all already exist):**

- `src/config/cloudPods.js`  
  - Exports `CLOUD_POD_PLANS` object.
- `src/routes/cloudPodRoutes.js`  
  - All `/api/cloud-pods/*` routes registered.
  - Public:
    - `GET /api/cloud-pods/plans`
    - `GET /api/cloud-pods/plans/:code`
    - `GET /api/cloud-pods/compare`
  - Protected:
    - `POST /api/cloud-pods` – create CloudPod
    - `GET /api/cloud-pods` – list user pods
    - `GET /api/cloud-pods/:vmid` – pod details
    - `POST /api/cloud-pods/:vmid/destroy`
    - `POST /api/cloud-pods/:vmid/backup`
    - `GET /api/cloud-pods/:vmid/health`
    - `POST /api/cloud-pods/:vmid/scale`
    - `GET /api/cloud-pods/tenants/:id/quota`
    - `GET /api/cloud-pods/admin/stats`
- `cloudPodWorker.js`  
  - SSH-based provisioning, uses queue, talks to Proxmox.
- `src/services/proxmoxSsh.js`  
  - All SSH / Proxmox commands live here.
- `src/services/cloudPodQueues.js`  
  - Manages `cloud_pod_queue` table.
- `src/services/cloudPodQuotas.js`  
  - **Real quota logic implemented.**
- Database:
  - 6 tables for CloudPods (including quotas, queue, pods, plans/blueprints etc.)

**Plans (from `CLOUD_POD_PLANS` / Plans API):**

| Plan     | Price/mo | vCPU | RAM  | Storage | Bandwidth |
|----------|----------|------|------|---------|-----------|
| Student  | 0.00     | 1    | 1GB  | 2GB     | 50GB      |
| Starter  | 1.49     | 1    | 1GB  | 30GB    | Unmetered |
| Premium  | 2.49     | 2    | 2GB  | 75GB    | Unmetered |
| Business | 3.99     | 3    | 4GB  | 100GB   | Unmetered |

**Queue history:** 2 successful pods (VMID 107 & 108) already provisioned and active.

---

## 2. Quota System – Requirements

We want **real per-tenant limits** enforced before any operation that creates or scales pods.

### 2.1 Quota Data Model

Table: `cloud_pod_quotas`

Required columns (Prisma model):

- `id` – UUID PK
- `tenant_id` – UUID, unique
- `max_cloud_pods` – int (default 5)
- `max_cpu_cores` – int (default 8)
- `max_ram_mb` – int (default 16384)
- `max_disk_gb` – int (default 100)
- `used_cloud_pods` – int (default 0)
- `used_cpu_cores` – int (default 0)
- `used_ram_mb` – int (default 0)
- `used_disk_gb` – int (default 0)
- `created_at`, `updated_at` – timestamps

Table: `cloud_pods` (simplified requirements)

- `tenant_id`
- `status` – `provisioning`, `active`, `failed`, `deleting`, `deleted`
- Resource fields: `cores`, `memory_mb`, `disk_gb`

**Status filter:** usage counts pods where `status` in:

```text
['provisioning', 'active']
```

---

## 3. Default Quota Policy

If a tenant has no row in `cloud_pod_quotas`:

```javascript
max_pods        = 2
max_cpu_cores   = 4
max_memory_mb   = 8192   (8 GB)
max_disk_gb     = 200
```

These values are defaults only and can be overridden per tenant by inserting/updating `cloud_pod_quotas`.

---

## 4. How Quota Checks Are Called

### 4.1 When Creating a Pod

In `src/routes/cloudPodRoutes.js` (or the service it calls), before enqueueing:

1. Resolve plan:

```javascript
import { CLOUD_POD_PLANS } from '../config/cloudPods.js';

// example (inside the handler)
const plan = CLOUD_POD_PLANS[body.planCode];
```

2. Build requested resources:

```javascript
const requested = {
  pods: 1,
  cpuCores: plan.vcpu,
  memoryMb: plan.ramGb * 1024,
  diskGb: plan.diskGb,
};
```

3. Call the quota service:

```javascript
import { checkTenantQuota } from '../services/cloudPodQuotas.js';

const quotaResult = await checkTenantQuota({
  tenantId,
  requested,
});

if (!quotaResult.allowed) {
  return res.status(403).json({
    error: 'QUOTA_EXCEEDED',
    message: quotaResult.message,
    details: quotaResult.details,
  });
}
```

4. If allowed → continue with normal flow:
   - Insert into `cloud_pods`
   - Enqueue job in `cloud_pod_queue`
   - Worker picks it up

### 4.2 When Scaling a Pod

On `POST /api/cloud-pods/:vmid/scale`:

1. Load current pod.
2. Compute delta resources (new - old).
3. If any resource is increased, run `checkTenantQuota` with `requested` set to the delta (e.g. `pods: 0, cpuCores: +1`, etc.).

---

## 5. Quota Service – Contract

`src/services/cloudPodQuotas.js` must export:

```javascript
export const DEFAULT_TENANT_QUOTA = { ... };

export async function getTenantQuota(tenantId) { ... }

export async function getTenantUsage(tenantId) { ... }

export async function checkTenantQuota({ tenantId, requested }) { ... }
```

`requested` object shape:

```javascript
{
  pods: number;      // usually 1 when creating
  cpuCores: number;
  memoryMb: number;
  diskGb: number;
}
```

`checkTenantQuota` returns:

```javascript
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
  }
}
```

---

## 6. 🔧 Implementation – src/services/cloudPodQuotas.js

See `src/services/cloudPodQuotas.js` for the full implementation using Prisma.

Key points:
- Uses Prisma client from `src/config/database.js`
- Falls back to `DEFAULT_TENANT_QUOTA` if no row exists
- Calculates usage from `cloud_pods` table where status in `['provisioning', 'active']`
- Returns detailed error information on quota exceeded

---

## 7. Copilot "Rules of Engagement" (CloudPods)

**Do NOT:**

- Change the public exports of `cloudPodQuotas.js`.
- Move quota logic into routes or worker.
- Bypass `checkTenantQuota` when creating or scaling pods.
- Touch `proxmoxSsh.js` or `cloudPodWorker.js` for quota stuff.

**DO:**

- Wire `checkTenantQuota` into:
  - `POST /api/cloud-pods/order` (create)
  - `POST /api/cloud-pods/:vmid/scale` (scale)
- Keep all SSH/Proxmox work in `cloudPodWorker.js` + `proxmoxSsh.js`.
- Keep queue DB logic in `cloudPodQueues.js` only.

---

## 8. Database Schema Reference

### cloud_pod_quotas

```prisma
model CloudPodQuota {
  id             String      @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  tenantId       String      @unique @map("tenant_id") @db.Uuid
  
  maxCloudPods   Int         @default(5) @map("max_cloud_pods")
  maxCpuCores    Int         @default(8) @map("max_cpu_cores")
  maxRamMb       Int         @default(16384) @map("max_ram_mb")
  maxDiskGb      Int         @default(100) @map("max_disk_gb")
  
  usedCloudPods  Int         @default(0) @map("used_cloud_pods")
  usedCpuCores   Int         @default(0) @map("used_cpu_cores")
  usedRamMb      Int         @default(0) @map("used_ram_mb")
  usedDiskGb     Int         @default(0) @map("used_disk_gb")
  
  createdAt      DateTime    @default(now()) @map("created_at")
  updatedAt      DateTime    @updatedAt @map("updated_at")
  
  tenant         Tenant      @relation(fields: [tenantId], references: [id])
  
  @@map("cloud_pod_quotas")
}
```

### cloud_pods

```prisma
model CloudPod {
  id                String      @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  tenantId          String      @map("tenant_id") @db.Uuid
  vmid              Int         @unique
  hostname          String
  ip                String?
  region            String      @default("migra-us-east-1")
  status            String      @default("provisioning")
  pool              String      @default("ClientPods")
  
  cores             Int         @default(2)
  memoryMb          Int         @default(2048) @map("memory_mb")
  swapMb            Int         @default(512) @map("swap_mb")
  diskGb            Int         @default(8) @map("disk_gb")
  storage           String      @default("clients-main")
  bridge            String      @default("vmbr0")
  
  // ... other fields
  
  @@map("cloud_pods")
}
```

---

With this guide + the quota service implemented, CloudPods has strict end-to-end rules for Copilot to follow without improvising.
