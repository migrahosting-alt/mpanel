# Guardian AI – High-Level Architecture

```mermaid
flowchart LR
  subgraph Tenant["Tenant Context"]
    mPanel["mPanel UI
(GuardianManagement)"]
    Agent["Migra Agent
(on servers)"]
  end

  subgraph Platform["Migra Platform"]
    Abigail["Abigail AI SOC"]
    Backend["Guardian Module
(NestJS + Prisma)"]
    Queues["BullMQ Queues
 guardian:scan / guardian:remediation"]
    Workers["Scan & Remediation Workers"]
    DB["Postgres + Prisma
Guardian tables"]
    S3["S3-compatible storage
(archives, logs)"]
    RBAC["RBAC Service"]
  end

  mPanel -->|"REST /guardian/*"| Backend
  Abigail -->|"REST /guardian/*"| Backend
  Backend --> Queues
  Queues --> Workers
  Workers --> DB
  Workers --> S3
  Backend --> DB
  Backend --> RBAC
  Workers -->|"run scans / fix issues"| Agent
  Agent -->|"findings / telemetry"| Workers
```

- Tenant UI and Abigail share the same Guardian HTTP API.
- Guardian uses queues and workers to talk to agents and perform remediation.
- All actions are logged to the Guardian audit tables and optionally to centralized logging.
