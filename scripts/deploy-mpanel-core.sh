#!/usr/bin/env bash
set -euo pipefail

##
# mPanel Deploy Script
#
# Source of truth:
# - Server: mpanel-core (Tailscale → 100.97.213.11, LAN → 10.1.10.206)
# - Remote path: /opt/mpanel
# - Purpose: sync code + install deps + run migrations + restart API/queues/tenant-billing
#
# Requirements:
# - SSH config has:
#     Host mpanel-core
#         HostName 100.97.213.11
#         User root
#         Port 22
# - This script lives in: mpanel/scripts/deploy-mpanel-core.sh
#
# COPILOT RULES:
# - Do NOT deploy mPanel to srv1-web
# - Do NOT deploy marketing site to mpanel-core
# - Use SSH alias: ssh mpanel-core
# - Remote path: /opt/mpanel
##

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[mpanel-core] Building locally (if needed)..."
cd "$REPO_ROOT"

# If you build locally, uncomment:
# npm install
# npm run build

echo "[mpanel-core] Rsyncing repo to /opt/mpanel on server..."
rsync -avz --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.env*' \
  "$REPO_ROOT/" mpanel-core:/opt/mpanel/

echo "[mpanel-core] Running remote install + migrations + restart..."
ssh mpanel-core bash << 'EOF'
  set -euo pipefail
  cd /opt/mpanel

  echo "[mpanel-core] Installing dependencies..."
  # Adjust if using pnpm/yarn/etc.
  npm install --omit=dev

  echo "[mpanel-core] Running database migrations (if applicable)..."
  # Example – adjust to your actual migration command:
  # npx prisma migrate deploy || echo "[WARN] prisma migrate deploy failed, check manually"

  echo "[mpanel-core] Restarting services..."
  # Adjust process names to your actual pm2 apps:
  if command -v pm2 >/dev/null 2>&1; then
    pm2 reload all || pm2 restart all || echo "[WARN] pm2 restart failed, check manually"
    pm2 save || true
  else
    echo "[WARN] pm2 not found; if using systemd, restart units here:"
    # systemctl restart mpanel-api.service
    # systemctl restart mpanel-queues.service
    # systemctl restart tenant-billing.service
  fi

  echo "[mpanel-core] Deploy complete."
EOF

echo "[local] Done. mPanel should now be updated on mpanel-core."
