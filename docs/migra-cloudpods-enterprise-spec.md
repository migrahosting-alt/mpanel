# MigraCloud / MigraTeck – CloudPods Enterprise Architecture & Ops Spec

> This file is the **master spec + code bundle** for how MigraTeck runs
> "CloudPods" (LXC containers on Proxmox) for clients, fully separated
> from internal production systems.
>
> It is designed for:
> - Proxmox node(s) administrators
> - mPanel / FocalPilot backend developers
> - GitHub Copilot / AI assistants
>
> **Rule:** This file is the source of truth. Scripts should be generated from
> here and kept in sync.

---

## 0. Core Concepts

### 0.1. Control Plane vs Data Plane

- **Control Plane**  
  - mPanel (UI + API)  
  - FocalPilot (AI/SRE brain)  
  - DB for tenants, plans, resources  
  - IPAM, policy, billing

- **Data Plane**  
  - Proxmox clusters (starting with `pve.migrahosting.com`)  
  - ZFS/other storage pools  
  - CloudPods (LXC), VMs, mail, DNS, etc.

Control Plane declares **desired state** (e.g. "tenant X should have 2 CloudPods, 4GB each") and Data Plane is configured to match via scripts.

---

## 1. Physical / Logical Layout

### 1.1. Proxmox Node(s)

Initial node:

- Hostname: `pve.migrahosting.com`
- LAN IP: `10.1.10.70`
- Bridge for tenants: `vmbr0`

Later: `pve-02`, `pve-03` in cluster, but spec is written so it still works.

### 1.2. Storage Layout (Proxmox `/etc/pve/storage.cfg`)

Conceptual layout:

```cfg
dir: local
    path /var/lib/vz
    content vztmpl,iso

zfspool: clients-main
    pool clients-main
    content rootdir,images
    mountpoint /clients-main

zfspool: clients-backup
    pool clients-backup
    content rootdir,images
    mountpoint /clients-backup

dir: vzdump-backups
    path /clients-backup/vzdump
    content backup
    create-base-path 1
    create-subdirs 1
    prune-backups keep-last=7

dir: t7-backup
    path /mnt/t7-shield
    content backup

dir: iso-store
    path /mnt/iso-store
    content iso,vztmpl
    nodes pve
```

Rules:

- `clients-main` = primary storage for ClientPods (tenant CloudPods).
- `clients-backup`, `vzdump-backups`, `t7-backup` = backup tiers.
- `local` / `iso-store` = templates & ISOs.

Later you can add a dedicated ZFS pool for internal systems:

```cfg
zfspool: MigraTeck_Production
    pool migra-production
    content rootdir,images
    mountpoint /migra-production
```

### 1.3. Networks

- Main cloud network: `10.1.10.0/24`
- Gateway: `10.1.10.1`
- Bridge: `vmbr0`

CloudPod IP ranges:

- Template (9000): `10.1.10.90` (only used if you want; script overwrites netplan)
- ClientPods: `10.1.10.50-250` (as defined by IPAM ranges)

---

## 2. Logical Separation – Pools & VMID Ranges

### 2.1. Proxmox Resource Pools ("Folders")

Create two resource pools (on pve):

```bash
pvesh create /pools --poolid MigraTeck_Production \
  --comment "Core MigraTeck infra (mail, DNS, panel, etc.)"

pvesh create /pools --poolid ClientPods \
  --comment "Customer CloudPods (tenant workloads only)"
```

Then assign:

- Core systems (mail-core, dns-core, mpanel-core, db-core, etc.) → `MigraTeck_Production`
- CloudPod template (9000) + all client pods → `ClientPods`

Example:

```bash
# CloudPod template:
pvesh set /nodes/pve/lxc/9000 --pool ClientPods

# Example client CTs:
pvesh set /nodes/pve/lxc/9101 --pool ClientPods
pvesh set /nodes/pve/lxc/9102 --pool ClientPods

# Example internal VM:
pvesh set /nodes/pve/qemu/200 --pool MigraTeck_Production
```

### 2.2. VMID Ranges (Convention)

| Range | Purpose |
|-------|---------|
| 100–499 | MigraTeck_Production (infra VMs/CTs) |
| 9000 | CloudPod template |
| 9001+ | Client CloudPods (tenant containers) |

This is convention only, but helps keep things clean.

---

## 3. CloudPod Golden Template – CT 9000

### 3.1. Create Template Container

On pve, with Ubuntu 24.04 template present:

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

Assign to ClientPods pool:

```bash
pvesh set /nodes/pve/lxc/9000 --pool ClientPods
```

### 3.2. Configure Inside CT 9000

Inside CT 9000:

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

systemctl enable ssh nginx php8.3-fpm mariadb
systemctl restart ssh

# Set root password (later replace with key-only login)
passwd

timedatectl set-timezone America/New_York
```

Netplan file path: `/etc/netplan/50-cloud-init.yaml`

Template netplan content doesn't matter much; the script will overwrite it per clone.

### 3.3. Convert CT 9000 to Proxmox Template

```bash
pct shutdown 9000
pct template 9000
```

Now CT 9000 is a template; it should no longer be started manually.

---

## 4. IPAM – Simple On-Node IP Management

### 4.1. IPAM File

Simple flat-file IPAM (upgradeable later):

- **Path**: `/etc/migra/ipam-cloudpods.txt`
- **Content**: one IPv4 per line

Examples:

```
10.1.10.91
10.1.10.50
```

### 4.2. IP Allocation Rules

- IP range for CloudPods: `10.1.10.50–10.1.10.250`
- IP is considered unavailable if:
  - It is in `ipam-cloudpods.txt`, or
  - It responds to ping

The provisioning script will:

1. Allocate IP (explicit or auto)
2. Mark it in IPAM
3. On destroy, release IP from IPAM.

---

## 5. Core Scripts – Enterprise Grade

Place scripts on pve:

- `/usr/local/sbin/cloudpod-create.sh`
- `/usr/local/sbin/cloudpod-destroy.sh`
- `/usr/local/sbin/cloudpod-backup.sh` (skeleton)
- `/usr/local/sbin/cloudpod-health.sh` (skeleton)

### 5.1. cloudpod-create.sh (v3, with IPAM + logging + pool assignment)

```bash
#!/usr/bin/env bash
#
# cloudpod-create.sh (v3 – enterprise)
#
# Responsibilities:
#   - Clone CT 9000 (cloudpod-template) as a new CloudPod.
#   - Assign static IPv4 (explicit or auto).
#   - Write netplan inside CT.
#   - Assign CT to Proxmox pool "ClientPods".
#   - Apply CPU/RAM/swap defaults.
#   - Log events as JSON to /var/log/migra-cloudpods.log.
#
# Usage (positional):
#   cloudpod-create.sh <vmid> <hostname> <last_octet>
#
# Usage (flags):
#   cloudpod-create.sh --vmid 9101 --host cloudpod-9101 --ip 10.1.10.91 \
#                      --tenant TENANT-123 --cores 2 --mem 2048 --swap 512 \
#                      --storage clients-main --bridge vmbr0
#
# Usage (auto IP):
#   cloudpod-create.sh --vmid 9101 --host cloudpod-9101 --auto-ip \
#                      --tenant TENANT-123
#

set -o errexit
set -o nounset
set -o pipefail

########################################
# DEFAULT CONFIG
########################################
TEMPLATE_VMID=9000
DEFAULT_STORAGE="clients-main"
DEFAULT_BRIDGE="vmbr0"

DEFAULT_NETWORK_PREFIX="10.1.10"
DEFAULT_GATEWAY="10.1.10.1"
DEFAULT_CIDR_SUFFIX="/24"

DEFAULT_CORES=2
DEFAULT_MEMORY_MB=2048
DEFAULT_SWAP_MB=512

NETPLAN_FILE="/etc/netplan/50-cloud-init.yaml"
DEFAULT_NAMESERVERS="1.1.1.1,8.8.8.8"

IPAM_FILE="/etc/migra/ipam-cloudpods.txt"
LOG_FILE="/var/log/migra-cloudpods.log"

POOL_CLIENTPODS="ClientPods"

########################################
# Helper functions
########################################
log()  { echo "[+] $*" >&2; }
err()  { echo "[!] $*" >&2; }
die()  { err "$@"; exit 1; }
now()  { date --iso-8601=seconds; }

is_ip() {
  local ip="$1"
  [[ "$ip" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || return 1
  IFS='.' read -r a b c d <<<"$ip"
  for x in "$a" "$b" "$c" "$d"; do
    (( x >= 0 && x <= 255 )) || return 1
  done
  return 0
}

ensure_dirs() {
  mkdir -p "$(dirname "${IPAM_FILE}")"
  mkdir -p "$(dirname "${LOG_FILE}")"
  touch "${IPAM_FILE}" "${LOG_FILE}"
}

json_log() {
  local level="$1"; shift
  local message="$1"; shift
  local extra="${1:-}"
  local ts
  ts="$(now)"
  local esc_message="${message//\"/\\\"}"
  local base="{\"ts\":\"${ts}\",\"level\":\"${level}\",\"message\":\"${esc_message}\""
  if [[ -n "$extra" ]]; then
    echo "${base},${extra}}" >> "${LOG_FILE}"
  else
    echo "${base}}" >> "${LOG_FILE}"
  fi
}

ip_in_ipam() {
  local ip="$1"
  [[ -f "${IPAM_FILE}" ]] || return 1
  grep -qx "$ip" "${IPAM_FILE}" 2>/dev/null
}

ip_mark_used() {
  local ip="$1"
  ip_in_ipam "$ip" || echo "$ip" >> "${IPAM_FILE}"
}

ip_release() {
  local ip="$1"
  [[ -f "${IPAM_FILE}" ]] || return 0
  grep -vx "$ip" "${IPAM_FILE}" > "${IPAM_FILE}.tmp" || true
  mv "${IPAM_FILE}.tmp" "${IPAM_FILE}"
}

next_free_ip() {
  local base="$DEFAULT_NETWORK_PREFIX"
  local start=50
  local end=250
  for ((oct=${start}; oct<=${end}; oct++)); do
    local candidate="${base}.${oct}"
    if ip_in_ipam "${candidate}"; then
      continue
    fi
    if ping -c1 -W1 "${candidate}" &>/dev/null; then
      continue
    fi
    echo "${candidate}"
    return 0
  done
  return 1
}

########################################
# Arg parsing
########################################
VMID=""
HOSTNAME=""
IP=""
CORES="$DEFAULT_CORES"
MEM_MB="$DEFAULT_MEMORY_MB"
SWAP_MB="$DEFAULT_SWAP_MB"
STORAGE="$DEFAULT_STORAGE"
BRIDGE="$DEFAULT_BRIDGE"
GATEWAY="$DEFAULT_GATEWAY"
TENANT_ID="unknown"
AUTO_IP=false

if [[ "$#" -eq 0 ]]; then
  die "Usage: cloudpod-create.sh <vmid> <hostname> <last_octet> OR flag mode --vmid ... --host ... (--ip|--auto-ip)"
fi

if [[ "$1" == -* ]]; then
  while [[ "$#" -gt 0 ]]; do
    case "$1" in
      --vmid)    VMID="$2"; shift 2 ;;
      --host)    HOSTNAME="$2"; shift 2 ;;
      --ip)      IP="$2"; shift 2 ;;
      --auto-ip) AUTO_IP=true; shift 1 ;;
      --cores)   CORES="$2"; shift 2 ;;
      --mem)     MEM_MB="$2"; shift 2 ;;
      --swap)    SWAP_MB="$2"; shift 2 ;;
      --storage) STORAGE="$2"; shift 2 ;;
      --bridge)  BRIDGE="$2"; shift 2 ;;
      --gateway) GATEWAY="$2"; shift 2 ;;
      --tenant)  TENANT_ID="$2"; shift 2 ;;
      --help|-h) die "See script header for usage";;
      *)         die "Unknown option: $1";;
    esac
  done
else
  [[ "$#" -eq 3 ]] || die "Positional mode requires 3 args: <vmid> <hostname> <last_octet>"
  VMID="$1"
  HOSTNAME="$2"
  LAST_OCT="$3"
  [[ "$LAST_OCT" =~ ^[0-9]+$ ]] || die "Last octet must be numeric"
  (( LAST_OCT >= 1 && LAST_OCT <= 254 )) || die "Last octet must be between 1 and 254"
  IP="${DEFAULT_NETWORK_PREFIX}.${LAST_OCT}"
fi

[[ -n "$VMID" ]] || die "VMID is required"
[[ -n "$HOSTNAME" ]] || die "Hostname is required"

if [[ "$AUTO_IP" == true ]]; then
  IP="$(next_free_ip)" || die "No free IPs available in configured range"
fi

[[ -n "$IP" ]] || die "IP is required or use --auto-ip"
[[ "$VMID" =~ ^[0-9]+$ ]] || die "VMID must be numeric"
is_ip "$IP" || die "Invalid IP address: $IP"

IP_CIDR="${IP}${DEFAULT_CIDR_SUFFIX}"

ensure_dirs

json_log "info" "CloudPod create requested" \
  "\"vmid\":${VMID},\"hostname\":\"${HOSTNAME}\",\"ip\":\"${IP_CIDR}\",\"tenant\":\"${TENANT_ID}\""

log "CloudPod request:"
log "  VMID     : ${VMID}"
log "  Hostname : ${HOSTNAME}"
log "  Tenant   : ${TENANT_ID}"
log "  IP       : ${IP_CIDR}"
log "  Gateway  : ${GATEWAY}"
log "  Storage  : ${STORAGE}"
log "  Bridge   : ${BRIDGE}"
log "  Cores    : ${CORES}"
log "  Memory   : ${MEM_MB} MB"
log "  Swap     : ${SWAP_MB} MB"

########################################
# Safety checks
########################################
if [[ "${EUID}" -ne 0 ]]; then
  die "Run as root on Proxmox node"
fi

command -v pct   >/dev/null 2>&1 || die "'pct' not found"
command -v pvesh >/dev/null 2>&1 || die "'pvesh' not found"
command -v pvesm >/dev/null 2>&1 || die "'pvesm' not found"

if ! pct config "${TEMPLATE_VMID}" >/dev/null 2>&1; then
  die "Template CT ${TEMPLATE_VMID} not found"
fi

if pct config "${VMID}" >/dev/null 2>&1; then
  die "CT/VM with VMID ${VMID} already exists"
fi

if ! pvesm status | awk 'NR>1 {print $1}' | grep -qx "${STORAGE}"; then
  die "Storage '${STORAGE}' not known to Proxmox"
fi

if ping -c1 -W1 "${IP}" &>/dev/null; then
  die "IP ${IP} already responds to ping"
fi

########################################
# Provisioning
########################################
ip_mark_used "${IP}"

json_log "info" "Cloning template" \
  "\"vmid\":${VMID},\"hostname\":\"${HOSTNAME}\",\"storage\":\"${STORAGE}\""

log "Cloning template CT ${TEMPLATE_VMID} -> CT ${VMID}..."
pct clone "${TEMPLATE_VMID}" "${VMID}" \
  --hostname "${HOSTNAME}" \
  --full 1 \
  --storage "${STORAGE}"

log "Applying resources..."
pct set "${VMID}" \
  -net0 "name=eth0,bridge=${BRIDGE},ip=manual" \
  --memory "${MEM_MB}" \
  --swap "${SWAP_MB}" \
  --cores "${CORES}"

log "Assigning CT ${VMID} to pool ${POOL_CLIENTPODS}..."
pvesh set "/nodes/pve/lxc/${VMID}" --pool "${POOL_CLIENTPODS}" || \
  log "WARN: failed to assign to pool ${POOL_CLIENTPODS} (check pool existence)."

log "Starting CT ${VMID}..."
pct start "${VMID}"
sleep 5

json_log "info" "Configuring netplan" \
  "\"vmid\":${VMID},\"ip\":\"${IP_CIDR}\",\"gateway\":\"${GATEWAY}\""

pct exec "${VMID}" -- bash -lc "
  set -e
  mkdir -p \$(dirname '${NETPLAN_FILE}')
  cat >'${NETPLAN_FILE}' <<NETPLAN
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: false
      addresses:
        - ${IP_CIDR}
      routes:
        - to: 0.0.0.0/0
          via: ${GATEWAY}
      nameservers:
        addresses: [${DEFAULT_NAMESERVERS}]
NETPLAN

  chmod 600 '${NETPLAN_FILE}' || true
  netplan apply
"

log "Final IPv4 for CT ${VMID}:"
pct exec "${VMID}" -- bash -lc 'hostname && ip -4 a show dev eth0 || ip -4 a'

json_log "info" "CloudPod created successfully" \
  "\"vmid\":${VMID},\"hostname\":\"${HOSTNAME}\",\"ip\":\"${IP_CIDR}\",\"tenant\":\"${TENANT_ID}\",\"cores\":${CORES},\"memory_mb\":${MEM_MB}"

echo "============================================================"
echo " CloudPod created"
echo
echo "  VMID     : ${VMID}"
echo "  Hostname : ${HOSTNAME}"
echo "  Tenant   : ${TENANT_ID}"
echo "  IP       : ${IP_CIDR}"
echo "  Gateway  : ${GATEWAY}"
echo "  Storage  : ${STORAGE}"
echo "  Bridge   : ${BRIDGE}"
echo "  Cores    : ${CORES}"
echo "  Memory   : ${MEM_MB} MB"
echo "  Swap     : ${SWAP_MB} MB"
echo
echo "If SSH is enabled in the template:"
echo "  ssh root@${IP}"
echo "============================================================"
```

### 5.2. cloudpod-destroy.sh (with IP release + logging)

```bash
#!/usr/bin/env bash
#
# cloudpod-destroy.sh
#
# Safely destroy a CloudPod:
#   - Stops CT
#   - (TODO) optional final backup
#   - Destroys CT
#   - Releases IP from IPAM
#   - Logs action to /var/log/migra-cloudpods.log
#
# Usage:
#   cloudpod-destroy.sh <vmid>
#

set -o errexit
set -o nounset
set -o pipefail

IPAM_FILE="/etc/migra/ipam-cloudpods.txt"
LOG_FILE="/var/log/migra-cloudpods.log"

log()  { echo "[+] $*" >&2; }
err()  { echo "[!] $*" >&2; }
die()  { err "$@"; exit 1; }
now()  { date --iso-8601=seconds; }

json_log() {
  local level="$1"; shift
  local message="$1"; shift
  local extra="${1:-}"
  local ts
  ts="$(now)"
  local esc_message="${message//\"/\\\"}"
  local base="{\"ts\":\"${ts}\",\"level\":\"${level}\",\"message\":\"${esc_message}\""
  if [[ -n "$extra" ]]; then
    echo "${base},${extra}}" >> "${LOG_FILE}"
  else
    echo "${base}}" >> "${LOG_FILE}"
  fi
}

ip_release() {
  local ip="$1"
  [[ -f "${IPAM_FILE}" ]] || return 0
  grep -vx "$ip" "${IPAM_FILE}" > "${IPAM_FILE}.tmp" || true
  mv "${IPAM_FILE}.tmp" "${IPAM_FILE}"
}

if [[ "$#" -ne 1 ]]; then
  die "Usage: $0 <vmid>"
fi

VMID="$1"
[[ "$VMID" =~ ^[0-9]+$ ]] || die "VMID must be numeric"

if [[ "${EUID}" -ne 0 ]]; then
  die "Run as root on Proxmox node"
fi

command -v pct >/dev/null 2>&1 || die "'pct' not found"

if ! pct config "${VMID}" >/dev/null 2>&1; then
  die "CT ${VMID} does not exist"
fi

HOSTNAME="$(pct config "${VMID}" | awk '/^hostname:/ {print $2}')"
IPV4="$(pct exec "${VMID}" -- bash -lc 'ip -4 -o a show dev eth0 | awk "{print \$4}"' || true)"
IP_NO_CIDR="${IPV4%/*}"

log "Destroying CT ${VMID} (${HOSTNAME}) ip=${IPV4}"

json_log "info" "CloudPod destroy requested" \
  "\"vmid\":${VMID},\"hostname\":\"${HOSTNAME}\",\"ip\":\"${IPV4}\""

pct shutdown "${VMID}" --forceStop 1 --timeout 60 || pct stop "${VMID}" || true

# TODO: optional final backup script call here (cloudpod-backup.sh --final)

pct destroy "${VMID}" --destroy-unreferenced-disks 1

if [[ -n "${IP_NO_CIDR}" ]]; then
  ip_release "${IP_NO_CIDR}"
fi

json_log "info" "CloudPod destroyed successfully" \
  "\"vmid\":${VMID},\"hostname\":\"${HOSTNAME}\",\"ip\":\"${IPV4}\""

log "CT ${VMID} destroyed."
```

### 5.3. cloudpod-backup.sh (Skeleton – for Copilot to build on)

```bash
#!/usr/bin/env bash
#
# cloudpod-backup.sh (skeleton)
#
# Wraps vzdump to create backups for CloudPods.
# Intended to be called:
#   - By cron/systemd timers
#   - Or before risky operations
#
# Usage:
#   cloudpod-backup.sh <vmid> [--mode snapshot|suspend|stop] [--note "reason"]
#

set -o errexit
set -o nounset
set -o pipefail

LOG_FILE="/var/log/migra-cloudpods.log"
BACKUP_STORAGE="vzdump-backups"

log()  { echo "[+] $*" >&2; }
err()  { echo "[!] $*" >&2; }
die()  { err "$@"; exit 1; }
now()  { date --iso-8601=seconds; }

json_log() {
  local level="$1"; shift
  local message="$1"; shift
  local extra="${1:-}"
  local ts
  ts="$(now)"
  local esc_message="${message//\"/\\\"}"
  local base="{\"ts\":\"${ts}\",\"level\":\"${level}\",\"message\":\"${esc_message}\""
  if [[ -n "$extra" ]]; then
    echo "${base},${extra}}" >> "${LOG_FILE}"
  else
    echo "${base}}" >> "${LOG_FILE}"
  fi
}

if [[ "$#" -lt 1 ]]; then
  die "Usage: $0 <vmid> [--mode snapshot|suspend|stop] [--note \"reason\"]"
fi

VMID="$1"; shift
MODE="snapshot"
NOTE=""

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --mode) MODE="$2"; shift 2 ;;
    --note) NOTE="$2"; shift 2 ;;
    *) die "Unknown argument: $1";;
  esac
done

if [[ "${EUID}" -ne 0 ]]; then
  die "Run as root on Proxmox node"
fi

command -v vzdump >/dev/null 2>&1 || die "'vzdump' not found"

json_log "info" "CloudPod backup requested" \
  "\"vmid\":${VMID},\"mode\":\"${MODE}\",\"note\":\"${NOTE//\"/\\\"}\""

log "Backing up CT ${VMID} to storage ${BACKUP_STORAGE} mode=${MODE}"

vzdump "${VMID}" \
  --mode "${MODE}" \
  --storage "${BACKUP_STORAGE}" \
  --compress zstd \
  --quiet 1

json_log "info" "CloudPod backup completed" \
  "\"vmid\":${VMID},\"mode\":\"${MODE}\",\"note\":\"${NOTE//\"/\\\"}\""
```

### 5.4. cloudpod-health.sh (Skeleton – for FocalPilot to use later)

```bash
#!/usr/bin/env bash
#
# cloudpod-health.sh (skeleton)
#
# Basic health check for a CloudPod:
#   - Proxmox status
#   - Optional inside-container checks
#
# Usage:
#   cloudpod-health.sh <vmid>
#

set -o errexit
set -o nounset
set -o pipefail

VMID="${1:-}"

if [[ -z "${VMID}" ]]; then
  echo "Usage: $0 <vmid>" >&2
  exit 1
fi

command -v pct >/dev/null 2>&1 || { echo "'pct' not found" >&2; exit 1; }

STATUS="$(pct status "${VMID}" | awk '{print $2}')"

echo "vmid=${VMID}"
echo "status=${STATUS}"

if [[ "${STATUS}" == "running" ]]; then
  # Optional: check outbound ping
  pct exec "${VMID}" -- ping -c1 -W1 8.8.8.8 >/dev/null 2>&1 && \
    echo "net=ok" || echo "net=fail"

  # Optional: HTTP check (if apps listen on port 80)
  # pct exec "${VMID}" -- curl -sSf http://127.0.0.1/health || echo "http=fail"
fi
```

---

## 6. Sudoers & Automation User (mPanel / FocalPilot)

### 6.1. Automation User on Proxmox

On pve:

```bash
adduser --disabled-password --gecos "mPanel Automation" mpanel-automation

mkdir -p ~mpanel-automation/.ssh
chmod 700 ~mpanel-automation/.ssh
nano ~mpanel-automation/.ssh/authorized_keys
# paste public SSH key from mpanel-core
chmod 600 ~mpanel-automation/.ssh/authorized_keys
chown -R mpanel-automation:mpanel-automation ~mpanel-automation/.ssh
```

### 6.2. Sudoers (Restrict to Specific Scripts)

Edit via:

```bash
visudo -f /etc/sudoers.d/mpanel-cloudpods
```

Content:

```
mpanel-automation ALL=(root) NOPASSWD: /usr/local/sbin/cloudpod-create.sh
mpanel-automation ALL=(root) NOPASSWD: /usr/local/sbin/cloudpod-destroy.sh
mpanel-automation ALL=(root) NOPASSWD: /usr/local/sbin/cloudpod-backup.sh
mpanel-automation ALL=(root) NOPASSWD: /usr/local/sbin/cloudpod-health.sh
```

Now backend can do:

```bash
ssh mpanel-automation@10.1.10.70 \
  "sudo /usr/local/sbin/cloudpod-create.sh --vmid 9101 --host cloudpod-9101 --auto-ip --tenant TENANT-123"
```

---

## 7. Backend (mPanel) Integration – Spec Summary

### 7.1. Create CloudPod API

Route (internal): `POST /internal/cloudpods/create`

Example request body:

```json
{
  "tenantId": "TENANT-123",
  "vmid": 9101,
  "hostname": "cloudpod-9101",
  "ip": "10.1.10.91",
  "cores": 2,
  "memoryMb": 2048,
  "swapMb": 512
}
```

Backend action:

1. Validate tenant & plan
2. Construct SSH command:
   ```bash
   ssh mpanel-automation@10.1.10.70 \
     "sudo /usr/local/sbin/cloudpod-create.sh \
        --vmid 9101 \
        --host cloudpod-9101 \
        --ip 10.1.10.91 \
        --cores 2 \
        --mem 2048 \
        --swap 512 \
        --tenant TENANT-123"
   ```
3. Parse stdout for success/failure
4. Insert CloudPod row into mPanel DB (vmid, hostname, IP, tenantId, region, etc.)

### 7.2. Destroy CloudPod API

Route: `POST /internal/cloudpods/destroy`

Body:

```json
{
  "tenantId": "TENANT-123",
  "vmid": 9101
}
```

Backend action:

1. Verify CT belongs to that tenant
2. SSH:
   ```bash
   ssh mpanel-automation@10.1.10.70 \
     "sudo /usr/local/sbin/cloudpod-destroy.sh 9101"
   ```
3. Update DB → mark CloudPod as deleted or remove row.

---

## 8. Enterprise-Grade TODO Hooks (for future you + Copilot)

Things to build on top of this foundation:

### 8.1. Quota Enforcement

- Track max pods / RAM / cores per tenant.
- Reject create if quota exceeded.

### 8.2. Observability

- Ship `/var/log/migra-cloudpods.log` to Loki/ELK.
- Expose Proxmox metrics to Prometheus → Grafana dashboards per tenant.

### 8.3. DR / Multi-region

- Add regions: `migra-us-east-1`, `migra-us-west-1`.
- Region-specific Proxmox clusters.
- CloudPods store region + zone in metadata.

### 8.4. Security Hardening

- Transition template to SSH key-only + non-root `cloudadmin` user.
- OS patching pipeline: snapshot → update → health check → keep/rollback.

### 8.5. Blueprints

- Higher-level definitions: "WordPress stack", "Laravel + DB", "Node API".
- Each blueprint maps to multiple CloudPods + DBs + DNS + SSL.

---

## 9. Summary

This file defines:

- Physical layout (Proxmox, storage, network)
- Logical separation (`MigraTeck_Production` vs `ClientPods` pools)
- Golden template CT 9000
- Enterprise-grade creation & destruction scripts
- IPAM + logging
- Backend + sudoers integration

You and Copilot can:

1. Copy scripts out to `/usr/local/sbin/`
2. Copy sudoers snippet
3. Implement mPanel routes & DB models matching this spec.

**This is your 20-year ahead baseline for CloudPods on Proxmox.**
