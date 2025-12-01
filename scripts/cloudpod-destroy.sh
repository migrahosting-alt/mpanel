#!/usr/bin/env bash
#
# cloudpod-destroy.sh (v1 – enterprise edition)
#
# Safely destroy a CloudPod:
#  - Stops the CT
#  - Optionally takes a final backup (--backup flag)
#  - Destroys it
#  - Releases IP from IPAM
#  - Writes JSON audit log
#
# Usage:
#   cloudpod-destroy.sh <vmid>
#   cloudpod-destroy.sh --vmid <vmid> [--tenant <tenant_id>] [--force] [--backup]
#

set -o errexit
set -o nounset
set -o pipefail

########################################
# CONFIG
########################################
IPAM_FILE="/etc/migra/ipam-cloudpods.txt"
LOG_FILE="/var/log/migra-cloudpods.log"
BACKUP_SCRIPT="/usr/local/sbin/cloudpod-backup.sh"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

########################################
# Helpers
########################################
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
  mkdir -p "$(dirname "${LOG_FILE}")"
  local base="{\"ts\":\"${ts}\",\"level\":\"${level}\",\"message\":\"${message//\"/\\\"}\""
  if [[ -n "$extra" ]]; then
    echo "${base},${extra}}" >> "${LOG_FILE}"
  else
    echo "${base}}" >> "${LOG_FILE}"
  fi
}

ip_release() {
  local ip="$1"
  if [[ -f "${IPAM_FILE}" ]]; then
    grep -vx "$ip" "${IPAM_FILE}" > "${IPAM_FILE}.tmp" 2>/dev/null || true
    mv "${IPAM_FILE}.tmp" "${IPAM_FILE}" 2>/dev/null || true
  fi
}

########################################
# Arg parsing
########################################
VMID=""
TENANT_ID="unknown"
FORCE=false
DO_BACKUP=false

if [[ "$#" -eq 0 ]]; then
  die "Usage: $0 <vmid> OR --vmid <vmid> [--tenant <id>] [--force] [--backup]"
fi

if [[ "$1" == -* ]]; then
  # Flag mode
  while [[ "$#" -gt 0 ]]; do
    case "$1" in
      --vmid)    VMID="$2"; shift 2 ;;
      --tenant)  TENANT_ID="$2"; shift 2 ;;
      --force)   FORCE=true; shift 1 ;;
      --backup)  DO_BACKUP=true; shift 1 ;;
      --help|-h) die "Usage: $0 <vmid> OR --vmid <vmid> [--tenant <id>] [--force] [--backup]" ;;
      *)         die "Unknown option: $1" ;;
    esac
  done
else
  # Positional: just vmid
  VMID="$1"
fi

[[ -n "$VMID" ]] || die "VMID is required"
[[ "$VMID" =~ ^[0-9]+$ ]] || die "VMID must be numeric"

########################################
# Safety checks
########################################
if [[ "${EUID}" -ne 0 ]]; then
  die "Run as root on Proxmox node."
fi

command -v pct >/dev/null 2>&1 || die "'pct' command not found"

if ! pct config "${VMID}" >/dev/null 2>&1; then
  die "CT ${VMID} does not exist."
fi

# Protect the template
if [[ "${VMID}" == "9000" ]]; then
  die "Cannot destroy the golden template CT 9000!"
fi

########################################
# Get CT info before destroying
########################################
HOSTNAME="$(pct config "${VMID}" | awk '/^hostname:/ {print $2}' || echo 'unknown')"
CT_STATUS="$(pct status "${VMID}" | awk '{print $2}' || echo 'unknown')"

# Try to get IP from inside CT if running
IPV4=""
if [[ "${CT_STATUS}" == "running" ]]; then
  IPV4="$(pct exec "${VMID}" -- bash -lc 'ip -4 -o a show dev eth0 2>/dev/null | awk "{print \$4}" | cut -d/ -f1' 2>/dev/null || true)"
fi

# If we couldn't get IP from inside, try to parse from config
if [[ -z "${IPV4}" ]]; then
  NET_CONFIG="$(pct config "${VMID}" | grep '^net0:' || true)"
  if [[ -n "${NET_CONFIG}" ]]; then
    IPV4="$(echo "${NET_CONFIG}" | grep -oP 'ip=\K[0-9.]+' || true)"
  fi
fi

log "Preparing to destroy CloudPod:"
log "  VMID     : ${VMID}"
log "  Hostname : ${HOSTNAME}"
log "  Status   : ${CT_STATUS}"
log "  IPv4     : ${IPV4:-unknown}"
log "  Tenant   : ${TENANT_ID}"

json_log "info" "CloudPod destroy requested" \
  "\"vmid\":${VMID},\"hostname\":\"${HOSTNAME}\",\"ip\":\"${IPV4:-unknown}\",\"tenant\":\"${TENANT_ID}\""

########################################
# Confirmation (unless --force)
########################################
if [[ "$FORCE" != true ]]; then
  echo ""
  echo "⚠️  WARNING: This will permanently destroy CT ${VMID} (${HOSTNAME})"
  echo "    All data will be lost!"
  echo ""
  read -p "Type 'yes' to confirm destruction: " CONFIRM
  if [[ "${CONFIRM}" != "yes" ]]; then
    log "Destruction cancelled by user"
    json_log "info" "CloudPod destroy cancelled" "\"vmid\":${VMID}"
    exit 1
  fi
fi

########################################
# Stop the container
########################################
log "Stopping CT ${VMID}..."
if [[ "${CT_STATUS}" == "running" ]]; then
  pct shutdown "${VMID}" --forceStop 1 --timeout 60 2>/dev/null || \
  pct stop "${VMID}" 2>/dev/null || \
  true
  sleep 2
fi

########################################
# Optional final backup
########################################
if [[ "$DO_BACKUP" == true ]]; then
  log "Creating final backup before destruction..."
  
  # Find the backup script (check multiple locations)
  BACKUP_CMD=""
  if [[ -x "${BACKUP_SCRIPT}" ]]; then
    BACKUP_CMD="${BACKUP_SCRIPT}"
  elif [[ -x "${SCRIPT_DIR}/cloudpod-backup.sh" ]]; then
    BACKUP_CMD="${SCRIPT_DIR}/cloudpod-backup.sh"
  elif [[ -x "/usr/local/sbin/cloudpod-backup.sh" ]]; then
    BACKUP_CMD="/usr/local/sbin/cloudpod-backup.sh"
  fi
  
  if [[ -n "${BACKUP_CMD}" ]]; then
    # Start the CT briefly if needed for snapshot backup
    if [[ "${CT_STATUS}" == "running" ]]; then
      log "Starting CT ${VMID} temporarily for backup..."
      pct start "${VMID}" 2>/dev/null || true
      sleep 3
    fi
    
    if "${BACKUP_CMD}" --vmid "${VMID}" --mode snapshot --tenant "${TENANT_ID}" --note "Final backup before destruction" --quiet; then
      log "Final backup completed successfully"
      json_log "info" "Final backup before destruction completed" \
        "\"vmid\":${VMID},\"tenant\":\"${TENANT_ID}\""
    else
      err "Warning: Final backup failed, but continuing with destruction"
      json_log "warn" "Final backup before destruction failed" \
        "\"vmid\":${VMID},\"tenant\":\"${TENANT_ID}\""
    fi
    
    # Stop again after backup
    pct shutdown "${VMID}" --forceStop 1 --timeout 30 2>/dev/null || \
    pct stop "${VMID}" 2>/dev/null || \
    true
    sleep 2
  else
    err "Warning: Backup script not found, skipping final backup"
    json_log "warn" "Backup script not found, skipping final backup" \
      "\"vmid\":${VMID},\"tenant\":\"${TENANT_ID}\""
  fi
fi

########################################
# Destroy the container
########################################
log "Destroying CT ${VMID}..."
pct destroy "${VMID}" --destroy-unreferenced-disks 1

########################################
# Release IP from IPAM
########################################
if [[ -n "${IPV4}" ]]; then
  log "Releasing IP ${IPV4} from IPAM..."
  ip_release "${IPV4}"
fi

########################################
# Log success
########################################
json_log "info" "CloudPod destroyed successfully" \
  "\"vmid\":${VMID},\"hostname\":\"${HOSTNAME}\",\"ip\":\"${IPV4:-unknown}\",\"tenant\":\"${TENANT_ID}\""

# Output JSON for automation parsing
cat <<JSON_OUTPUT

### JSON_RESULT_START ###
{
  "success": true,
  "action": "destroy",
  "vmid": ${VMID},
  "hostname": "${HOSTNAME}",
  "ip": "${IPV4:-null}",
  "tenant": "${TENANT_ID}"
}
### JSON_RESULT_END ###

JSON_OUTPUT

echo "============================================================"
echo " CloudPod destroyed"
echo
echo "  VMID     : ${VMID}"
echo "  Hostname : ${HOSTNAME}"
echo "  IP       : ${IPV4:-unknown} (released from IPAM)"
echo "  Tenant   : ${TENANT_ID}"
echo "============================================================"

exit 0
