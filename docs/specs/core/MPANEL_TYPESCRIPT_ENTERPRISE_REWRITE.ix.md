# MPANEL_TYPESCRIPT_ENTERPRISE_REWRITE.ix.md

> Master instructions for bringing the entire mPanel / Migra stack to a clean,
> enterprise-grade **TypeScript-first** architecture.
>
> Copilot: **Follow this file + all `docs/specs/**.ix.md` when editing code.**


## 0. Golden Rules

1. **TypeScript is the source of truth.**
   - All application code lives in `.ts` / `.tsx`.
   - JavaScript (`.js`) only exists in compiled output (`dist/`, `build/`) and is NEVER edited.

2. **Do NOT collapse modules into a single `index.js`.**
   - Keep feature-based modules:
     - `cloudpods`, `hosting`, `guardian`, `ops`, `provisioning`, `security`, `billing`, etc.
   - Each module has its own controllers, services, types, and routes.

3. **Specs → Types → Code.**
   - All core shapes (CloudPod, Customer, ProvisioningJob, CoreNode, ShieldPolicy, etc.)
     must be defined as TypeScript types/interfaces based on the `.ix.md` specs in:
     - `docs/specs/core/`
     - `docs/specs/hosting/`
     - `docs/specs/cloudpods/`
     - `docs/specs/enterprise/` (Guardian/RBAC/Audit)
     - `docs/specs/ops/` (Users, Customers, Servers, Provisioning, Shield, Roles)
     - `docs/specs/billing/`

4. **All backend code compiles to JS for runtime.**
   - Runtime Node/PM2 only sees `dist/**/*.js`.
   - Only `tsc` (and the build/deploy scripts) should generate those files.


## 1. Folder Structure (Backend)

Target structure for backend code:

```text
backend/
  src/
    app.ts              # app bootstrap
    config/             # config loaders, env parsing (TypeScript)
    common/             # shared utils, errors, middleware, decorators
    core/               # core infrastructure: logging, db, queue, http
      db/               # Prisma client, DB init
      queue/            # BullMQ QueueService, Worker registration
      auth/             # auth guards, requirePlatformPermission, etc.
      audit/            # AuditService, audit logger
      rbac/             # RBAC service & types
    modules/
      hosting/
        servers/
          servers.controller.ts
          servers.service.ts
          servers.types.ts
        websites/
        domains/
        dns/
        email/
        files/
        databases/
      cloudpods/
        cloudpods.controller.ts
        cloudpods.service.ts
        cloudpods.types.ts
      ops/
        core-nodes/     # Server Management (SRV1-WEB, MAIL-CORE, etc.)
          core-nodes.controller.ts
          core-nodes.service.ts
          core-nodes.types.ts
        provisioning/
          provisioning.controller.ts
          provisioning.service.ts
          provisioning.types.ts
        shield/         # Migra Shield Zero Trust
          shield.controller.ts
          shield.service.ts
          shield.types.ts
        users/
          users.controller.ts
          users.service.ts
          users.types.ts
        customers/
          customers.controller.ts
          customers.service.ts
          customers.types.ts
        roles/
          roles.controller.ts
          roles.service.ts
          roles.types.ts
      guardian/         # Guardian AI/SOC modules (Enterprise specs)
      billing/          # Plans, subscriptions integrations
  dist/                 # compiled JS output (Node/PM2 runs this)
```

**Copilot:**

- If a file is inside `backend/src/`, it MUST be `.ts` and strongly typed.
- Never generate new `.js` files in `src/`.
- Any `.js` currently inside `src/` should be converted to `.ts` as described below.

## 2. Conversion Plan: JS → TS

When you open a JS file in `src/` (backend or frontend), follow this sequence.

### Step 1 — Rename file

If backend logic:
```
something.js → something.ts
```

If React component:
```
Something.js → Something.tsx
```

### Step 2 — Add imports for types

Derive types from:
- Prisma schema,
- DTOs that should exist per `.ix.md` spec,
- existing type definitions in `common/` or `core/`.

Example:

```typescript
// Before (JS-ish)
function listCloudPods(req, res) {
  const pods = cloudPodService.listByTenant(req.tenantId);
  res.json(pods);
}

// After (TS)
import { Request, Response } from "express";
import { CloudPod } from "../../cloudpods/cloudpods.types";

async function listCloudPods(req: Request, res: Response): Promise<void> {
  const pods: CloudPod[] = await cloudPodService.listByTenant(req.tenantId);
  res.json(pods);
}
```

### Step 3 — Type the important things

For each function:
- Add types for:
  - parameters,
  - return value.
- Use enums/interfaces from spec files.

Example for Provisioning:

```typescript
import { ProvisioningJob, JobStatus } from "../provisioning.types";

async function markJobRunning(jobId: string): Promise<ProvisioningJob> {
  return prisma.provisioningJob.update({
    where: { id: jobId },
    data: { status: JobStatus.RUNNING, startedAt: new Date() },
  });
}
```

### Step 4 — Fix `any` and loose objects

- Avoid `any` unless absolutely necessary.
- Define interfaces based on `.ix.md` specs:

For example (from CloudPods / Provisioning specs):

```typescript
export interface CloudPodProvisionPayload {
  cloudPodId: string;
  planId: string;
  region: string;
  tenantId: string;
  initialDomain?: string;
}
```

Use that instead of generic objects.

## 3. Type Declarations from Specs

For each major module, create `*.types.ts` and mirror the `.ix.md` spec.

### Example: CloudPods

From `MODULE_CLOUDPODS.ix.md`:

```typescript
export enum CloudPodStatus {
  PENDING = "PENDING",
  PROVISIONING = "PROVISIONING",
  ACTIVE = "ACTIVE",
  DEGRADED = "DEGRADED",
  SUSPENDED = "SUSPENDED",
  UPGRADING = "UPGRADING",
  DOWNGRADING = "DOWNGRADING",
  DELETING = "DELETING",
  ERROR = "ERROR",
}

export interface CloudPod {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  planId: string;
  region: string;
  status: CloudPodStatus;
  primaryServerId?: string | null;
  usageCpuCores: number;
  usageRamMb: number;
  usageDiskGb: number;
  limitCpuCores: number;
  limitRamMb: number;
  limitDiskGb: number;
  limitWebsites: number;
  limitDatabases: number;
  limitEmailBoxes: number;
  guardianStatus: string; // GuardianStatus enum (from Enterprise specs)
  metadata?: Record<string, unknown>;
}
```

### Example: ProvisioningJob

From `MODULE_PROVISIONING.ix.md`:

```typescript
export enum JobStatus {
  PENDING = "PENDING",
  QUEUED = "QUEUED",
  RUNNING = "RUNNING",
  SUCCEEDED = "SUCCEEDED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

export interface ProvisioningJob {
  id: string;
  workflowId?: string | null;
  tenantId?: string | null;
  resourceType: string;
  resourceId?: string | null;
  action: string;
  status: JobStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  payload: unknown;
  result?: unknown;
  errorMessage?: string | null;
  queueName: string;
  createdBy?: string | null;
  createdAt: Date;
  startedAt?: Date | null;
  finishedAt?: Date | null;
}
```

## 4. Frontend TypeScript

For the React/Vite frontend:

- All components should be `.tsx`.
- All hooks should be `.ts`.
- API responses should have typed interfaces based on the same specs.

Example:

```typescript
// src/frontend/api/cloudpods.ts
import axios from "axios";

export interface CloudPodSummary {
  id: string;
  name: string;
  planId: string;
  region: string;
  status: CloudPodStatus;
  websitesCount: number;
  guardianStatus: string;
}

export async function fetchCloudPods(): Promise<CloudPodSummary[]> {
  const res = await axios.get("/api/cloudpods");
  return res.data;
}
```

Then used in components:

```typescript
const { data: pods } = useQuery<CloudPodSummary[]>(["cloudpods"], fetchCloudPods);
```

## 5. tsconfig & Build

Assume:
- `tsconfig.json` exists at repo root (or backend root).
- Build script compiles TS to JS and deploys to `/opt/mpanel/dist`.

Copilot must respect:
- Only modify `.ts` / `.tsx` files in `src/`.
- Never touch `dist/` or compiled `.js` files.
- Do not introduce new build tools; use existing `deploy-backend-ts.sh` and current `tsconfig`.

## 6. Copilot Behaviour Summary

When working in this repo, Copilot should always:

1. **Prefer TypeScript over JavaScript** for any new or existing code.

2. **Convert stray `.js` files in `src/` back to `.ts` / `.tsx`** with proper types.

3. **Use `.ix.md` specs under `docs/specs/**`** as the contract for:
   - API routes,
   - request/response payloads,
   - enums, statuses, and models.

4. **Maintain modular boundaries:**
   - No giant all-in-one `index.js`.
   - Keep feature modules under `modules/` with their own controller/service/types.

5. **Let `tsc` and the deploy scripts generate the final JavaScript for Node/PM2.**

---

## How to use this in practice

1. **Keep this file + `MPANEL_PLATFORM_INDEX.ix.md` open/pinned** in VS Code.

2. When you see JS in `src/`, tell Copilot directly in the file:

```typescript
// Copilot: convert this file from JavaScript back to TypeScript.
// - Rename to .ts
// - Add proper types based on our *.ix.md specs.
// - Use existing types from modules/**.types.ts.
// - Do not change behaviour, only type it correctly.
```

3. **Never manually create `.js` files in `src/`** — only TypeScript source files.

4. **Trust the build pipeline** — `tsc` → `dist/` → PM2 restart.

---

## 7. NO placeholders, NO mock data – REAL wiring only

Copilot: In this repo, we are building a **real production system**, not a demo.

### 7.1. General rules

- Do **NOT**:
  - generate "mock" or "placeholder" data,
  - hardcode example objects in controllers/services,
  - point UI pages at fake arrays or local constants,
  - add "TODO: wire real API later" and stop there,
  - return dummy responses just to satisfy TypeScript types.

- Always:
  - read/write from **real tables** (via Prisma/db layer),
  - call **real HTTP endpoints** or **real queue jobs**,
  - persist state in the database instead of in-memory structures.

If a feature is not fully wired yet, do not fake it.  
Instead: add the missing models/endpoints/queries so it actually works end-to-end.

---

### 7.2. Data & database rules

- Every module must use **real DB tables** that match the `.ix.md` specs.
- If a spec defines a model (`CloudPod`, `ProvisioningJob`, `CoreNode`, `ShieldPolicy`, `Customer`, etc.):
  - there must be a matching Prisma model,
  - there must be TypeScript interfaces/types in `*.types.ts`,
  - controllers/services must use the database, not hardcoded values.

Examples:

- CloudPods list:
  - ✅ Correct: `SELECT FROM CloudPod` via Prisma.
  - ❌ Wrong: `const mockPods = [ ... ]` inside the controller.

- Provisioning jobs:
  - ✅ Correct: read from `ProvisioningJob` table.
  - ❌ Wrong: return a hardcoded `{ id: "1", status: "SUCCEEDED" }`.

---

### 7.3. API and module communication

- All modules must communicate through **real APIs and queues**, not stubs.

Rules:

- Hosting/CloudPods **must** call the real Provisioning queue via `QueueService`, not a fake function.
- Server Management (core nodes) must:
  - enqueue real jobs for node actions (reboot, restart services, health checks),
  - read real status/metrics from the metrics/monitoring pipeline or DB.
- Migra Shield (Zero Trust) must:
  - read/write real `ShieldPolicy` and `ShieldEvent` records,
  - expose real `/api/security/shield/*` routes used by the UI.
- Role Management & Users/Customers must:
  - call the real RBAC and Auth services,
  - never hardcode "roles" or "permissions" arrays inside components.

If an endpoint is defined in the specs, implement it **for real** and have the UI call it.

---

### 7.4. Cross-server communication (real infra, not fantasy)

The system runs on multiple **real servers/nodes** (SRV1-WEB, MAIL-CORE, DNS-CORE, CLOUD-CORE, MIGRAGUARD-QUANTUM, DB-CORE, MPANEL-CORE, etc.).

Copilot must:

- Assume that cross-node actions happen through:
  - real HTTP APIs (health checks, service endpoints),
  - real SSH/Proxmox automation invoked from workers,
  - real queues and jobs (BullMQ) that ultimately run shell commands/scripts.

Never:

- pretend a node is "healthy" using random data,
- fake health statuses,
- simulate metrics with random numbers.

If a health/metrics view exists, it must be showing **real data pulled from the monitoring/metrics source** (DB, Prometheus-like store, or metrics snapshots).

---

### 7.5. Monitoring & observability

We have (or will have) a real monitoring pipeline (metrics + health checks + logs).

Copilot rules:

- Monitoring pages (Server Management, Ops Overview, Provisioning, Shield, Guardian) must:
  - read **real metrics snapshots**,
  - show **real queue/job counts**,
  - show **real status fields** from DB or health endpoints.
- Do not generate "fake dashboard" components with hardcoded charts or counts.

If a chart/table exists in the UI:

- It should be backed by a real API endpoint.
- That endpoint should be backed by real data collection (workers or cron).

---

### 7.6. No "temporary" hardcoding

Copilot must not introduce "temporary" hardcoding such as:

- hardcoded admin emails,
- hardcoded node IPs/FQDNs (beyond what is explicitly configured),
- hardcoded plans, prices, or limits if Billing/Plans tables exist.

If configuration is needed:

- add it via env/config loader (`config/`),
- or via a proper table (e.g. `CloudPodPlan`, `PlatformSetting`),
- then read it from there.

---

### 7.7. Behaviour when something is missing

If Copilot identifies that something is missing to implement a module **for real**:

- It should:
  - create the missing types/interfaces,
  - add the Prisma model (in `schema.prisma`),
  - create controller/service methods,
  - wire the queue job or HTTP call,
  - and then have the UI call that endpoint.

- It should **not**:
  - silently fall back to mock data,
  - comment "TODO: implement" and stop,
  - leave dead buttons or non-functional dashboard widgets.

If the code compiles and the UI shows data, that data must come from actual DB/API/queue/monitoring sources, not placeholders.
