#!/bin/bash
# ============================================================================
# Setup Proxmox API User for mPanel Cloud Pod Provisioning
#
# Run this script on the Proxmox VE server (pve - 10.1.10.70)
#
# This creates:
#   - User: mpanel-api@pve
#   - Role: CloudPodsProv with required permissions
#   - API Token: mpanel-api@pve!mpanel-token
# ============================================================================

set -e

echo ""
echo "=========================================="
echo "  Proxmox API Setup for mPanel"
echo "=========================================="
echo ""

# 1. Create custom role with minimal permissions for Cloud Pod provisioning
echo "📋 Creating CloudPodsProv role..."
pveum role add CloudPodsProv \
  -privs "VM.Audit,VM.Allocate,VM.Clone,VM.Config.CPU,VM.Config.Disk,VM.Config.Memory,VM.Config.Network,VM.Config.Options,VM.PowerMgmt,Datastore.AllocateSpace,Datastore.Audit,Sys.Audit" \
  2>/dev/null || echo "   Role already exists or error (continuing)"

# 2. Create API user
echo "👤 Creating mpanel-api@pve user..."
pveum user add mpanel-api@pve \
  -comment "mPanel API user for Cloud Pod provisioning" \
  -enable 1 \
  2>/dev/null || echo "   User already exists or error (continuing)"

# 3. Assign role to user at root level (access to all resources)
echo "🔑 Assigning CloudPodsProv role to user..."
pveum acl modify / \
  -user mpanel-api@pve \
  -role CloudPodsProv \
  2>/dev/null || echo "   ACL already set or error (continuing)"

# 4. Create API token
echo "🎟️  Creating API token..."
TOKEN_SECRET=$(pveum user token add mpanel-api@pve mpanel-token --privsep 0 2>/dev/null | grep "value" | awk '{print $2}')

if [ -n "$TOKEN_SECRET" ]; then
  echo ""
  echo "✅ API Token Created Successfully!"
  echo ""
  echo "=========================================="
  echo "  Add these to mPanel .env:"
  echo "=========================================="
  echo ""
  echo "PROXMOX_API_URL=https://10.1.10.70:8006/api2/json"
  echo "PROXMOX_API_TOKEN_ID=mpanel-api@pve!mpanel-token"
  echo "PROXMOX_API_TOKEN_SECRET=$TOKEN_SECRET"
  echo "PROXMOX_NODE_NAME=pve"
  echo "PROXMOX_CLOUDPOD_TEMPLATE_ID=9000"
  echo "PROXMOX_CLOUDPOD_STORAGE=local-lvm"
  echo "PROXMOX_CLOUDPOD_BRIDGE=vmbr0"
  echo ""
  echo "=========================================="
  echo ""
  echo "⚠️  IMPORTANT: Save the token secret now!"
  echo "   It cannot be retrieved again."
  echo ""
else
  echo ""
  echo "⚠️  Token may already exist. To regenerate:"
  echo "   pveum user token remove mpanel-api@pve mpanel-token"
  echo "   pveum user token add mpanel-api@pve mpanel-token --privsep 0"
  echo ""
  
  # Try to list existing token info
  echo "Checking existing token..."
  pveum user token list mpanel-api@pve 2>/dev/null || true
fi

# 5. Verify setup
echo ""
echo "📊 Verification:"
echo ""
echo "User info:"
pveum user list | grep mpanel-api || true
echo ""
echo "Role permissions:"
pveum role list | grep CloudPodsProv || true
echo ""
echo "ACL assignments:"
pveum acl list | grep mpanel-api || true

echo ""
echo "✅ Setup complete!"
echo ""
