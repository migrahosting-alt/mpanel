#!/bin/bash

# ============================================
# Generate Secure Environment Variables
# ============================================
# This script generates secure random values for production
# Run: bash generate-secrets.sh
# ============================================

echo "🔐 Generating secure secrets for mPanel production..."
echo ""

# JWT Secret (64 characters)
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
echo "JWT_SECRET=$JWT_SECRET"
echo ""

# Encryption Key (32 characters exactly)
ENCRYPTION_KEY=$(openssl rand -base64 32 | head -c 32)
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"
echo ""

# API Token (64 characters hex)
API_TOKEN=$(openssl rand -hex 32)
echo "MPANEL_API_TOKEN=$API_TOKEN"
echo ""

# Session Secret
SESSION_SECRET=$(openssl rand -base64 64 | tr -d '\n')
echo "SESSION_SECRET=$SESSION_SECRET"
echo ""

# Grafana Admin Password
GRAFANA_PASSWORD=$(openssl rand -base64 24 | tr -d '\n')
echo "GRAFANA_ADMIN_PASSWORD=$GRAFANA_PASSWORD"
echo ""

# MinIO Access Key & Secret
MINIO_ACCESS=$(openssl rand -hex 16)
MINIO_SECRET=$(openssl rand -hex 32)
echo "MINIO_ACCESS_KEY=$MINIO_ACCESS"
echo "MINIO_SECRET_KEY=$MINIO_SECRET"
echo ""

# Database Password
DB_PASSWORD=$(openssl rand -base64 24 | tr -d '\n')
echo "DB_PASSWORD=$DB_PASSWORD"
echo ""

echo "✅ All secrets generated!"
echo ""
echo "⚠️  IMPORTANT: Save these values securely and add them to your .env file"
echo "⚠️  NEVER commit these values to git!"
echo ""
