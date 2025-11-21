#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$REPO_ROOT/dist"
REMOTE="mhadmin@10.1.10.50"
REMOTE_DIR="/srv/web/core/migrapanel.com/public"

if [[ ! -d "$BUILD_DIR" ]]; then
  echo "[deploy] Build directory '$BUILD_DIR' not found. Run 'npm run build' first." >&2
  exit 1
fi

if [[ -z "$(ls -A "$BUILD_DIR")" ]]; then
  echo "[deploy] Warning: '$BUILD_DIR' is empty. Did you run 'npm run build'?"
fi

echo "[deploy] Starting deploy to $REMOTE:$REMOTE_DIR"
rsync -az --delete "$BUILD_DIR/" "$REMOTE:$REMOTE_DIR/"

echo "[deploy] Deploy completed successfully."
