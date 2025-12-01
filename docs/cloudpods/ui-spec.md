# CloudPods – UI Spec (mPanel)

The mPanel UI must provide a clear interface for managing CloudPods.

## Main Screens

### 1. CloudPods Dashboard

List of pods with:

- Name
- Plan
- Status
- VMID
- IP address
- Created date

Actions per row:

- View
- Start/Stop/Reboot
- Backup
- Destroy

### 2. Create CloudPod Wizard

- **Step 1:** Select plan (Student / Starter / Premium / Business).
- **Step 2:** Select image/blueprint (Ubuntu, Debian, etc.).
- **Step 3:** Name & optional tags.
- **Step 4:** Summary + quota pre-check:
  - Calls `GET /api/cloud-pods/check-quota?planCode=...`.
  - Show success or "You are over quota" message before submit.
- **Final:** Calls `POST /api/cloud-pods/order`.

### 3. Pod Detail Page

Header: name, status pill, VMID, IP, tenant.

Tabs:

- **Overview** (plan, resources, uptime).
- **Metrics** (later).
- **Backups** (list + restore actions).
- **Activity log**.

### 4. Quota Panel (for tenant)

- Calls `GET /api/cloud-pods/my-quota`.
- Displays progress bars for:
  - Pods
  - CPU
  - Memory
  - Disk
- Uses green/yellow/red based on % used.

### 5. Admin Quota Management

- Search tenant → view current quotas and usage.
- Edit limits → calls `POST /api/cloud-pods/tenants/:id/quota`.

## UX Rules

- Always show **loading state** while waiting for API.
- On errors, show:
  - Technical error code (`QUOTA_EXCEEDED`, etc.).
  - Human-readable explanation.
- On destructive actions (destroy), require confirmation.

All network calls must use the documented endpoints in `api-endpoints.md`.
