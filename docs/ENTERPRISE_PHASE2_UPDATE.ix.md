# ENTERPRISE PHASE 2 UPDATE SPEC (SCHEMA + CLOUDPODS + GUARDIAN + MONITORING)

> UPDATE MODE: The mPanel UI and backend are already live in production.
> Copilot MUST treat this file as an incremental update spec.
> Do NOT delete or rewrite existing pages, layouts, routes, or components.
> Do NOT remove or modify existing indexes or enterprise SQL.
> Only ADD new modules/components/routes or extend existing ones safely.

## 0. GLOBAL RULES FOR COPILOT

- Production database `mpanel` on `db-core (10.1.10.210)` is the **source of truth**.
- Prisma must reflect the **real DB**, not the other way around.
- DO NOT drop or rename columns without explicit instructions here.
- DO NOT touch the enterprise index scripts or `ENTERPRISE_MIGRATION_COMPLETE.md`.
- When unsure about schema → run `npx prisma db pull` instead of guessing.
- All new features must be **tenant-aware** where applicable (`tenant_id`).
- All sensitive operations should generate Guardian audit events.

Current env (for reference):

```env
DATABASE_URL="postgresql://mpanel_user:Sikse222@10.1.10.210:5432/mpanel?schema=public"
SHADOW_DATABASE_URL="postgresql://mpanel_user:Sikse222@10.1.10.210:5432/mpanel_shadow?schema=public"
PRISMA_MIGRATE_SHADOW_DATABASE_URL="${SHADOW_DATABASE_URL}"
```

## 1. PRISMA SCHEMA ALIGNMENT (PHASE 2 STEP 1)

Goal: Align schema.prisma with actual production schema so backend + UI stop fighting reality.

### 1.1. Workflow

Run:

```
npx prisma db pull
```

This pulls the existing DB schema into Prisma models without changing the DB.

Use:

- ENTERPRISE_MIGRATION_COMPLETE.md
- ENTERPRISE_MIGRATION_COMPLETE.md
- ENTERPRISE_QUICK_REFERENCE.md
- DB reality (via db pull)

Fix only the known mismatches below. Do NOT invent new fields.

### 1.2. Known Schema Mismatches (MUST FIX)

Adjust Prisma models so they match production:

#### 1.2.1. Products

DB uses status (string). Prisma MUST NOT assume isActive: Boolean.

```prisma
model Product {
  id        Int     @id @default(autoincrement())
  tenantId  Int
  name      String
  code      String  @unique
  status    String  @default("active") // enum-like string, not Boolean
  // keep all other fields pulled from db
}
```

#### 1.2.2. Subscriptions

DB uses product_id FK (not product_code).

```prisma
model Subscription {
  id          Int      @id @default(autoincrement())
  tenantId    Int
  customerId  Int
  productId   Int
  status      String

  product     Product  @relation(fields: [productId], references: [id])
}
```

#### 1.2.3. Backups

DB uses backup_type (not type).

```prisma
model Backup {
  id          Int     @id @default(autoincrement())
  tenantId    Int
  backupType  String  @map("backup_type")
  status      String
  // keep all other fields
}
```

#### 1.2.4. SSL Certificates

DB uses:

- domain_name (string, not domain_id)
- expires_at (not valid_to)

```prisma
model SslCertificate {
  id          Int      @id @default(autoincrement())
  tenantId    Int
  domainName  String   @map("domain_name")
  expiresAt   DateTime @map("expires_at")
  autoRenew   Boolean  @default(false)
}
```

#### 1.2.5. CloudPod Jobs

Ensure idempotency_key exists:

```prisma
model CloudPodJob {
  id              Int      @id @default(autoincrement())
  tenantId        Int
  podId           Int?
  jobType         String
  status          String
  idempotencyKey  String?  @unique @map("idempotency_key")
  createdAt       DateTime @default(now())
}
```

### 1.3. Output

- Updated schema.prisma that matches DB.
- `npx prisma generate` passes.
- TypeScript typecheck passes.
- No data-destructive migrations generated.

## 2. CLOUDPODS DASHBOARD + CREATE CLOUDPOD WIZARD (PHASE 2 STEP 2)

Goal: Add a CloudPods module to the existing mPanel UI without breaking current screens.

### 2.1. Folder Structure (ADD ONLY)

Create:

```
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

Do NOT rename or move existing modules.

### 2.2. Routes (EXTEND EXISTING ROUTER)

Add routes:

- `/cloudpods` → CloudPodsDashboardPage
- `/cloudpods/:podId` → CloudPodDetailPage

Hook into the existing router in a non-breaking way. Keep existing routes intact.

### 2.3. Types

`src/modules/cloudpods/types/cloudpods.types.ts`:

```ts
export type CloudPodPlan = 'mini' | 'pro' | 'business' | 'enterprise';

export interface CloudPod {
  id: number;
  tenantId: number;
  name: string;
  plan: CloudPodPlan;
  status: 'provisioning' | 'running' | 'stopped' | 'error' | 'deleting';
  region: string;
  node: string;
  cpuCores: number;
  memoryMb: number;
  diskGb: number;
  createdAt: string;
  updatedAt: string;
}

export interface CloudPodMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
}

export interface CloudPodLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  source: string; // 'provisioner' | 'agent' | 'panel'
}
```

### 2.4. API Client

`src/modules/cloudpods/api/cloudpods.client.ts`:

```ts
import { http } from '@/lib/http';
import { CloudPod, CloudPodMetrics, CloudPodLogEntry, CloudPodPlan } from '../types/cloudpods.types';

export const CloudPodsApi = {
  list: (params?: { status?: string; plan?: CloudPodPlan }) =>
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

Backend should:

- Use CloudPodJob with idempotency_key for provisioning.
- Respect tenant isolation.

### 2.5. Create CloudPod Wizard (UX)

Wizard steps:

- Plan Selection
  - Cards for Mini / Pro / Business / Enterprise with vCPU, RAM, disk, and use-case.

- Location & Node
  - Region dropdown
  - Node dropdown (from backend list of Proxmox nodes)

- Name & Tags
  - Pod name (required)
  - Optional tags/notes

- Summary & Confirm
  - Show config + estimated billing
  - Create on confirm via CloudPodsApi.create()

## 3. GUARDIAN AI SECURITY UI (PHASE 2 STEP 3)

Goal: Expose Guardian security features (already indexed and ready) in the UI.

### 3.1. Folder Structure

```
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

- `/guardian` → GuardianDashboardPage
- `/guardian/scans/:scanId` → GuardianScanDetailPage

### 3.3. Types (`guardian.types.ts`)

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
  target: string;
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

### 3.4. API Client (`guardian.client.ts`)

```ts
import { http } from '@/lib/http';
import {
  GuardianSummary,
  GuardianScan,
  GuardianFinding,
  GuardianRemediationTask,
} from '../types/guardian.types';

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

## 4. MONITORING & HEALTH MODULE (PHASE 2 STEP 4)

Goal: Add a Monitoring area to visualize service health, slow queries, webhooks, and queues.

### 4.1. Folder Structure

```
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

### 4.2. Route

- `/monitoring` → MonitoringDashboardPage

### 4.3. Types (`monitoring.types.ts`)

```ts
export interface ServiceStatus {
  name: string;
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

### 4.4. API Client (`monitoring.client.ts`)

```ts
import { http } from '@/lib/http';
import {
  ServiceStatus,
  SlowQuery,
  WebhookDelivery,
  JobQueueMetric,
} from '../types/monitoring.types';

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
    http.get<any[]>('/api/monitoring/events'),
};
```

Backend can start with dummy/static data and upgrade to real metrics later.

## 5. IMPLEMENTATION ORDER (MUST FOLLOW)

### Schema Alignment

- `npx prisma db pull`
- Fix known mismatches in §1.2
- `npx prisma generate` OK
- TypeScript build OK

### CloudPods Module

- Add folder structure
- Add types + API client
- Add routes + sidebar entry (non-breaking)
- Implement dashboard + detail + wizard

### Guardian Module

- Add folder structure
- Add types + API client
- Add `/guardian` routes
- Implement dashboard + scans + findings + remediations

### Monitoring Module

- Add folder structure
- Add types + API client
- Add `/monitoring` route
- Implement overview + slow queries + webhooks + queues
