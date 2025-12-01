#!/usr/bin/env bash
#
# cloudpod-create.sh (v3 – enterprise edition)
#
# Responsibilities:
#   - Clone golden template CT 9000 into a new CloudPod.
#   - Assign IP (explicit or auto) and write/patch netplan.
#   - Apply CPU/RAM/swap defaults.
#   - Log actions to /var/log/migra-cloudpods.log as JSON (audit-ready).
#
# Usage (positional mode):
#   cloudpod-create.sh <vmid> <hostname> <last_octet>
#
#   Example:
#     cloudpod-create.sh 9101 migra-client-01 91
#     -> CT 9101, IP 10.1.10.91/24
#
# Usage (flag mode – more explicit):
#   cloudpod-create.sh --vmid 9101 --host migra-client-01 --ip 10.1.10.91 \
#                      --cores 4 --mem 4096 --swap 1024 \
#                      --storage clients-main --bridge vmbr0 \
#                      --tenant TENANT-123
#
# Usage (auto IP from pool):
#   cloudpod-create.sh --vmid 9101 --host migra-client-01 --auto-ip \
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

# IPAM file (simple list of used IPs)
IPAM_FILE="/etc/migra/ipam-cloudpods.txt"
LOG_FILE="/var/log/migra-cloudpods.log"

########################################
# Helpers
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

json_log() {
  # json_log level message [extra_json_fragment]
  local level="$1"; shift
  local message="$1"; shift
  local extra="${1:-}"
  local ts
  ts="$(now)"
  local base="{\"ts\":\"${ts}\",\"level\":\"${level}\",\"message\":\"${message//\"/\\\"}\""
  if [[ -n "$extra" ]]; then
    echo "${base},${extra}}" >> "${LOG_FILE}"
  else
    echo "${base}}" >> "${LOG_FILE}"
  fi
}

ensure_dirs() {
  mkdir -p "$(dirname "${IPAM_FILE}")"
  mkdir -p "$(dirname "${LOG_FILE}")"
  touch "${IPAM_FILE}" "${LOG_FILE}"
}

ip_in_ipam() {
  local ip="$1"
  grep -qx "$ip" "${IPAM_FILE}" 2>/dev/null
}

ip_mark_used() {
  local ip="$1"
  ip_in_ipam "$ip" || echo "$ip" >> "${IPAM_FILE}"
}

next_free_ip() {
  # Simple allocator: scan range 50–250 and pick first not in IPAM and not pinging
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
  die "Usage: cloudpod-create.sh <vmid> <hostname> <last_octet> OR --vmid ... --host ... --ip ... | --auto-ip"
fi

if [[ "$1" == -* ]]; then
  # Flag mode
  while [[ "$#" -gt 0 ]]; do
    case "$1" in
      --vmid)     VMID="$2"; shift 2 ;;
      --host)     HOSTNAME="$2"; shift 2 ;;
      --ip)       IP="$2"; shift 2 ;;
      --auto-ip)  AUTO_IP=true; shift 1 ;;
      --cores)    CORES="$2"; shift 2 ;;
      --mem)      MEM_MB="$2"; shift 2 ;;
      --swap)     SWAP_MB="$2"; shift 2 ;;
      --storage)  STORAGE="$2"; shift 2 ;;
      --bridge)   BRIDGE="$2"; shift 2 ;;
      --gateway)  GATEWAY="$2"; shift 2 ;;
      --tenant)   TENANT_ID="$2"; shift 2 ;;
      --help|-h)  die "See file header for usage." ;;
      *)          die "Unknown option: $1" ;;
    esac
  done
else
  # Positional: <vmid> <hostname> <last_octet>
  [[ "$#" -eq 3 ]] || die "Expected 3 args: <vmid> <hostname> <last_octet>"
  VMID="$1"
  HOSTNAME="$2"
  LAST_OCT="$3"
  [[ "$LAST_OCT" =~ ^[0-9]+$ ]] || die "Last octet must be numeric, got '$LAST_OCT'"
  (( LAST_OCT >= 1 && LAST_OCT <= 254 )) || die "Last octet must be 1–254, got '$LAST_OCT'"
  IP="${DEFAULT_NETWORK_PREFIX}.${LAST_OCT}"
fi

[[ -n "$VMID" ]] || die "VMID is required"
[[ -n "$HOSTNAME" ]] || die "Hostname is required"

ensure_dirs

if [[ "$AUTO_IP" == true ]]; then
  IP="$(next_free_ip)" || die "No free IPs available in range"
  log "Auto-allocated IP: ${IP}"
fi

[[ -n "$IP" ]] || die "IP is required (or use --auto-ip)"
[[ "$VMID" =~ ^[0-9]+$ ]] || die "VMID must be numeric, got '$VMID'"
is_ip "$IP" || die "Invalid IP address: '$IP'"

IP_CIDR="${IP}${DEFAULT_CIDR_SUFFIX}"

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
  die "Run this script as root on the Proxmox node."
fi

command -v pct   >/dev/null 2>&1 || die "'pct' command not found (Proxmox missing?)."
command -v pvesm >/dev/null 2>&1 || die "'pvesm' command not found."

if ! pct config "${TEMPLATE_VMID}" >/dev/null 2>&1; then
  die "Template CT ${TEMPLATE_VMID} not found. Create it first."
fi

if pct config "${VMID}" >/dev/null 2>&1; then
  die "VMID ${VMID} already exists. Choose another VMID."
fi

if ! pvesm status | awk 'NR>1 {print $1}' | grep -qx "${STORAGE}"; then
  die "Storage '${STORAGE}' not found in 'pvesm status'."
fi

if ping -c1 -W1 "${IP}" &>/dev/null; then
  die "IP ${IP} already responds to ping. Refusing to use it."
fi

########################################
# Provision
########################################
ip_mark_used "${IP}"

json_log "info" "Cloning template" \
  "\"vmid\":${VMID},\"hostname\":\"${HOSTNAME}\",\"storage\":\"${STORAGE}\""

log "Cloning template CT ${TEMPLATE_VMID} -> CT ${VMID} on '${STORAGE}'..."
pct clone "${TEMPLATE_VMID}" "${VMID}" \
  --hostname "${HOSTNAME}" \
  --full 1 \
  --storage "${STORAGE}"

log "Applying resources & network..."
pct set "${VMID}" \
  -net0 "name=eth0,bridge=${BRIDGE},ip=manual" \
  --memory "${MEM_MB}" \
  --swap "${SWAP_MB}" \
  --cores "${CORES}"

log "Starting CT ${VMID}..."
pct start "${VMID}"
sleep 5

json_log "info" "Configuring netplan" \
  "\"vmid\":${VMID},\"ip\":\"${IP_CIDR}\",\"gateway\":\"${GATEWAY}\""

pct exec "${VMID}" -- bash -lc "
  set -e
  if [[ ! -f '${NETPLAN_FILE}' ]]; then
    mkdir -p \$(dirname '${NETPLAN_FILE}')
    touch '${NETPLAN_FILE}'
  fi

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

log "Final IPv4 configuration for CT ${VMID}:"
pct exec "${VMID}" -- bash -lc 'hostname && ip -4 a show dev eth0 || ip -4 a'

json_log "info" "CloudPod created successfully" \
  "\"vmid\":${VMID},\"hostname\":\"${HOSTNAME}\",\"ip\":\"${IP_CIDR}\",\"tenant\":\"${TENANT_ID}\",\"cores\":${CORES},\"memory_mb\":${MEM_MB}"

# Output JSON for automation parsing
cat <<JSON_OUTPUT

### JSON_RESULT_START ###
{
  "success": true,
  "vmid": ${VMID},
  "hostname": "${HOSTNAME}",
  "tenant": "${TENANT_ID}",
  "ip": "${IP}",
  "ip_cidr": "${IP_CIDR}",
  "gateway": "${GATEWAY}",
  "storage": "${STORAGE}",
  "bridge": "${BRIDGE}",
  "cores": ${CORES},
  "memory_mb": ${MEM_MB},
  "swap_mb": ${SWAP_MB}
}
### JSON_RESULT_END ###

JSON_OUTPUT

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
echo "If SSH is enabled in the template, connect with:"
echo "  ssh root@${IP}"
echo "============================================================"

exit 0
