# MigraCloud / MigraTeck – CloudPods Platform & Automation Spec (Control Plane + Data Plane)

> This document is the **master spec** for MigraCloud CloudPods, combining:
> - Proxmox-level scripts (Data Plane – already deployed: Enterprise v3)
> - mPanel backend APIs & queues (Control Plane)
> - FocalPilot SRE integration
> - Scaling, blueprints, quotas, observability
>
> It is written for:
> - Backend devs (Node/TS)
> - Infra/SRE
> - GitHub Copilot / AI assistants
>
> **Rule:** If any code disagrees with this document, this document wins.

---

## 0. Architecture Overview

### 0.1. Layers

1. **Data Plane (already live – CloudPods Enterprise v3)**  
   - Proxmox node(s): `pve.migrahosting.com` etc.  
   - ZFS storage: `clients-main`, `clients-backup`, `vzdump-backups`, `t7-backup`.  
   - Resource pools:
     - `MigraTeck_Production` → core infra (mail, DNS, panel, etc.)
     - `ClientPods` → all tenant CloudPods.  
   - Scripts on Proxmox:
     - `/usr/local/sbin/cloudpod-create.sh`
     - `/usr/local/sbin/cloudpod-destroy.sh`
     - `/usr/local/sbin/cloudpod-backup.sh`
     - `/usr/local/sbin/cloudpod-health.sh`
   - IPAM file on Proxmox:
     - `/etc/migra/ipam-cloudpods.txt`  
   - Log file:
     - `/var/log/migra-cloudpods.log` (JSON lines)
   - Automation user:
     - `mpanel-automation` with sudo on the scripts.

2. **Control Plane (this spec)**  
   - mPanel backend (Node/TS)  
   - Job queue (Redis + BullMQ)  
   - HTTP API (REST)  
   - Database (Postgres + Prisma)  
   - FocalPilot SRE service  
   - Observability stack (Prometheus/Grafana, Loki/ELK)

---

## 1. Database Model (Prisma-style)

> This is the **logical schema**. Copilot can turn it into Prisma models, migrations, etc.

### 1.1. Tenants / Users / Plans

```ts
model Tenant {
  id           String   @id @default(cuid())
  name         String
  slug         String   @unique
  ownerUserId  String
  owner        User     @relation(fields: [ownerUserId], references: [id])
  planId       String
  plan         Plan     @relation(fields: [planId], references: [id])
  region       String   @default("migra-us-east-1")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  cloudpods    CloudPod[]
  quotas       TenantQuota?
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  role      String   // "owner" | "admin" | "dev" | "billing"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenants   Tenant[] @relation("TenantOwner")
}

model Plan {
  id           String   @id
  name         String
  slug         String   @unique
  description  String?
  // Quota defaults
  maxCloudPods Int
  maxCpuCores  Int
  maxRamMb     Int
  maxDiskGb    Int
  backupPolicy String  // "basic", "standard", "enterprise"
  createdAt    DateTime @default(now())
}
```

### 1.2. CloudPods, Jobs, Events

```ts
model CloudPod {
  id                String   @id @default(cuid())
  tenantId          String
  tenant            Tenant   @relation(fields: [tenantId], references: [id])

  vmid              Int      @unique
  hostname          String
  ip                String   // "10.1.10.91"
  region            String   @default("migra-us-east-1")
  status            String   // "provisioning" | "active" | "failed" | "deleting" | "deleted"
  planSnapshot      String?  // JSON of plan at provisioning time (optional)
  cores             Int
  memoryMb          Int
  swapMb            Int
  storage           String   // "clients-main"
  bridge            String   // "vmbr0"

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  deletedAt         DateTime?

  lastBackupAt      DateTime?
  lastHealthStatus  String?  // "ok" | "warning" | "critical"
  lastHealthChecked DateTime?

  // Optionally link to blueprint
  blueprintId       String?
  blueprint         Blueprint? @relation(fields: [blueprintId], references: [id])

  jobs              CloudPodJob[]
  events            CloudPodEvent[]
}

model CloudPodJob {
  id         String   @id @default(cuid())
  cloudPodId String?
  cloudPod   CloudPod? @relation(fields: [cloudPodId], references: [id])

  tenantId   String
  type       String   // "CREATE" | "DESTROY" | "BACKUP" | "HEALTH_CHECK" | "SCALE"
  status     String   // "queued" | "running" | "success" | "failed"
  payload    Json
  result     Json?
  error      String?

  createdAt  DateTime @default(now())
  startedAt  DateTime?
  finishedAt DateTime?
}

model CloudPodEvent {
  id         String   @id @default(cuid())
  cloudPodId String?
  cloudPod   CloudPod? @relation(fields: [cloudPodId], references: [id])

  tenantId   String
  type       String   // "INFO" | "WARN" | "ERROR" | "STATE_CHANGE" | "BACKUP" | "HEALTH"
  message    String
  data       Json?

  createdAt  DateTime @default(now())
}
```

### 1.3. Quotas

```ts
model TenantQuota {
  id             String   @id @default(cuid())
  tenantId       String   @unique
  tenant         Tenant   @relation(fields: [tenantId], references: [id])

  maxCloudPods   Int
  maxCpuCores    Int
  maxRamMb       Int
  maxDiskGb      Int

  usedCloudPods  Int      @default(0)
  usedCpuCores   Int      @default(0)
  usedRamMb      Int      @default(0)
  usedDiskGb     Int      @default(0)

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

### 1.4. Blueprints

```ts
model Blueprint {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  description String?

  // JSON definition: what resources to create, dependencies, ports, etc.
  // Example: WordPress stack = 1 app pod + 1 DB pod, etc.
  spec        Json

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

---

## 2. Job Queue – Redis + BullMQ

### 2.1. Queues

Use BullMQ queues (Node/TS) with Redis.

**Queues:**
- `cloudpods:create`
- `cloudpods:destroy`
- `cloudpods:backup`
- `cloudpods:health`
- (Optional) `cloudpods:scale`
- (Optional) `cloudpods:blueprint`

Each queue has:
- **Producer** (API layer)
- **Worker** (dedicated process or service)

### 2.2. Job Payload Shape (TypeScript)

```ts
type CloudPodCreateJob = {
  tenantId: string;
  vmid: number;
  hostname: string;
  ip?: string;       // optional if using auto-ip
  autoIp?: boolean;  // if true, don't send ip, Proxmox script picks it
  cores: number;
  memoryMb: number;
  swapMb: number;
  region: string;    // currently "migra-us-east-1"
  requestedBy: string; // user id
};

type CloudPodDestroyJob = {
  tenantId: string;
  vmid: number;
  requestedBy: string;
};

type CloudPodBackupJob = {
  tenantId: string;
  vmid: number;
  mode: "snapshot" | "suspend" | "stop";
  reason?: string;
};

type CloudPodHealthJob = {
  tenantId: string;
  vmid: number;
  triggeredBy: "schedule" | "manual" | "focalpilot";
};

type CloudPodScaleJob = {
  tenantId: string;
  vmid: number;
  newCores: number;
  newMemoryMb: number;
  reason?: string;
};
```

---

## 3. SSH Runner – Proxmox Command Wrapper

Create a shared utility in backend: `src/services/proxmoxSsh.ts`

```ts
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export type ProxmoxCommandResult = {
  stdout: string;
  stderr: string;
};

const PROXMOX_HOST = process.env.PROXMOX_HOST ?? "10.1.10.70";
const PROXMOX_USER = process.env.PROXMOX_USER ?? "mpanel-automation";
const PROXMOX_SSH_OPTS = process.env.PROXMOX_SSH_OPTS ?? "-o StrictHostKeyChecking=no";

export async function runProxmoxCommand(
  command: string
): Promise<ProxmoxCommandResult> {
  // Example command:
  // ssh mpanel-automation@10.1.10.70 "sudo /usr/local/sbin/cloudpod-create.sh ..."
  const sshCmd = `ssh ${PROXMOX_SSH_OPTS} ${PROXMOX_USER}@${PROXMOX_HOST} ${JSON.stringify(
    command
  )}`;

  const { stdout, stderr } = await execAsync(sshCmd, {
    maxBuffer: 10 * 1024 * 1024
  });

  return { stdout, stderr };
}
```

---

## 4. Workers – BullMQ Processors

### 4.1. Create Worker – `src/workers/cloudpodCreateWorker.ts`

Pseudo/real TS:

```ts
import { Queue, Worker, Job } from "bullmq";
import { runProxmoxCommand } from "../services/proxmoxSsh";
import { prisma } from "../services/prisma";

const connection = { host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT ?? 6379) };

export const cloudpodCreateQueue = new Queue<CloudPodCreateJob>("cloudpods:create", { connection });

export const cloudpodCreateWorker = new Worker<CloudPodCreateJob>(
  "cloudpods:create",
  async (job: Job<CloudPodCreateJob>) => {
    const payload = job.data;

    // 1) Quota check
    await ensureTenantHasCapacity(payload.tenantId, payload.cores, payload.memoryMb);

    // 2) Create DB row in "provisioning" state
    const pod = await prisma.cloudPod.create({
      data: {
        tenantId: payload.tenantId,
        vmid: payload.vmid,
        hostname: payload.hostname,
        ip: payload.ip ?? "",
        region: payload.region,
        status: "provisioning",
        cores: payload.cores,
        memoryMb: payload.memoryMb,
        swapMb: payload.swapMb,
        storage: "clients-main",
        bridge: "vmbr0"
      }
    });

    // 3) Build Proxmox command
    const cmdParts = [
      "sudo /usr/local/sbin/cloudpod-create.sh",
      `--vmid ${payload.vmid}`,
      `--host ${payload.hostname}`,
      `--tenant ${payload.tenantId}`,
      "--bridge vmbr0",
      "--storage clients-main",
      `--cores ${payload.cores}`,
      `--mem ${payload.memoryMb}`,
      `--swap ${payload.swapMb}`
    ];

    if (payload.autoIp) {
      cmdParts.push("--auto-ip");
    } else if (payload.ip) {
      cmdParts.push(`--ip ${payload.ip}`);
    }

    const proxmoxCommand = cmdParts.join(" ");

    // 4) Execute via SSH
    const { stdout, stderr } = await runProxmoxCommand(proxmoxCommand);

    // TODO: optionally parse stdout for final IP/address confirmation
    // For now, if no error thrown, assume success.
    const ipFromStdout = extractIpFromOutput(stdout) ?? payload.ip ?? "";

    // 5) Update DB record
    await prisma.cloudPod.update({
      where: { id: pod.id },
      data: {
        ip: ipFromStdout,
        status: "active"
      }
    });

    // 6) Emit event
    await prisma.cloudPodEvent.create({
      data: {
        tenantId: payload.tenantId,
        cloudPodId: pod.id,
        type: "STATE_CHANGE",
        message: "CloudPod created",
        data: { stdout, stderr }
      }
    });

    return { stdout, stderr, ip: ipFromStdout };
  },
  { connection }
);

async function ensureTenantHasCapacity(tenantId: string, cores: number, memMb: number) {
  // Check TenantQuota against Plan; throw error if would exceed.
}

function extractIpFromOutput(stdout: string): string | null {
  // Very simple: look for "IP       : 10.1.10.X"
  const m = stdout.match(/IP\s*:\s*([0-9.]+)/);
  return m?.[1] ?? null;
}
```

### 4.2. Destroy Worker – similar pattern

Workers for destroy, backup, health follow same pattern:
1. Update DB state
2. Run SSH command with correct script
3. Parse output
4. Write CloudPodEvent

---

## 5. REST API – mPanel CloudPods

All routes are internal behind auth + tenant authorization.

### 5.1. Create CloudPod

```
POST /internal/cloudpods
```

```json
// Request body (example)
{
  "tenantId": "TENANT-123",
  "hostname": "client-portal",
  "vmid": 9101,
  "planId": "cloud-basic",
  "region": "migra-us-east-1",
  "cores": 2,
  "memoryMb": 2048,
  "swapMb": 512,
  "autoIp": true
}
```

**Flow:**
1. Validate auth & tenant ownership.
2. Validate plan limits.
3. Enqueue job to `cloudpods:create`.
4. Insert `CloudPodJob` row:
   - `type = "CREATE"`, `status = "queued"`, `payload = body`
5. Respond with job ID + initial CloudPod record.

### 5.2. Destroy CloudPod

```
POST /internal/cloudpods/:vmid/destroy
```

```json
{
  "tenantId": "TENANT-123",
  "reason": "user request"
}
```

**Flow:**
1. Ensure CT belongs to tenant.
2. Enqueue `cloudpods:destroy` job.
3. Update CloudPod status → `deleting`.

### 5.3. Backup

```
POST /internal/cloudpods/:vmid/backup
```

```json
{
  "tenantId": "TENANT-123",
  "mode": "snapshot",
  "reason": "before upgrade"
}
```

Calls `cloudpod-backup.sh` via worker.

### 5.4. Health

```
GET /internal/cloudpods/:vmid/health
```

- HTTP reads from DB (latest health)
- Optionally triggers async `cloudpods:health` job to refresh.

### 5.5. Listing & Filtering

```
GET /internal/tenants/:tenantId/cloudpods
GET /internal/cloudpods/:vmid
```

Return DB data + last-known health + last backup.

---

## 6. FocalPilot SRE Integration

FocalPilot is the AI SRE brain.

### 6.1. Inputs

- `CloudPodEvent` table (DB)
- `/var/log/migra-cloudpods.log` (optionally ingested)
- Health metrics from Prometheus (future)
- mPanel usage data (API errors, latency)

### 6.2. Responsibilities

**Detect patterns:**
- Repeated failures in create/destroy/backup
- Nodes overloaded
- Pods frequently unhealthy

**Suggest or initiate actions:**
- Restart health checks
- Trigger backups
- Propose scaling up/down
- Flag tenants abusing resources

### 6.3. SRE Recommendation Format

FocalPilot should output suggestions in a standard JSON:

```json
{
  "tenantId": "TENANT-123",
  "cloudPodVmid": 9101,
  "severity": "warning",
  "issue": "High memory usage for last 30m",
  "recommendedActions": [
    {
      "type": "SCALE_UP",
      "newCores": 4,
      "newMemoryMb": 4096
    },
    {
      "type": "NOTIFY_TENANT",
      "messageKey": "high_memory_usage"
    }
  ]
}
```

mPanel can then:
- Show recommendations in UI
- Or auto-trigger actions for low-risk items.

---

## 7. Scaling (Vertical First)

### 7.1. Scale Script (optional future)

Can be Proxmox-only:

```bash
cloudpod-scale.sh <vmid> --cores N --mem M
```

For now, scaling is handled by worker calling `pct set` via SSH.

### 7.2. Scale Job Flow

1. **API:** `POST /internal/cloudpods/:vmid/scale`
2. Validate tenant + quotas
3. Enqueue `cloudpods:scale`
4. **Worker:**
   - Optionally run backup
   - Run `pct set <vmid> --cores <N> --memory <M>`
   - Update DB `cores`, `memoryMb`
   - Emit `CloudPodEvent` ("SCALED").

---

## 8. Blueprints

Blueprints define multi-pod stacks.

### 8.1. Blueprint Spec Shape (JSON)

Example: WordPress stack.

```json
{
  "version": 1,
  "description": "WordPress + MariaDB + optional Redis",
  "resources": [
    {
      "kind": "CloudPod",
      "role": "app",
      "hostnamePattern": "wp-app-{tenantSlug}",
      "cores": 2,
      "memoryMb": 2048,
      "swapMb": 512
    },
    {
      "kind": "CloudPod",
      "role": "db",
      "hostnamePattern": "wp-db-{tenantSlug}",
      "cores": 1,
      "memoryMb": 1024,
      "swapMb": 512
    }
  ],
  "postCreate": [
    "configure-wordpress",
    "configure-database",
    "create-dns-records"
  ]
}
```

### 8.2. Blueprint Deploy Flow

1. Tenant chooses blueprint in UI.
2. **Backend:**
   - Creates blueprint deployment job.
   - For each resource, enqueues `cloudpods:create` with appropriate specs.
   - When all pods are active, run `postCreate` tasks:
     - Could be Ansible, scripts via SSH, or App Installer.

---

## 9. Quotas & Plans

### 9.1. Enforcement

For each create/scale action:
1. Sum existing pods for tenant:
   - `usedCloudPods`, `usedCpuCores`, `usedRamMb`, `usedDiskGb`
2. Compare vs `TenantQuota` (defaults from `Plan`).
3. If would exceed → reject job with `4xx` and `quota_exceeded` error.

### 9.2. Updates

On:
- **successful create** → increment usage
- **destroy** → decrement usage
- **scale** → adjust CPU/RAM usage accordingly

Store operations in `CloudPodEvent` for audit.

---

## 10. Observability

### 10.1. Logs

- `/var/log/migra-cloudpods.log` ship to:
  - Loki or ELK via promtail/filebeat.
- Backend logs (API/queue) ship similarly.

### 10.2. Metrics

- Proxmox metrics → Prometheus exporter.
- CloudPods metrics:
  - CPU, RAM, disk via node exporters inside containers (optional).
- **Dashboards:**
  - Per-tenant overview
  - Per-node overview
- **Alert thresholds** (CPU > 85%, disk > 80%).

---

## 11. Security & Hardening Notes

**Proxmox:**
- Only `mpanel-automation` has script sudo.
- Authorized keys only, no passwords.

**Templates:**
- Eventually prefer SSH key only and non-root users.

**API:**
- All routes behind mPanel auth.
- RBAC: only tenant admins/owners can manage CloudPods.

**Rate limiting:**
- Limit provisioning / destroy actions to prevent abuse.

---

## 12. Summary

- **Data Plane** (Proxmox + scripts + pools + IPAM) is CloudPods Enterprise v3.
- **This document defines Control Plane:**
  - DB models
  - Queues & workers
  - SSH wrapper
  - REST API
  - FocalPilot integration
  - Scaling, blueprints, quotas, observability.

**Copilot's job:**

Generate:
1. Prisma models & migrations from section 1.
2. Redis/BullMQ queues & workers from sections 2 & 4.
3. REST controllers from section 5.
4. FocalPilot integration service from section 6.
5. Scaling & blueprints support from sections 7 & 8.
6. Quota engine from section 9.

---

> Once all that is wired in, MigraCloud is a 20-year platform competing with any big provider, powered by your own Proxmox + MigraTeck stack.
