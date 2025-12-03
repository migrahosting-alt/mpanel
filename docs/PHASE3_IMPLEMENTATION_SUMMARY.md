# Phase 3 Implementation Summary

**Date:** December 3, 2025  
**Spec:** `ENTERPRISE_PHASE3_UPDATE.ix.md` (additive only; no breaks)

## Deliverables

### 1. Microservices Scaffolded

Created three additive services under `migra-panel/micro/`:

- **`micro/cloudpods/`**: Boots existing BullMQ workers from `src/workers/runCloudPodWorkers.ts`. No duplication; delegates to live logic.
- **`micro/guardian-scan/`**: Polls `guardian_scans` for pending scans, marks running, stubs collectors/analyzers, inserts findings (TODO), marks completed.
- **`micro/telemetry/`**: Polls node health endpoints, inserts `monitoring_service_status`; stubs slow queries, Redis, queue metrics.

Each service includes:
- `package.json` (tsx runner, minimal deps)
- `tsconfig.json`
- `src/index.ts`, `src/logger.ts`
- `.env.example`
- `README.md`
- Example systemd unit

### 2. DB Schema (Additive)

**`migrations/phase3_additive.sql`:**

- `cloud_pod_nodes` (Proxmox node inventory)
- `cloud_pod_allocations` (resource tracking per node)
- `cloud_pod_metrics` (per-pod runtime metrics)
- `monitoring_service_status` (service health checks)
- `monitoring_slow_queries` (slow query tracking)

All `CREATE TABLE IF NOT EXISTS`; no existing tables/columns/indexes touched.

**`prisma/schema.prisma`:**

Added 5 new models at the end (CloudPodNode, CloudPodAllocation, CloudPodMetric, MonitoringServiceStatus, MonitoringSlowQuery). No changes to existing models.

### 3. Backend API Extensions

**CloudPods:**  
Existing routes (`/api/cloudpods`, `/api/cloudpods/:id/actions`) already enqueue jobs to BullMQ and return 202. No changes needed; spec compliance confirmed.

**Guardian:**  
Existing route (`/api/guardian/scan`) already inserts scan with status='queued'. No changes needed. Guardian-scan microservice now polls and processes.

**Monitoring:**  
Existing routes (`/api/monitoring/overview`, `/api/monitoring/slow-queries`) present. Telemetry worker now populates data.

### 4. Workers/Services

- **cloudpods worker**: Already live via `src/workers/cloudPodWorkers.ts`. New microservice entry point delegates to it.
- **guardian-scan worker**: New polling loop + stub logic in `micro/guardian-scan/src/index.ts`.
- **telemetry worker**: New polling loop + node health checks in `micro/telemetry/src/index.ts`.

### 5. Documentation

- Updated `TEST-CHECKLIST.md` with Phase 3 test cases (section 14).
- Each microservice has README + systemd unit example.

## Compliance with Spec

✅ Additive schema only (5 new tables)  
✅ No breaking changes to existing APIs or tables  
✅ Microservices scaffold in place  
✅ CloudPods provisioner delegates to live BullMQ workers  
✅ Guardian scanner polls pending scans  
✅ Telemetry worker polls health endpoints and inserts metrics  
✅ Backend API wiring confirmed (no duplication; existing routes used)  
✅ Test checklist updated  

## Next Steps (Iterative)

- Run `npx prisma generate` to reflect new models.
- Apply `migrations/phase3_additive.sql` to production DB.
- Deploy microservices to `/opt/micro/*` and enable systemd units.
- Implement full collectors/analyzers for Guardian (mail logs, web logs, TLS, DNS).
- Implement full telemetry collectors (pg_stat_statements, Redis INFO, BullMQ stats).
- Seed initial `cloud_pod_nodes` rows (Proxmox node inventory).

**Status:** Phase 3 skeleton complete. Ready for iteration and deployment.
