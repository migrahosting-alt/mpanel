# Cloud Pods Auto-Provisioning Setup

## Overview

Cloud Pods are isolated LXC containers on Proxmox VE that provide customers with their own private hosting environment at shared hosting prices.

## Architecture

```
Customer Order → mPanel API → Provisioning Queue → Worker → Proxmox API
                                                      ↓
                              PowerDNS ← DNS Setup ← Container Created
                                                      ↓
                              Mail Server ← Email Setup
                                                      ↓
                              Backup Storage ← Backup Config
```

## Infrastructure

| Component | Server | IP |
|-----------|--------|-----|
| Proxmox VE | pve | 10.1.10.70 |
| DNS (PowerDNS) | dns-core | 10.1.10.102 |
| Mail | mail-core | 10.1.10.101 |
| mPanel API | mpanel-core | 10.1.10.206 |
| Backup Storage | Windows share | /mnt/windows-backup |

## Cloud Pod Plans

| Plan | Price | vCPU | RAM | Storage | Bandwidth |
|------|-------|------|-----|---------|-----------|
| Student | $0/mo | 1 | 1GB | 2GB SSD | 50GB/mo |
| Starter | $1.49/mo | 1 | 1GB | 30GB NVMe | Unmetered |
| Premium | $2.49/mo | 2 | 2GB | 75GB NVMe | Unmetered |
| Business | $3.99/mo | 3 | 4GB | 100GB NVMe | Unmetered |

## Environment Variables

Add these to `/opt/mpanel/.env` on mpanel-core:

```env
# Proxmox API
PROXMOX_API_URL=https://10.1.10.70:8006/api2/json
PROXMOX_API_TOKEN_ID=mpanel-api@pve!mpanel-token
PROXMOX_API_TOKEN_SECRET=<your-token-secret>
PROXMOX_NODE_NAME=pve
PROXMOX_CLOUDPOD_TEMPLATE_ID=9000
PROXMOX_CLOUDPOD_STORAGE=local-lvm
PROXMOX_CLOUDPOD_BRIDGE=vmbr0

# PowerDNS API
POWERDNS_API_KEY=<your-pdns-key>
```

## Setup Steps

### 1. Create Proxmox API User (on pve server)

SSH to Proxmox and run:

```bash
# Create role with Cloud Pod permissions
pveum role add CloudPodsProv \
  -privs "VM.Audit,VM.Allocate,VM.Clone,VM.Config.CPU,VM.Config.Disk,VM.Config.Memory,VM.Config.Network,VM.Config.Options,VM.PowerMgmt,Datastore.AllocateSpace,Datastore.Audit,Sys.Audit"

# Create API user
pveum user add mpanel-api@pve -comment "mPanel Cloud Pod provisioning"

# Assign role at root level
pveum acl modify / -user mpanel-api@pve -role CloudPodsProv

# Create API token (save the secret!)
pveum user token add mpanel-api@pve mpanel-token --privsep 0
```

### 2. Create LXC Template (CT 9000)

Create a base Ubuntu LXC container with:
- Ubuntu 22.04 or 24.04
- Nginx + PHP-FPM 8.2+
- MariaDB 10.11+
- Web root: `/var/www/cloudpod/public`
- Bootstrap script: `/opt/cloudpod-bootstrap/first-boot.sh`

Convert to template:
```bash
pct template 9000
```

### 3. Run Database Migration

```bash
cd /opt/mpanel
psql -U mpanel -d mpanel_billing -f migrations/20251128_cloud_pods.sql
```

### 4. Deploy Updated Backend

```bash
cd /home/bonex/MigraWeb/MigraHosting/dev/migra-panel
rsync -avz src/ mhadmin@10.1.10.206:/opt/mpanel/src/
ssh mhadmin@10.1.10.206 'pm2 restart tenant-billing'
```

### 5. Test Provisioning

```bash
# On mpanel-core
cd /opt/mpanel
node src/scripts/testCloudPodProvision.js CLOUD_POD_STARTER --dry-run
```

### 6. Start Worker

```bash
# On mpanel-core
node src/workers/cloudPodWorker.js
```

Or add to PM2:
```bash
pm2 start src/workers/cloudPodWorker.js --name cloudpod-worker
pm2 save
```

## API Endpoints

### Public (Marketing Site)

- `GET /api/cloud-pods/plans` - List all plans
- `GET /api/cloud-pods/plans/:code` - Get plan details
- `GET /api/cloud-pods/compare` - Comparison table

### Authenticated (Customer Portal)

- `GET /api/cloud-pods/my-pods` - Customer's pods
- `GET /api/cloud-pods/:id` - Pod details
- `POST /api/cloud-pods/order` - Create new pod

### Admin

- `GET /api/cloud-pods/admin/all` - All pods
- `GET /api/cloud-pods/admin/provisioning-queue` - Queue status
- `POST /api/cloud-pods/admin/:id/restart` - Restart pod

## Provisioning Flow

1. **Order Created**
   - Customer submits order via `/api/cloud-pods/order`
   - CloudPodSubscription created with status `PROVISIONING`
   - ProvisioningTask created with type `CREATE_CONTAINER`

2. **Worker Picks Up Task**
   - Worker polls `cloud_pod_provisioning_tasks` table
   - Claims task with `worker_id`
   - Calls Proxmox API to clone template

3. **Container Created**
   - Clone LXC from template 9000
   - Configure CPU, RAM, disk from plan
   - Start container
   - Wait for DHCP IP

4. **DNS Setup** (if domain provided)
   - Create zone in PowerDNS
   - Add A records for root and www
   - Add MX, SPF, DMARC for email

5. **Backup Setup**
   - Configure backup cron based on plan tier
   - Create backup directory

6. **Completion**
   - Update subscription status to `ACTIVE`
   - Log completion event
   - Send welcome email

## Files

| File | Purpose |
|------|---------|
| `src/config/cloudPods.js` | Plan configs, infra settings |
| `src/config/cloudPodsSpec.ts` | TypeScript definitions |
| `src/routes/cloudPodRoutes.js` | API endpoints |
| `src/workers/cloudPodWorker.js` | Provisioning worker |
| `src/scripts/testCloudPodProvision.js` | Test script |
| `migrations/20251128_cloud_pods.sql` | Database schema |

## Troubleshooting

### Worker not starting
- Check Redis connection
- Verify DATABASE_URL
- Check Proxmox credentials

### Provisioning fails
- Check Proxmox API logs
- Verify template 9000 exists
- Check storage availability

### DNS not updating
- Verify POWERDNS_API_KEY
- Check dns-core is accessible
- Verify zone creation permissions

## Security Notes

- [ ] Switch Proxmox to proper TLS cert
- [ ] Move SSH to non-standard port externally
- [ ] Disable password auth after keys tested
- [ ] Rotate API tokens regularly
- [ ] Implement per-pod firewall rules
