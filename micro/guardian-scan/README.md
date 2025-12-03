# Guardian Deep Scanner Microservice

Phase 3 service for scanning logs + configs → emitting findings → creating remediation tasks.

- Start: `npm start`
- Env: see `.env.example`
- Behavior: Polls `guardian_scans` (status='queued'), runs collectors/analyzers, inserts findings, marks scan complete.

Deployment target per spec: `/opt/micro/guardian-scan/`.
