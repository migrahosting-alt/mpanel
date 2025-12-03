Use ENTERPRISE_PHASE2_SPEC.ix.md as the source of truth. Follow it exactly. Don’t touch indexes or existing enterprise SQL.

> UPDATE MODE: The mPanel UI is already live in production.
> Copilot MUST treat this file as an incremental update spec.
> Do NOT delete or rewrite existing pages, layouts, routes, or components.
> Only ADD new modules/components/routes or extend existing ones safely.

# ENTERPRISE PHASE 2 SPEC (SCHEMA + CLOUDPODS + GUARDIAN + MONITORING)

## 0. GLOBAL RULES FOR COPILOT

- ✅ **Do NOT drop or modify** existing indexes or enterprise SQL.  
- ✅ **Do NOT rename or drop** existing DB columns without explicit instructions here.  
- ✅ Assume the production DB on `mpanel` is the **source of truth**.
- ✅ When in doubt about schema, run `npx prisma db pull` (introspect) **instead of guessing**.
- ✅ All new features must be **tenant-aware** (`tenant_id` where applicable).
- ✅ All sensitive actions must be **audited** via Guardian audit events.

Target stack (already in use):

- Backend: Node/TS, Prisma, Postgres (`db-core` at `10.1.10.210`, DB `mpanel`)
- Frontend: React, Vite, Tailwind, mPanel SPA
- Auth: existing mPanel auth/session (use existing hooks)
- DB: hardened + indexed (see `ENTERPRISE_MIGRATION_COMPLETE.md`)

---

## 1. PRISMA SCHEMA ALIGNMENT (OPTION A)

Goal: Align `schema.prisma` with **actual production schema** without breaking anything.

### 1.1. Copilot Workflow

1. Run:
   - `npx prisma db pull`  
   - This must **update models to reflect DB**, not overwrite DB.
2. Use `ENTERPRISE_MIGRATION_COMPLETE.md` + this spec to fix naming & semantics.
3. Do **NOT** generate migration SQL that drops or changes existing columns without explicit rules.

### 1.2. Known Schema Mismatches To Fix

Adjust Prisma models to match DB reality:

1. **Products**
   - DB uses: `status` (string)  
   - Prisma must **not** assume `is_active: Boolean`.
   - **Rule:**
     ```prisma
     model Product {
       id        Int     @id @default(autoincrement())
       tenantId  Int
       name      String
       code      String  @unique
       status    String  @default("active") // use this instead of isActive
       // other existing fields - keep from db pull
     }
     ```

2. **Subscriptions**
   - DB uses `product_id` FK (not `product_code`).
   - **Rule:**
     ```prisma
     model Subscription {
       id          Int      @id @default(autoincrement())
       tenantId    Int
       customerId  Int
       productId   Int
       status      String
       // derived relation
       product     Product  @relation(fields: [productId], references: [id])
     }
     ```

3. **Backups**
   - DB uses `backup_type` (not `type`).
   - **Rule:**
     ```prisma
     model Backup {
       id          Int    @id @default(autoincrement())
       tenantId    Int
       backupType  String // map from backup_type
       status      String
       // keep other fields
     }
     ```

4. **SSL Certificates**
   - DB uses:
     - `domain_name` (string, not `domain_id`)
     - `expires_at` (not `valid_to`)
   - **Rule:**
     ```prisma
     model SslCertificate {
       id          Int      @id @default(autoincrement())
       tenantId    Int
       domainName  String
       expiresAt   DateTime
       autoRenew   Boolean  @default(false)
     }
     ```

5. **CloudPod Jobs**
   - Ensure `idempotency_key` exists in Prisma and matches DB:
     ```prisma
     model CloudPodJob {
       id              Int      @id @default(autoincrement())
       tenantId        Int
       podId           Int?
       jobType         String
       status          String
       idempotencyKey  String?  @unique
       createdAt       DateTime @default(now())
     }
     ```

### 1.3. Output of This Step

- Updated `schema.prisma` aligned to production.
- No breaking migrations.
- Optional: `docs/SCHEMA_ALIGNMENT_NOTES.md` explaining what changed.

---

## 2. CLOUDPODS DASHBOARD + CREATE CLOUDPOD WIZARD (OPTION B)

Goal: Build a **tenant CloudPods UI** on top of already-optimized CloudPods tables.

### 2.1. Frontend Structure

Create:

```text
src/modules/cloudpods/
  components/
    CloudPodList.tsx
    CloudPodCard.tsx
    CloudPodFilters.tsx
    CloudPodStatusBadge.tsx
    CloudPodMetricsPanel.tsx
    CloudPodActionsMenu.tsx
    CloudPodLogsViewer.tsx
    CloudPodCreateWizard.tsx
    CloudPodPlanSelector.tsx
    CloudPodServerSelector.tsx
    CloudPodSummaryStep.tsx
  pages/
    CloudPodsDashboardPage.tsx
    CloudPodDetailPage.tsx
  api/
    cloudpods.client.ts
  hooks/
    useCloudPods.ts
    useCreateCloudPod.ts
  types/
    cloudpods.types.ts
```

### 2.2. Routes
Add routes:

- `/cloudpods` → CloudPodsDashboardPage
- `/cloudpods/:podId` → CloudPodDetailPage

### 2.3. Types (API Layer)

`cloudpods.types.ts`:
```ts
export type CloudPodPlan = 'mini' | 'pro' | 'business' | 'enterprise';

export interface CloudPod {
  id: number;
  tenantId: number;
  name: string;
  plan: CloudPodPlan;
  status: 'provisioning' | 'running' | 'stopped' | 'error' | 'deleting';
  region: string;
  node: string; // physical/proxmox node
  cpuCores: number;
  memoryMb: number;
  diskGb: number;
  createdAt: string;
  updatedAt: string;
}

export interface CloudPodMetrics {
  cpuUsage: number;   // %
  memoryUsage: number; // %
  diskUsage: number; // %
}

export interface CloudPodLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  source: string; // 'provisioner' | 'agent' | 'panel'
}
```

### 2.4. API Client

`cloudpods.client.ts` (REST shape):
```ts
export const CloudPodsApi = {
  list: (params?: { status?: string; plan?: string }) =>
    http.get<CloudPod[]>('/api/cloudpods', { params }),

  get: (podId: number) =>
    http.get<CloudPod>(`/api/cloudpods/${podId}`),

  metrics: (podId: number) =>
    http.get<CloudPodMetrics>(`/api/cloudpods/${podId}/metrics`),

  logs: (podId: number) =>
    http.get<CloudPodLogEntry[]>(`/api/cloudpods/${podId}/logs`),

  create: (payload: {
    name: string;
    plan: CloudPodPlan;
    region: string;
    node: string;
  }) =>
    http.post<CloudPod>('/api/cloudpods', payload),

  actions: (podId: number, action: 'start' | 'stop' | 'reboot' | 'terminate') =>
    http.post(`/api/cloudpods/${podId}/actions`, { action }),
};
```

### 2.5. Create CloudPod Wizard

Steps:

- Plan selection
  - Show cards: Mini / Pro / Business / Enterprise
  - Each card: vCPU, RAM, Storage, price, recommended use.

- Location & Node
  - Region (e.g., us-east-1, us-east-2)
  - Node selection (from backend list of Proxmox nodes)

- Name & Tags
  - Pod name
  - Optional tags/notes

- Summary & Confirm
  - Show estimated billing
  - Show resource allocation
  - Confirm → calls CloudPodsApi.create

On submit, backend should:

- Create CloudPod job with idempotency_key
- Trigger provisioning pipeline (out of scope here, just call existing backend hooks)

---

## 3. GUARDIAN AI SECURITY UI (OPTION C)
Goal: Build Guardian dashboards on top of the 8 Guardian tables.

### 3.1. Frontend Structure

```text
src/modules/guardian/
  components/
    GuardianOverviewCards.tsx
    GuardianScanList.tsx
    GuardianFindingsTable.tsx
    GuardianFindingDetailsDrawer.tsx
    GuardianRemediationsTable.tsx
    GuardianRemediationApprovalModal.tsx
    GuardianAuditTimeline.tsx
  pages/
    GuardianDashboardPage.tsx
    GuardianScanDetailPage.tsx
  api/
    guardian.client.ts
  types/
    guardian.types.ts
```

### 3.2. Routes

- `/guardian` → main Guardian dashboard
- `/guardian/scans/:scanId` → scan detail

### 3.3. Guardian Types

`guardian.types.ts` (shaped to existing backend endpoints you already deployed):
```ts
export interface GuardianSummary {
  totalScans: number;
  openFindings: number;
  criticalFindings: number;
  remediationsPending: number;
  lastScanAt?: string;
}

export interface GuardianScan {
  id: number;
  tenantId: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  target: string; // e.g., 'mail-server', 'dns-core', 'srv1'
}

export interface GuardianFinding {
  id: number;
  scanId: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  message: string;
  status: 'open' | 'in_review' | 'resolved' | 'ignored';
  createdAt: string;
}

export interface GuardianRemediationTask {
  id: number;
  findingId: number;
  status: 'pending_tenant' | 'pending_platform' | 'approved' | 'executed' | 'failed';
  createdAt: string;
}
```

### 3.4. Guardian API Client

Use your existing routes:
```ts
export const GuardianApi = {
  summary: () => http.get<GuardianSummary>('/api/guardian/summary'),

  scans: () => http.get<GuardianScan[]>('/api/guardian/scans'),

  findings: (params?: { status?: string; severity?: string }) =>
    http.get<GuardianFinding[]>('/api/guardian/findings', { params }),

  remediations: () =>
    http.get<GuardianRemediationTask[]>('/api/guardian/remediations'),

  triggerScan: (payload: { target: string }) =>
    http.post('/api/guardian/scan', payload),

  requestRemediation: (findingId: number) =>
    http.post('/api/guardian/remediations/request', { findingId }),

  approveRemediationTenant: (id: number) =>
    http.post(`/api/guardian/remediations/${id}/approve-tenant`, {}),

  approveRemediationPlatform: (id: number) =>
    http.post(`/api/guardian/remediations/${id}/approve-platform`, {}),
};
```

---

## 4. MONITORING & HEALTH LAYER (OPTION D)
Goal: Add a Monitoring area in mPanel for:

- DB/query health
- Node health
- Webhook delivery
- Job queues

### 4.1. Frontend Structure

```text
src/modules/monitoring/
  components/
    MonitoringOverviewCards.tsx
    ServiceStatusList.tsx
    SlowQueryTable.tsx
    WebhookDeliveryTable.tsx
    JobQueueStatus.tsx
    EventTimeline.tsx
  pages/
    MonitoringDashboardPage.tsx
  api/
    monitoring.client.ts
  types/
    monitoring.types.ts
```

Route:

- `/monitoring` → Monitoring dashboard

### 4.2. Types

```ts
export interface ServiceStatus {
  name: string; // 'db-core', 'mail-core', 'srv1-web', 'mpanel-core', 'redis', etc.
  status: 'up' | 'down' | 'degraded';
  latencyMs?: number;
  lastCheckedAt: string;
}

export interface SlowQuery {
  id: string;
  query: string;
  avgDurationMs: number;
  calls: number;
  lastRunAt: string;
}

export interface WebhookDelivery {
  id: number;
  target: string;
  status: 'pending' | 'sent' | 'failed';
  lastError?: string;
  createdAt: string;
}

export interface JobQueueMetric {
  queueName: string;
  pending: number;
  active: number;
  failed: number;
  completedLastHour: number;
}
```

### 4.3. API Client (backend to implement later)

```ts
export const MonitoringApi = {
  overview: () =>
    http.get<{ services: ServiceStatus[]; queues: JobQueueMetric[] }>(
      '/api/monitoring/overview'
    ),

  slowQueries: () =>
    http.get<SlowQuery[]>('/api/monitoring/slow-queries'),

  webhooks: (params?: { status?: string }) =>
    http.get<WebhookDelivery[]>('/api/monitoring/webhooks', { params }),

  events: () =>
    http.get<any[]>('/api/monitoring/events'), // can refine later
};
```

---

## 5. IMPLEMENTATION ORDER FOR COPILOT

Step 1 — Align Prisma Schema

- Run `npx prisma db pull`
- Fix known mismatches per §1.2
- Ensure `prisma generate` works
- Run TS type check

Step 2 — CloudPods Module

- Create folder structure in §2.1
- Implement `cloudpods.types.ts` & `cloudpods.client.ts`
- Wire routes `/cloudpods` and `/cloudpods/:podId`
- Build dashboard + detail + wizard

Step 3 — Guardian Module

- Create folder structure in §3.1
- Implement types + `guardian.client.ts`
- Wire `/guardian` routes
- Build dashboard + scans + findings + remediations UI

Step 4 — Monitoring Module

- Create folder structure in §4.1
- Implement `monitoring.types.ts` & client
- Add `/monitoring` route
- Stub backend endpoints with dummy data if necessary.
