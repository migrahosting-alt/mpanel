# CloudPods – Blueprints

Blueprints define the **technical template** used to create a CloudPod in Proxmox.

While **plans** define resources & pricing, **blueprints** define:

- Which Proxmox template to clone.
- On which node.
- Which storage pool to use.
- Which network bridge to attach.
- Which cloud-init settings to apply.

## Fields

Typical blueprint record:

- `id` / `code`: e.g. `ubuntu-24-minimal`.
- `name`: Human-friendly label.
- `description`: What it's for.
- `proxmox_template_vmid`: Base template VMID on Proxmox.
- `default_node`: Node where the template lives.
- `storage_pool`: e.g. `local-lvm`, `nvme-pool`.
- `network_bridge`: e.g. `vmbr0`.
- `cloud_init_profile`: JSON/metadata.

## Provisioning Use

Worker (`cloudPodWorker.js`) uses blueprint data to:

1. Clone template → new VMID.
2. Attach storage to the configured pool.
3. Attach network interfaces to the configured bridge.
4. Configure cloud-init (hostname, SSH keys, IP).

Blueprints are stored either in a DB table or a config file, but they must be:

- Versioned.
- Marked active/inactive (for safe rollout).
