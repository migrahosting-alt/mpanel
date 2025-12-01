# CloudPods – Overview

CloudPods is MigraHosting's internal cloud compute platform built on top of **Proxmox** and integrated into **mPanel**.

**Key capabilities:**

- Self-service creation of virtual machines ("CloudPods").
- Plan-based resources (Student, Starter, Premium, Business).
- SSH-based provisioning on Proxmox nodes.
- Full lifecycle management:
  - Create, start, stop, reboot, backup, destroy.
- Tenant-aware quota enforcement.
- REST API for integration with mPanel UI and future automation.

**Key design goals:**

- Simple: one clear path from API → worker → Proxmox.
- Safe: quotas and tenant isolation by default.
- Extensible: easy to add new plans, blueprints, nodes, and features.
- Observable: consistent logging and admin stats.

See `../CLOUDPODS_MASTER_SPEC.md` for the complete specification.
