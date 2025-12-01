# CloudPods – Copilot Rules

These rules exist specifically to keep Copilot (and future devs) from breaking CloudPods.

## 1. Ownership

- **`src/routes/cloudPodRoutes.js`**
  - Owns: HTTP routing, validation, auth.
  - Must NOT: call Proxmox or manually mutate queues.

- **`src/services/cloudPodService.js`**
  - Owns: business logic for CloudPods (create, list, details, actions).
  - Must NOT: call Proxmox or read env secrets directly.

- **`src/services/cloudPodQueues.js`**
  - Owns: all access to `cloud_pod_queue`.
  - Must NOT: implement quota logic or SSH.

- **`src/services/cloudPodQuotas.js`**
  - Owns: all quota calculations and decisions.
  - Must NOT: call Proxmox or enqueue queue items.

- **`src/services/proxmoxSsh.js`**
  - Owns: SSH communication with Proxmox.
  - Must NOT: talk to HTTP or read/write mPanel DB tables.

- **`cloudPodWorker.js`**
  - Owns: orchestration of long-running jobs via queue + Proxmox.
  - Must NOT: expose HTTP endpoints.

## 2. Banned Moves

- ❌ Moving SSH calls into routes or generic services.
- ❌ Direct SQL against `cloud_pod_queue` outside `cloudPodQueues.js`.
- ❌ Direct SQL against `cloud_pod_quotas` outside `cloudPodQuotas.js`.
- ❌ Skipping `checkTenantQuota` when creating or scaling pods.
- ❌ Adding new CloudPods endpoints that lack auth/tenant checks.

## 3. Required Patterns

- Use `checkTenantQuota` in any flow that increases pods/CPU/memory/disk.
- For seeding or maintenance, create scripts under `scripts/` that are:
  - Idempotent (safe to re-run).
  - Logged.

## 4. If You Need to Change the Design

1. Update `../CLOUDPODS_MASTER_SPEC.md`.
2. Update the relevant doc(s) in this folder.
3. Only then adjust the code.
4. Keep a migration note for future reference.

This keeps CloudPods coherent even as the system grows.
