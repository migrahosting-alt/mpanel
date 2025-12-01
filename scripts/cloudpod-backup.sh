#!/usr/bin/env bash
#
# cloudpod-backup.sh (v1 – enterprise edition)
#
# Create backups for CloudPods using vzdump.
#
# Features:
#   - Snapshot, suspend, or stop mode backups
#   - Configurable storage destination
#   - JSON audit logging
#   - Optional notes/reason for backup
#   - Compression with zstd
#
# Usage:
#   cloudpod-backup.sh <vmid>
#   cloudpod-backup.sh --vmid <vmid> [--mode snapshot|suspend|stop] [--note "reason"]
#                      [--storage <storage>] [--tenant <tenant_id>]
#
# Examples:
#   cloudpod-backup.sh 9101
#   cloudpod-backup.sh --vmid 9101 --mode snapshot --note "Pre-destruction backup"
#   cloudpod-backup.sh --vmid 9101 --mode suspend --storage t7-backup --tenant TENANT-123
#

set -o errexit
set -o nounset
set -o pipefail

########################################
# CONFIG
########################################
LOG_FILE="/var/log/migra-cloudpods.log"
DEFAULT_BACKUP_STORAGE="vzdump-backups"
DEFAULT_MODE="snapshot"
DEFAULT_COMPRESS="zstd"

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
  local esc_message="${message//\"/\\\"}"
  local base="{\"ts\":\"${ts}\",\"level\":\"${level}\",\"message\":\"${esc_message}\""
  if [[ -n "$extra" ]]; then
    echo "${base},${extra}}" >> "${LOG_FILE}"
  else
    echo "${base}}" >> "${LOG_FILE}"
  fi
}

########################################
# Arg parsing
########################################
VMID=""
MODE="$DEFAULT_MODE"
STORAGE="$DEFAULT_BACKUP_STORAGE"
NOTE=""
TENANT_ID="unknown"
QUIET=false

if [[ "$#" -eq 0 ]]; then
  die "Usage: $0 <vmid> OR --vmid <vmid> [--mode snapshot|suspend|stop] [--note \"reason\"] [--storage <name>] [--tenant <id>]"
fi

if [[ "$1" == -* ]]; then
  # Flag mode
  while [[ "$#" -gt 0 ]]; do
    case "$1" in
      --vmid)    VMID="$2"; shift 2 ;;
      --mode)    MODE="$2"; shift 2 ;;
      --storage) STORAGE="$2"; shift 2 ;;
      --note)    NOTE="$2"; shift 2 ;;
      --tenant)  TENANT_ID="$2"; shift 2 ;;
      --quiet)   QUIET=true; shift 1 ;;
      --help|-h) die "Usage: $0 <vmid> OR --vmid <vmid> [--mode snapshot|suspend|stop] [--note \"reason\"] [--storage <name>] [--tenant <id>]" ;;
      *)         die "Unknown option: $1" ;;
    esac
  done
else
  # Positional: just vmid
  VMID="$1"
fi

[[ -n "$VMID" ]] || die "VMID is required"
[[ "$VMID" =~ ^[0-9]+$ ]] || die "VMID must be numeric"

# Validate mode
case "$MODE" in
  snapshot|suspend|stop) ;;
  *) die "Invalid mode: $MODE (must be snapshot, suspend, or stop)" ;;
esac

########################################
# Safety checks
########################################
if [[ "${EUID}" -ne 0 ]]; then
  die "Run as root on Proxmox node."
fi

command -v vzdump >/dev/null 2>&1 || die "'vzdump' command not found"
command -v pct >/dev/null 2>&1 || die "'pct' command not found"

if ! pct config "${VMID}" >/dev/null 2>&1; then
  die "CT ${VMID} does not exist."
fi

# Verify storage exists
if ! pvesm status 2>/dev/null | awk 'NR>1 {print $1}' | grep -qx "${STORAGE}"; then
  err "Warning: Storage '${STORAGE}' may not exist. Attempting backup anyway..."
fi

########################################
# Get CT info
########################################
HOSTNAME="$(pct config "${VMID}" | awk '/^hostname:/ {print $2}' || echo 'unknown')"
CT_STATUS="$(pct status "${VMID}" | awk '{print $2}' || echo 'unknown')"

if [[ "$QUIET" != true ]]; then
  log "CloudPod backup requested:"
  log "  VMID     : ${VMID}"
  log "  Hostname : ${HOSTNAME}"
  log "  Status   : ${CT_STATUS}"
  log "  Mode     : ${MODE}"
  log "  Storage  : ${STORAGE}"
  log "  Tenant   : ${TENANT_ID}"
  [[ -n "$NOTE" ]] && log "  Note     : ${NOTE}"
fi

json_log "info" "CloudPod backup requested" \
  "\"vmid\":${VMID},\"hostname\":\"${HOSTNAME}\",\"mode\":\"${MODE}\",\"storage\":\"${STORAGE}\",\"tenant\":\"${TENANT_ID}\",\"note\":\"${NOTE//\"/\\\"}\""

########################################
# Perform backup
########################################
BACKUP_START="$(date +%s)"

log "Starting backup of CT ${VMID} (mode=${MODE})..."

# Build vzdump command
VZDUMP_CMD=(
  vzdump "${VMID}"
  --mode "${MODE}"
  --storage "${STORAGE}"
  --compress "${DEFAULT_COMPRESS}"
  --notes-template "{{hostname}} - ${NOTE:-Automated backup}"
)

# Add quiet flag if requested
if [[ "$QUIET" == true ]]; then
  VZDUMP_CMD+=(--quiet 1)
fi

# Execute backup
if "${VZDUMP_CMD[@]}"; then
  BACKUP_END="$(date +%s)"
  BACKUP_DURATION=$((BACKUP_END - BACKUP_START))
  
  json_log "info" "CloudPod backup completed successfully" \
    "\"vmid\":${VMID},\"hostname\":\"${HOSTNAME}\",\"mode\":\"${MODE}\",\"storage\":\"${STORAGE}\",\"tenant\":\"${TENANT_ID}\",\"duration_seconds\":${BACKUP_DURATION}"
  
  # Find the backup file that was just created
  BACKUP_FILE=""
  if command -v pvesm >/dev/null 2>&1; then
    # Try to find the most recent backup for this VMID
    BACKUP_FILE="$(pvesm list "${STORAGE}" 2>/dev/null | grep "vzdump-lxc-${VMID}-" | tail -1 | awk '{print $1}' || true)"
  fi

  # Output JSON for automation parsing
  cat <<JSON_OUTPUT

### JSON_RESULT_START ###
{
  "success": true,
  "action": "backup",
  "vmid": ${VMID},
  "hostname": "${HOSTNAME}",
  "mode": "${MODE}",
  "storage": "${STORAGE}",
  "tenant": "${TENANT_ID}",
  "duration_seconds": ${BACKUP_DURATION},
  "backup_file": "${BACKUP_FILE:-null}",
  "note": "${NOTE:-null}"
}
### JSON_RESULT_END ###

JSON_OUTPUT

  if [[ "$QUIET" != true ]]; then
    echo "============================================================"
    echo " CloudPod backup completed"
    echo
    echo "  VMID     : ${VMID}"
    echo "  Hostname : ${HOSTNAME}"
    echo "  Mode     : ${MODE}"
    echo "  Storage  : ${STORAGE}"
    echo "  Duration : ${BACKUP_DURATION} seconds"
    [[ -n "$BACKUP_FILE" ]] && echo "  File     : ${BACKUP_FILE}"
    echo "============================================================"
  fi

  exit 0
else
  BACKUP_END="$(date +%s)"
  BACKUP_DURATION=$((BACKUP_END - BACKUP_START))
  
  json_log "error" "CloudPod backup failed" \
    "\"vmid\":${VMID},\"hostname\":\"${HOSTNAME}\",\"mode\":\"${MODE}\",\"storage\":\"${STORAGE}\",\"tenant\":\"${TENANT_ID}\",\"duration_seconds\":${BACKUP_DURATION}"

  # Output JSON for automation parsing
  cat <<JSON_OUTPUT

### JSON_RESULT_START ###
{
  "success": false,
  "action": "backup",
  "vmid": ${VMID},
  "hostname": "${HOSTNAME}",
  "mode": "${MODE}",
  "storage": "${STORAGE}",
  "tenant": "${TENANT_ID}",
  "duration_seconds": ${BACKUP_DURATION},
  "error": "Backup failed"
}
### JSON_RESULT_END ###

JSON_OUTPUT

  die "Backup of CT ${VMID} failed!"
fi
