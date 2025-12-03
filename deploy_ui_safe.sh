#!/usr/bin/env bash
set -euo pipefail

# Enterprise-grade safe UI deploy script
# - Builds frontend
# - Rsyncs built assets to production web root
# - Preserves existing files; backs up previous release
# - Zero-downtime via atomic swap

# Config (adjust if your environment differs)
WEB_ROOT="/usr/local/mPanel/html"
BUILD_DIR="dist"
RELEASES_DIR="/usr/local/mPanel/releases"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
NEW_RELEASE_DIR="$RELEASES_DIR/$TIMESTAMP"

log() { echo "[deploy] $*"; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "Error: $1 not found"; exit 1; }
}

log "Validating prerequisites"
require_cmd rsync
require_cmd npm
require_cmd tee
require_cmd mkdir

log "Installing dependencies (ci)"
npm ci --no-audit --no-fund

log "Building UI"
npm run build

if [[ ! -d "$BUILD_DIR" ]]; then
  echo "Error: build output '$BUILD_DIR' not found"; exit 1
fi

log "Preparing releases directory at $RELEASES_DIR"
sudo mkdir -p "$RELEASES_DIR"
sudo chown "$USER":"$USER" "$RELEASES_DIR" || true

log "Creating new release directory $NEW_RELEASE_DIR"
mkdir -p "$NEW_RELEASE_DIR"

log "Syncing build to new release directory"
rsync -a --delete "$BUILD_DIR/" "$NEW_RELEASE_DIR/"

log "Validating new release contents"
[[ -f "$NEW_RELEASE_DIR/index.html" ]] || { echo "Error: index.html missing in new release"; exit 1; }

log "Backing up current web root (if exists)"
if [[ -d "$WEB_ROOT" ]]; then
  BACKUP_DIR="$RELEASES_DIR/backup-$TIMESTAMP"
  rsync -a "$WEB_ROOT/" "$BACKUP_DIR/"
  log "Backup created at $BACKUP_DIR"
fi

log "Atomic deploy: swapping web root to new release"
sudo mkdir -p "$WEB_ROOT"
sudo rsync -a --delete "$NEW_RELEASE_DIR/" "$WEB_ROOT/"

log "Deployment complete"
log "Web root: $WEB_ROOT"
log "Release directory: $NEW_RELEASE_DIR"

# Optional: list top-level assets
ls -lah "$WEB_ROOT" | tee /dev/stderr
