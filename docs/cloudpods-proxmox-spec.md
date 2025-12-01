# MigraHosting CloudPods – Proxmox Provisioning Spec

## 0. Purpose

This document defines the **single source of truth** for how MigraHosting
provisions "CloudPods" (LXC containers) on the **Proxmox host** `pve.migrahosting.com`
(LAN IP: `10.1.10.70`).

It is written for:

- GitHub Copilot / AI assistants
- Future developers working on **mPanel**, **FocalPilot**, and the infra
- Root/ops users on the Proxmox node

The goal: from **one API call** or **one CLI command**, we can spin up
a new tenant container (CloudPod) with:

- Correct **storage, network, IP, gateway, DNS**
- Sane **CPU/RAM/swap** defaults
- A known **Golden Template** (CT `9000`)
- Clean, readable, **idempotent, and safe** scripts


---

## 1. Environment / Assumptions

### 1.1 Proxmox Node

- Hostname: `pve.migrahosting.com`
- LAN IP: `10.1.10.70`
- Proxmox VE (PVE) running on Debian
- Main management bridge: `vmbr0`

Developers/automation use SSH to this node.

### 1.2 Storage Layout

`/etc/pve/storage.cfg` (relevant parts):

```cfg
dir: local
    path /var/lib/vz
    content vztmpl,iso

zfspool: clients-backup
    pool clients-backup
    content rootdir,images
    mountpoint /clients-backup

zfspool: clients-main
    pool clients-main
    content rootdir,images
    mountpoint /clients-main

dir: t7-backup
    path /mnt/t7-shield
    content backup

dir: vzdump-backups
    path /clients-backup/vzdump
    content backup
    create-base-path 1
    create-subdirs 1
    prune-backups keep-last=7

dir: iso-store
    path /mnt/iso-store
    content iso,vztmpl
    nodes pve
```

Key points:

- `local` is used for templates & ISOs, not container rootfs.
- `clients-main` (ZFS pool) is the primary storage for live CloudPods.
- `clients-backup`, `vzdump-backups`, `t7-backup` are used for backups & snapshots.

### 1.3 CloudPod Network Layout

- LAN network: `10.1.10.0/24`
- Gateway: `10.1.10.1`
- Bridge on node: `vmbr0` (bridges containers onto 10.1.10.0/24)

Each CloudPod gets a static IPv4 in this range, e.g.:

- Template: `10.1.10.90`
- First client: `10.1.10.91`
- Second client: `10.1.10.92`
- etc.

Later this may be made dynamic (pulled from an IPAM), but current spec assumes
we pass either:

- `last_octet` (e.g. `91` → `10.1.10.91`), or
- Full `ip` (e.g. `10.1.10.91`)

---

## 2. Golden Template – CT 9000 (cloudpod-template)

### 2.1 Container Basics

CloudPods are built from a template container:

- **VMID**: `9000`
- **Name**: `cloudpod-template`
- **Storage**: `clients-main` (subvol-9000-disk-0)
- **OS**: `ubuntu-24.04-standard_24.04-2_amd64.tar.zst`
- **Features**: `nesting=1`
- **Memory**: 2048 MB
- **Swap**: 512 MB
- **Cores**: 2

Container was created via:

```bash
pct create 9000 local:vztmpl/ubuntu-24.04-standard_24.04-2_amd64.tar.zst \
  --hostname cloudpod-template \
  --cores 2 \
  --memory 2048 \
  --swap 512 \
  --rootfs clients-main:8 \
  --net0 name=eth0,bridge=vmbr0,ip=manual \
  --unprivileged 1 \
  --features nesting=1 \
  --password MigraTemplate2025 \
  --start 0
```

> NOTE: The initial creation IP isn't important; the script will later
> rewrite netplan completely for each clone.

### 2.2 Packages & Services inside Template

Inside CT 9000 (once created):

```bash
apt update
apt install -y \
  openssh-server \
  nginx \
  php8.3-fpm \
  php8.3-mysql \
  php8.3-curl \
  php8.3-gd \
  php8.3-mbstring \
  php8.3-xml \
  php8.3-zip \
  mariadb-server \
  curl \
  vim \
  htop \
  net-tools \
  certbot \
  python3-certbot-nginx
```

Enable SSH:

```bash
systemctl enable ssh nginx php8.3-fpm mariadb
systemctl restart ssh
passwd root   # set a strong root password for CloudPods (temporary)
```

Set timezone, if desired:

```bash
timedatectl set-timezone America/New_York
```

### 2.3 Netplan inside Template

Inside CT 9000, netplan config file:

**Path**: `/etc/netplan/50-cloud-init.yaml`

We no longer depend on a baked-in IP in this file.
The provisioning script will overwrite this file for each clone,
with the correct addresses, routes, and nameservers.

So template content can be minimal or even empty – the script handles it.

### 2.4 Converting to a Proxmox Template

Once 9000 is configured:

```bash
pct shutdown 9000
pct template 9000
```

Proxmox will now treat CT 9000 as a template, and it cannot be started
directly. All new CloudPods will be created via clones.

---

## 3. CloudPod Provisioning Script – `/usr/local/sbin/cloudpod-create.sh`

This is the authoritative provisioning script.

- **Location**: `/usr/local/sbin/cloudpod-create.sh` (on pve)
- **Owner**: root
- **Mode**: 0755
- Must be called as root or via sudo by an authorized automation user.

See the script file for full implementation.

---

## 4. Sudo / Automation User (for mPanel / FocalPilot)

### 4.1 Create Automation User on Proxmox

On pve:

```bash
adduser --disabled-password --gecos "mPanel Automation" mpanel-automation
```

Set an SSH key for this user (recommended):

```bash
mkdir -p ~mpanel-automation/.ssh
chmod 700 ~mpanel-automation/.ssh
nano ~mpanel-automation/.ssh/authorized_keys
# paste public key from mpanel-core
chmod 600 ~mpanel-automation/.ssh/authorized_keys
chown -R mpanel-automation:mpanel-automation ~mpanel-automation/.ssh
```

### 4.2 Sudoers Entry

Create `/etc/sudoers.d/mpanel-cloudpods`:

```bash
visudo -f /etc/sudoers.d/mpanel-cloudpods
```

Content:

```
mpanel-automation ALL=(root) NOPASSWD: /usr/local/sbin/cloudpod-create.sh
```

This allows:

```bash
sudo /usr/local/sbin/cloudpod-create.sh ...
```

but nothing else without a password.

### 4.3 Example SSH Call from Backend

From mpanel-core backend, the API layer can run:

```bash
ssh mpanel-automation@10.1.10.70 \
  "sudo /usr/local/sbin/cloudpod-create.sh \
     --vmid 9101 \
     --host migra-client-01 \
     --ip 10.1.10.91 \
     --cores 2 \
     --mem 2048"
```

The backend should:

1. Validate and generate vmid, hostname, and ip.
2. Capture stdout/stderr.
3. Surface status + final IP back to the UI.

Consider returning JSON lines from this script in a future version if you want
structured logging.

---

## 5. CLI Usage Examples (Ops / Support)

### 5.1 Fast Path (positional mode)

```bash
# Create CT 9101 -> 10.1.10.91
cloudpod-create.sh 9101 migra-client-01 91

# Create CT 9102 -> 10.1.10.92
cloudpod-create.sh 9102 migra-client-02 92
```

### 5.2 Custom Resources

```bash
cloudpod-create.sh \
  --vmid 9201 \
  --host migra-highmem-01 \
  --ip 10.1.10.101 \
  --cores 4 \
  --mem 8192 \
  --swap 2048 \
  --storage clients-main \
  --bridge vmbr0
```

---

## 6. Future Extensions / TODOs for Copilot

Things Copilot is allowed to implement later, based on this spec:

1. **Deletion script**:
   - `cloudpod-destroy.sh <vmid>`
   - Safety checks (confirmation / flag like `--force`).
   - Ensure snapshots/backups are handled or at least warned.

2. **Snapshot / backup integration**:
   - Trigger a vzdump backup to `vzdump-backups` or `t7-backup`.
   - Tag backups by hostname/tenant ID.

3. **Health checker**:
   - `cloudpod-health.sh <vmid>`:
     - Check `pct status`
     - Optional: inside-CT checks via `pct exec` (ping outbound, check services).

4. **IPAM / Allocation**:
   - Simple JSON or file-based IP registry:
     - Track used `10.1.10.x` addresses.
     - Provide an API/CLI `cloudpod-next-ip` that returns next free IP.

5. **mPanel integration spec**:
   - Backend endpoint: `POST /internal/proxmox/cloudpods`
   - Request JSON:
     ```json
     {
       "tenantId": "TNT-123",
       "vmid": 9101,
       "hostname": "migra-client-01",
       "ip": "10.1.10.91",
       "cores": 2,
       "memoryMb": 2048
     }
     ```
   - Backend maps this to a single SSH+sudo call to `cloudpod-create.sh`.

6. **Logging & audit**:
   - Write an entry to `/var/log/cloudpods.log` with:
     - timestamp
     - vmid
     - hostname
     - ip
     - requester (mpanel user / automation user)
   - Copilot can append logger or echo lines to the script accordingly.

---

## 7. Summary

- **Proxmox node**: `pve.migrahosting.com` (`10.1.10.70`)
- **Golden template**: CT `9000` (`cloudpod-template`) on `clients-main`
- **Script**: `/usr/local/sbin/cloudpod-create.sh` (this file defines it)
- **Network**:
  - `vmbr0`, `10.1.10.0/24`, gateway `10.1.10.1`
- **Automation**:
  - User: `mpanel-automation`
  - Sudoers: allowed to invoke `cloudpod-create.sh` without password
- **Integration**:
  - mPanel / FocalPilot calls this script over SSH with the appropriate args.

---

This document + script should be treated as the canonical contract
between Proxmox, the CloudPods system, and the mPanel backend.
