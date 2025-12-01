# CloudPods – Queue & Worker

CloudPods uses a database-backed queue plus a worker process for long-running operations.

## Queue

Table: `cloud_pod_queue`

Each row represents one action:

- `pod_id`
- `action`: `create`, `destroy`, `start`, `stop`, `reboot`, `backup`, `scale`, `sync`
- `payload`: JSON with details
- `status`: `queued`, `running`, `success`, `failed`
- `retry_count`, `error_message`
- `created_at`, `updated_at`, `processed_at`

Service file: `src/services/cloudPodQueues.js`

Responsibilities:

- `enqueueAction(...)`
- `getPendingItems(batchSize)`
- `markRunning(queueId)`
- `markSuccess(queueId, result)`
- `markFailed(queueId, error)`

The rest of the codebase must not manually update queue statuses.

## Worker

File: `cloudPodWorker.js`

Responsibilities:

1. Periodically poll for `status='queued'`.
2. For each job:
   - Mark as `running`.
   - Load pod, plan, blueprint, tenant info.
   - Execute operation via `proxmoxSsh.js`.
   - Update `cloud_pods` state.
   - Mark queue item as `success` or `failed`.

The worker is the **only** component allowed to talk to Proxmox.

All provisioning logic (VMID assignment, cloning, starting, destroying) lives here.
