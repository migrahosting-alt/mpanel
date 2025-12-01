# CloudPods – Architecture

## Layered Design

```text
+----------------------------+
|        mPanel UI           |
+--------------+-------------+
               |
               v
+--------------+-------------+
|      API Routes            |
|  (cloudPodRoutes.js)       |
+--------------+-------------+
               |
               v
+--------------+-------------+
|       Service Layer        |
| cloudPodService.js         |
| cloudPodQueues.js          |
| cloudPodQuotas.js          |
+--------------+-------------+
               |
               v
+--------------+-------------+
|      Worker (background)   |
|      cloudPodWorker.js     |
+--------------+-------------+
               |
               v
+--------------+-------------+
| Proxmox SSH Service        |
|   proxmoxSsh.js            |
+--------------+-------------+
               |
               v
+--------------+-------------+
| Proxmox Cluster + Storage  |
+----------------------------+
```

## Dependency Rules

- **UI** depends on API only.
- **Routes** depend on services only.
- **Services** depend on:
  - DB abstraction
  - Quota service
  - Queue service
- **Worker** depends on:
  - Queue service
  - Proxmox SSH service
  - DB abstraction
- **Proxmox SSH service** depends only on:
  - SSH library
  - Environment/config

## Forbidden

- Routes calling `proxmoxSsh.js`.
- Routes directly mutating `cloud_pod_queue` or `cloud_pods`.
- Worker bypassing `cloudPodQueues.js` to edit queue records.
- Any code bypassing `cloudPodQuotas.js` for resource limit decisions.

For the complete system picture, see `../CLOUDPODS_MASTER_SPEC.md`.
