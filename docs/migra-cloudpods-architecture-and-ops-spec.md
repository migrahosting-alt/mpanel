# MigraCloud Platform – CloudPods Architecture & Ops Spec (Single Source of Truth)

> This file is the **master spec** for how MigraHosting / MigraCloud provisions,
> manages, and automates tenant containers ("CloudPods") on Proxmox.
>
> It is written for:
> - Human operators
> - GitHub Copilot / AI assistants
> - Backend developers (mPanel / FocalPilot / automation)
>
> **Rule**: If anything disagrees with this file, this file wins.

---

## 0. Vision & Design Principles

- **Control Plane vs Data Plane**
  - **Control Plane**: mPanel, FocalPilot, APIs, IPAM, policies, billing.
  - **Data Plane**: Proxmox clusters, CloudPods, storage, networking.
  - Control Plane declares **desired state**, Data Plane is reconciled to match.

- **20-year horizon**
  - Everything is:
    - Scriptable
    - Observable
    - Replaceable (no hard vendor lock)
  - Assumes growth to:
    - Multiple Proxmox clusters
    - Multi-region / multi-site
    - Automated self-healing & AI-assisted operations.

- **Tenancy first**
  - Every resource (CloudPod, backup, IP, DNS, mailbox) is attached to a **tenant**,
    not just a random VMID.

---

## 1. Physical & Logical Layout

### 1.1. Nodes / Hosts (Example)

- `pve.migrahosting.com` → main Proxmox node for CloudPods (LAN: `10.1.10.70`)
- Future:
  - `pve-02`, `pve-03` in a Proxmox cluster
  - Each node has:
    - NVMe pool for `clients-main`
    - HDD/ZFS pool for `clients-backup`, `vzdump-backups`, etc.

### 1.2. Storage Layout

`/etc/pve/storage.cfg` (conceptual):

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

Rules:

- `clients-main` = primary storage for live CloudPods.
- `clients-backup`, `vzdump-backups`, `t7-backup` = backup & archive tiers.
- `local` + `iso-store` = templates & ISOs.

### 1.3. Networking

- Main management / tenant network: `10.1.10.0/24`
- Gateway: `10.1.10.1`
- Bridge on Proxmox: `vmbr0`

Initial pattern:

- CloudPod template IP: `10.1.10.90` (only used at first)
- Tenant pods: `10.1.10.50-250` (allocatable range)

Later: multiple subnets / bridges (e.g. `vmbr1`, `10.2.0.0/24` for DB pods, etc.)

---

## 2. CloudPod Golden Template – CT 9000

### 2.1. Creation

On pve:

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

### 2.2. Inside-template configuration

Inside CT 9000:

```bash
apt update
apt install -y \
  openssh-server \
  nginx \
  php8.3-fpm php8.3-mysql php8.3-curl php8.3-gd php8.3-mbstring php8.3-xml php8.3-zip \
  mariadb-server \
  curl vim htop net-tools \
  certbot python3-certbot-nginx

systemctl enable ssh nginx php8.3-fpm mariadb
systemctl restart ssh

# Set timezone
timedatectl set-timezone America/New_York
```

### 2.3. Convert to Proxmox Template

```bash
pct shutdown 9000
pct template 9000
```

Now 9000 is a template, used only for cloning new CloudPods.

---

## 3. Core Provisioning Script – `/usr/local/sbin/cloudpod-create.sh`

This is the main contract between Control Plane (mPanel/FocalPilot)
and Data Plane (Proxmox). All automated CloudPod creation MUST go through this.

- **Location**: `/usr/local/sbin/cloudpod-create.sh`
- **Owner**: `root:root`
- **Mode**: `0755`
- **Logs to**: `/var/log/migra-cloudpods.log`
- **Uses**: optional simple IPAM file `/etc/migra/ipam-cloudpods.txt`

See: `scripts/cloudpod-create.sh` in this repo.

---

## 4. CloudPod Destroy Script – `/usr/local/sbin/cloudpod-destroy.sh`

Safe destroy: logs, releases IP from IPAM, optional soft-delete.

See: `scripts/cloudpod-destroy.sh` in this repo.

---

## 5. Sudoers & Automation User

### 5.1. Automation User

On pve:

```bash
adduser --disabled-password --gecos "mPanel Automation" mpanel-automation

mkdir -p ~mpanel-automation/.ssh
chmod 700 ~mpanel-automation/.ssh
# paste public key from mpanel-core into authorized_keys
chmod 600 ~mpanel-automation/.ssh/authorized_keys
chown -R mpanel-automation:mpanel-automation ~mpanel-automation/.ssh
```

### 5.2. Sudoers

Create `/etc/sudoers.d/mpanel-cloudpods`:

```
mpanel-automation ALL=(root) NOPASSWD: /usr/local/sbin/cloudpod-create.sh
mpanel-automation ALL=(root) NOPASSWD: /usr/local/sbin/cloudpod-destroy.sh
```

---

## 6. Backend (mPanel) Integration

### 6.1. Create CloudPod

```bash
ssh mpanel-automation@10.1.10.70 \
  "sudo /usr/local/sbin/cloudpod-create.sh \
     --vmid 9101 \
     --host cloudpod-9101 \
     --auto-ip \
     --cores 2 \
     --mem 2048 \
     --tenant TENANT-123"
```

### 6.2. Destroy CloudPod

```bash
ssh mpanel-automation@10.1.10.70 \
  "sudo /usr/local/sbin/cloudpod-destroy.sh 9101"
```

---

## 7. Future Enhancements

- **Backups**: `cloudpod-backup.sh` wrapping vzdump
- **Health Checks**: `cloudpod-health.sh` for monitoring
- **Resize**: `cloudpod-resize.sh` for live resource changes
- **IPAM Upgrade**: PostgreSQL-backed IP management
- **Observability**: Ship logs to Loki/ELK, metrics to Prometheus

---

## 8. Summary

| Component | Location |
|-----------|----------|
| Proxmox Node | `10.1.10.70` (pve) |
| Template | CT 9000 on `clients-main` |
| Create Script | `/usr/local/sbin/cloudpod-create.sh` |
| Destroy Script | `/usr/local/sbin/cloudpod-destroy.sh` |
| IPAM File | `/etc/migra/ipam-cloudpods.txt` |
| Audit Log | `/var/log/migra-cloudpods.log` |
| Automation User | `mpanel-automation` |
| Network | `10.1.10.0/24`, gateway `10.1.10.1` |
