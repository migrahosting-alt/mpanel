# Telemetry Microservice

Phase 3 observability worker that collects node/db/redis/queue metrics and inserts into monitoring_* tables.

- Start: `npm start`
- Env: see `.env.example`
- Behavior: Polls configured health endpoints + DB slow queries; inserts to `monitoring_service_status`, `monitoring_slow_queries`.

Deployment target per spec: `/opt/micro/telemetry/`.
