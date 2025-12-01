# CloudPods – Test Checklist (mPanel)

This checklist validates that the CloudPods subsystem (plans, quotas, queue, worker, Proxmox) is working end-to-end.

> Run these tests **after major changes** to CloudPods API, services, quotas, or worker.

---

## 0. Setup

- You have:
  - mPanel backend running.
  - CloudPod worker (`cloudPodWorker.js`) running.
  - Proxmox reachable from the worker.
  - At least one Proxmox template + blueprint configured.
  - Valid auth token for test user with a tenant.

For examples below, assume:

- API base: `https://api.migrahosting.com/api`
- Auth token: `BEARER_TOKEN` (replace with a real one).
- Use curl or HTTP client of your choice.

---

## 1. Plans API

### 1.1 List plans

```bash
curl -sS \
  -X GET "https://api.migrahosting.com/api/cloud-pods/plans" \
  | jq
```

**Expect:**

- HTTP 200.
- JSON array with `student`, `starter`, `premium`, `business`.
- Each object has: `code`, `name`, `priceMonthly`, `vcpu`, `ramMb`, `storageGb`.

### 1.2 Single plan

```bash
curl -sS \
  -X GET "https://api.migrahosting.com/api/cloud-pods/plans/starter" \
  | jq
```

**Expect:**

- HTTP 200.
- Object with `code: "starter"` and correct resource values.

### 1.3 Compare endpoint

```bash
curl -sS \
  -X GET "https://api.migrahosting.com/api/cloud-pods/compare" \
  | jq
```

**Expect:**

- HTTP 200.
- Data usable to render the pricing table.

---

## 2. Quota System

### 2.1 Check "my quota"

```bash
curl -sS \
  -H "Authorization: Bearer BEARER_TOKEN" \
  -X GET "https://api.migrahosting.com/api/cloud-pods/my-quota" \
  | jq
```

**Expect:**

- HTTP 200.
- Structure:

```json
{
  "limits": {
    "max_pods": ...,
    "max_cpu_cores": ...,
    "max_memory_mb": ...,
    "max_disk_gb": ...
  },
  "usage": {
    "pods": ...,
    "cpuCores": ...,
    "memoryMb": ...,
    "diskGb": ...
  },
  "remaining": {
    "pods": ...,
    "cpuCores": ...,
    "memoryMb": ...,
    "diskGb": ...
  }
}
```

### 2.2 Pre-check quota for a plan

```bash
curl -sS \
  -H "Authorization: Bearer BEARER_TOKEN" \
  -X GET "https://api.migrahosting.com/api/cloud-pods/check-quota?planCode=starter" \
  | jq
```

**Expect:**

- HTTP 200.
- Structure:

```json
{
  "allowed": true,
  "message": "...",
  "details": { ... }
}
```

(If tenant is already at limit, `allowed` may be `false`.)

---

## 3. Create CloudPod Flow

### 3.1 Create order

```bash
curl -sS \
  -H "Authorization: Bearer BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "https://api.migrahosting.com/api/cloud-pods/order" \
  -d '{
    "planCode": "starter",
    "blueprintCode": "ubuntu-24-minimal",
    "name": "test-cloudpod-1"
  }' \
  | jq
```

**Expect:**

- HTTP 200 or 201.
- Response contains:
  - `pod.id`
  - `pod.status` = `"pending"` or `"provisioning"`
  - Possibly `job` and/or `queueItem`.
- Note pod ID and VMID (if present).

### 3.2 Check queue and worker

- Confirm that the worker process logs a `create` job.
- Confirm a new VM appears in Proxmox with the expected VMID.
- Wait for worker to finish.

### 3.3 Verify pod becomes active

```bash
curl -sS \
  -H "Authorization: Bearer BEARER_TOKEN" \
  -X GET "https://api.migrahosting.com/api/cloud-pods" \
  | jq
```

**Expect:**

- The new pod appears in the list.
- `status: "active"` (after worker completes).
- `vmid` and `ipAddress` set.

---

## 4. Quota Enforcement

### 4.1 Hit pod limit (max_pods)

Temporarily set the tenant quota to a low value (e.g. `max_pods = 1`) via admin endpoint:

```bash
curl -sS \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "https://api.migrahosting.com/api/cloud-pods/tenants/TENANT_ID/quota" \
  -d '{
    "max_pods": 1
  }' \
  | jq
```

If tenant already has 1 active pod, try to create another:

```bash
curl -sS \
  -H "Authorization: Bearer BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "https://api.migrahosting.com/api/cloud-pods/order" \
  -d '{
    "planCode": "starter",
    "blueprintCode": "ubuntu-24-minimal",
    "name": "over-quota-test"
  }' \
  | jq
```

**Expect:**

- HTTP 403.
- JSON:

```json
{
  "error": "QUOTA_EXCEEDED",
  "message": "...",
  "details": {
    "error_code": "MAX_PODS_EXCEEDED",
    ...
  }
}
```

### 4.2 CPU / RAM / disk quotas (optional)

Repeat similar tests but adjust `max_cpu_cores`, `max_memory_mb`, `max_disk_gb` to a value just below required resources and try to create.

---

## 5. Scale Flow

### 5.1 Scale up within quota

Choose an existing pod.

Call:

```bash
curl -sS \
  -H "Authorization: Bearer BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "https://api.migrahosting.com/api/cloud-pods/VMID/scale" \
  -d '{
    "cpuCores": 2
  }' \
  | jq
```

**Expect:**

- HTTP 200.
- Response includes updated pod info or a job/queue reference.
- Worker triggers a Proxmox resource update.

### 5.2 Scale up over quota

Set quota to something lower (e.g. tenant already at CPU limit).

Repeat the scale call.

**Expect:**

- HTTP 403 with `QUOTA_EXCEEDED` and `MAX_CPU_EXCEEDED` in details.

---

## 6. Destroy Flow

### 6.1 Request destroy

```bash
curl -sS \
  -H "Authorization: Bearer BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "https://api.migrahosting.com/api/cloud-pods/VMID/destroy" \
  -d '{"reason": "cleanup test"}' \
  | jq
```

**Expect:**

- HTTP 200.
- Pod status transitions to `deleting`, then `deleted` after worker finishes.
- VM is removed from Proxmox.

### 6.2 Confirm removal

- `GET /api/cloud-pods` → pod either missing or marked `deleted`.
- Proxmox: VMID no longer exists.

---

## 7. Health Check

### 7.1 Pod health

```bash
curl -sS \
  -H "Authorization: Bearer BEARER_TOKEN" \
  -X GET "https://api.migrahosting.com/api/cloud-pods/VMID/health" \
  | jq
```

**Expect (if implemented):**

- HTTP 200.
- Data includes `poweredOn`, `reachable`, `lastCheckAt`.

---

## 8. Admin Quota Panel

### 8.1 View tenant quota

```bash
curl -sS \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -X GET "https://api.migrahosting.com/api/cloud-pods/tenants/TENANT_ID/quota" \
  | jq
```

**Expect:**

- HTTP 200.
- Same shape as `/my-quota`, plus `tenantId`.

### 8.2 Update tenant quota

(Already used above, ensure it persists and `/my-quota` reflects changes.)

---

## 9. Error Handling

Confirm correct status codes and messages for:

| Scenario | Expected |
|----------|----------|
| Invalid plan: `planCode` does not exist | HTTP 400 with appropriate error |
| Invalid blueprint: blueprint does not exist or inactive | HTTP 400 or 404 |
| Unauthorized: no auth header | HTTP 401 |
| Forbidden: accessing another tenant's pod | HTTP 403 |
| Not found: VMID not owned or does not exist | HTTP 404 |

---

## 10. Regression Checklist (Quick Run)

When you only need a fast smoke test, verify:

| # | Test | Pass? |
|---|------|-------|
| 1 | `GET /plans` works | ☐ |
| 2 | `GET /my-quota` works | ☐ |
| 3 | Create pod → status becomes `active` → VM appears in Proxmox | ☐ |
| 4 | Destroy pod → VM disappears from Proxmox | ☐ |
| 5 | Over quota create → 403 `QUOTA_EXCEEDED` | ☐ |

**If all of these pass, CloudPods is operational.** ✅
