# Guardian AI – Enterprise Specification (Condensed)

This document summarizes the enterprise architecture for Guardian AI, Abigail SOC, and mPanel integration.

## 1. Purpose

Guardian AI provides tenant-scoped security scanning, finding management, and remediation orchestration
for the Migra platform. Abigail acts as an AI SOC analyst on top of Guardian, and mPanel provides the UI.

## 2. Core Components

- Prisma models declared in `backend/prisma/schema.guardian.prisma`.
- Backend NestJS module under `backend/modules/guardian`.
- Workers under `backend/workers`.
- Frontend pages in `frontend/src/pages/admin`.
- Policy packs under `policy_packs/`.
- Integration points:
  - ProvisioningService for agents and remediation
  - RbacService for permissions
  - Stripe/billing (not included here but referenced)

## 3. Data Model

Guardian models are tenant-scoped and region-aware. They include:

- GuardianInstance – configuration and policy pack for each tenant.
- GuardianScan – scan job lifecycle.
- GuardianFinding – individual issues discovered.
- GuardianRemediationTask – remediation workflow items with dual approval.
- GuardianAuditEvent – append-only audit trail.

## 4. Backend Responsibilities

- Expose `/guardian/*` endpoints:
  - GET /guardian/summary
  - GET /guardian/instance
  - POST /guardian/instance
  - POST /guardian/scan
  - GET /guardian/scans
  - GET /guardian/findings
  - GET /guardian/remediations
  - POST /guardian/remediations/request
  - POST /guardian/remediations/:id/approve-tenant
  - POST /guardian/remediations/:id/approve-platform
  - GET /guardian/platform/metrics

- Enforce RBAC:
  - tenant:guardian:read,manage,scan,remediate,approve
  - platform:guardian:read,manage,approve

- Push work onto BullMQ queues:
  - guardian:scan
  - guardian:remediation

## 5. Workers

- guardian-scan.worker.ts:
  - Mark scan running
  - Ask ProvisioningService to run scans via agents
  - Persist findings and update status

- guardian-remediation.worker.ts:
  - Verify dual approval
  - Execute remediation via ProvisioningService
  - Store result and logs

## 6. Frontend

- GuardianManagement.tsx – Tenant view for:
  - Status cards
  - Configuration summary
  - Open findings
  - Remediation queue
  - Triggering scans

- GuardianSOC.tsx – Platform SOC view:
  - High-level posture
  - Active findings
  - Pending remediations

## 7. Policy Packs

Policies live under `policy_packs/<pack>/<version>/` and include:
- metadata.json – name, version, description
- checks.json – list of checks, severities, and mapping to remediation ids
- remediation.json – remediations and approval requirements
- agent-config.json – which checks run for each scan type

## 8. Abigail Integration

Abigail uses the same HTTP APIs as the frontend:

- Reads `/guardian/summary`, `/guardian/findings`, `/guardian/remediations`.
- Triggers `/guardian/scan` and `/guardian/remediations/request` when instructed.
- Never bypasses remediation approvals; it only prepares tasks for human or policy approval.

## 9. Next Steps

- Merge Prisma schema into main `schema.prisma`.
- Wire GuardianModule into the NestJS app.
- Implement ProvisioningService methods used by workers.
- Connect Stripe billing, ELK logging, and metrics.

This spec is intentionally concise and code-oriented so that GitHub Copilot and other tools
can use it as a reference when generating or modifying Guardian-related code.
