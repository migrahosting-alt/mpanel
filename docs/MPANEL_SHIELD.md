# mPanel Shield (Managed Trust Boundary)

## Vision
Build a Zero Trust ingress layer that inspects every `/api/v1` request before it reaches the core platform. Shield verifies identity, device posture, location, and risk context, then enforces tenant-scoped policies while emitting compliance-ready audit events.

## Primary Objectives
1. **Deterministic policy enforcement** – per-tenant rules that can be rolled out, versioned, and rolled back safely.
2. **Adaptive authentication** – short-lived tokens, mutual TLS, SSO integration, and hardware-backed attestations.
3. **Inline threat analytics** – anomaly detection, reputation feeds, and auto-remediation hooks.
4. **Immutable auditing** – evidence trails that satisfy SOC2/ISO/HIPAA export requirements.
5. **Enterprise resilience** – horizontal scale, regional failover, zero-downtime policy pushes.

## Core Capabilities
- **Policy Engine**: evaluates identity, IP/geo, device posture, risk score, and tenant tier before forwarding traffic.
- **Token Broker**: issues/validates JWT or PASETO tokens with per-tenant scopes, session binding, and step-up authentication requirements.
- **Trust Signals**: consumes external context (IdP, EDR, threat intel) to adjust decisions dynamically.
- **Decision Bus**: streams allow/deny + rationale to Kafka/SIEM and Guardian AI for further automation.
- **Admin APIs & UI**: allow security teams to author policies, simulate changes, and review historical versions.

## High-Level Architecture
```
Clients → Shield Edge (Fastify/Express + mTLS) → Policy Engine → Token Broker →
  → Enforcement Adapter → Core /api/v1 services
          ↓                                 ↑
        Telemetry → OTLP/Grafana             │
        Audit Log → Immutable store          │
        Remediation Hooks ← Guardian AI -----┘
```

### Components
1. **Shield Edge**
   - Terminates TLS/mTLS, normalizes headers, rate limits per tenant.
   - Runs lightweight WASM or Lua scripts for inline prechecks.

2. **Policy Engine**
   - Backed by `shield_policies` table with versioning and rollout metadata.
   - Supports rule types: identity, network, device, request context, behavioral risk.
   - Exposes simulation endpoint for change reviews.

3. **Token Broker**
   - Issues signed tokens (JWT/PASETO) with claims: tenant, role, device hash, risk score, expiry.
   - Integrates with SAML/OIDC providers and can require WebAuthn/FIDO2 step-up.

4. **Telemetry + Audit**
   - Emits OpenTelemetry spans with decision metadata.
   - Writes append-only audit entries (`shield_decisions`) with hash chains for tamper evidence.

5. **Remediation Engine (future)**
   - Hooks into Guardian AI to block, throttle, or auto-open tickets on suspicious activity.

## Data Model (initial draft)
- `shield_policies`
  - `id`, `tenant_id`, `version`, `status`, `ruleset` (JSON), `rollout_stage`, `created_by`, `created_at`.
- `shield_tokens`
  - `id`, `tenant_id`, `subject`, `jti`, `expires_at`, `issued_at`, `device_fingerprint`, `risk_score`.
- `shield_decisions`
  - `id`, `request_id`, `tenant_id`, `result`, `reason`, `policy_version`, `context` (JSON), `hash`, `prev_hash`, `created_at`.

## Phased Delivery Plan
1. **Phase 1 – Enforcement Gateway (current)**
   - Inline middleware/service enforcing allow/deny with report-only mode.
   - Admin APIs to CRUD policies and push updates.
   - Telemetry + audit logging scaffolding.

2. **Phase 2 – Adaptive Auth & Integrations**
   - Token broker with SSO, mTLS, WebAuthn step-up.
   - Device posture and IP reputation feeds.
   - Realtime SIEM streaming and alerting.

3. **Phase 3 – Autonomous Response**
   - Guardian AI driven remediation (auto-block, rate shaping, rollback policies).
   - Customer-facing dashboards for trust scores and compliance exports.
   - Regional failover, multi-tenant sharding, chaos testing.

## Immediate Next Steps
- [x] Define Prisma models + migrations for `shield_policies` and `shield_decisions`.
- [x] Scaffold Shield Edge middleware in `src/middleware/shield.js` with report-only mode.
- [x] Add admin routes under `/api/v1/platform/shield` for policy management.
- [x] Instrument `/api/v1` stack with OpenTelemetry attributes for Shield decisions.
- [ ] Document operational playbooks (rollout, rollback, alert triage).
- [ ] Build policy simulation + preview tooling for admins.
- [ ] Wire the admin UI to the new `/platform/shield` endpoints for day-to-day use.

### Developer Tooling
- `npm run shield:seed -- --tenant=global --preset=baseline` seeds a baseline policy via Prisma.
- `MPANEL_PLATFORM_TOKEN=<JWT> npm run shield:smoke -- --tenant=global` runs the automated smoke harness (creates temporary policy, toggles enforce mode, and validates `/api/v1` blocking).

With this blueprint we can start committing code for Phase 1 while keeping the long-term enterprise vision intact.
