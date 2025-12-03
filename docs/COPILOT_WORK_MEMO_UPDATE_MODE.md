# COPILOT WORK MEMO — UPDATE MODE ONLY

Always assume:

- The system is ALREADY running in production.
- The database `mpanel` on `10.1.10.210` is the source of truth.
- Enterprise indexes and SQL are finalized (see `ENTERPRISE_MIGRATION_COMPLETE.md`).

You MUST:

1. Read and follow:
   - `ENTERPRISE_MIGRATION_COMPLETE.md`
   - `ENTERPRISE_QUICK_REFERENCE.md`
   - `PRODUCTION_STATUS.md`
   - `BACKEND-API-CONTRACT.md`
   - `FRONTEND-WIRING-GUIDE.md`
   - `docs/ENTERPRISE_PHASE2_UPDATE.ix.md`

2. Work in **UPDATE MODE**:
   - Do NOT delete or rewrite existing routes, pages, or modules.
   - Do NOT remove or modify existing indexes or schema objects unless explicitly specified.
   - Only ADD new modules, components, routes, and types as described in `ENTERPRISE_PHASE2_UPDATE.ix.md`.

3. When dealing with Prisma:
   - Run `npx prisma db pull` to sync with the live DB.
   - Do NOT generate destructive migrations.
   - Align models with existing tables and columns.

4. When adding features:
   - CloudPods: follow the CloudPods module spec in `ENTERPRISE_PHASE2_UPDATE.ix.md`.
   - Guardian: follow the Guardian module spec.
   - Monitoring: follow the Monitoring module spec.
   - Preserve tenant isolation and RBAC.

If in doubt, prefer:
- Introspecting the existing database and code,
- Extending modules instead of replacing them,
- Keeping changes small, incremental, and reversible.
