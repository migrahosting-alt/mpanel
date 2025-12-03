Chat, always obey `docs/ENTERPRISE_PHASE2_SPEC.ix.md` + `ENTERPRISE_MIGRATION_COMPLETE.md`.

- UPDATE MODE: The mPanel UI is already live.
- Only add new modules/components/routes on top of the existing UI.
- Do NOT delete or rewrite existing pages, layouts, routes, or components.
- Do NOT modify or drop indexes or existing enterprise SQL.
- When uncertain about schema: run `npx prisma db pull` to introspect; do not guess.
- All new features must be tenant-aware and audited via Guardian events.

Implementation order:
1) Align Prisma schema as per §1.2 mismatches; ensure `prisma generate` works.
2) Add CloudPods module (dashboard, detail, create wizard).
3) Add Guardian module (dashboard, scans, findings, remediations).
4) Add Monitoring module (overview, slow queries, webhooks, job queues).

Follow the exact file layout and API shapes from the spec. 