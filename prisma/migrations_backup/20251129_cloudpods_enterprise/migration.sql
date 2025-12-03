-- Migration: CloudPods Enterprise Features
-- Date: 2025-11-29
-- Description: Adds enterprise-grade CloudPods features:
--   - Audit Log
--   - Security Groups
--   - Health Monitoring
--   - Usage Metering
--   - Backup Policies
--   - Webhooks

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- AUDIT LOG
-- ============================================

CREATE TABLE IF NOT EXISTS cloud_pod_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    user_id UUID,
    pod_id UUID,
    vmid INTEGER,
    action VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cloud_pod_audit_tenant_pod ON cloud_pod_audit(tenant_id, pod_id);
CREATE INDEX IF NOT EXISTS idx_cloud_pod_audit_tenant_created ON cloud_pod_audit(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cloud_pod_audit_action ON cloud_pod_audit(action);
CREATE INDEX IF NOT EXISTS idx_cloud_pod_audit_category ON cloud_pod_audit(category);
CREATE INDEX IF NOT EXISTS idx_cloud_pod_audit_created ON cloud_pod_audit(created_at);

-- ============================================
-- SECURITY GROUPS
-- ============================================

CREATE TABLE IF NOT EXISTS cloud_pod_security_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE TABLE IF NOT EXISTS cloud_pod_security_group_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    security_group_id UUID NOT NULL REFERENCES cloud_pod_security_groups(id) ON DELETE CASCADE,
    direction VARCHAR(10) NOT NULL, -- ingress | egress
    protocol VARCHAR(10) NOT NULL,  -- tcp | udp | icmp | any
    port_range VARCHAR(20) NOT NULL, -- "22", "80-443", "*"
    cidr VARCHAR(50) NOT NULL,      -- "0.0.0.0/0", "10.1.10.0/24"
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cloud_pod_security_group_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pod_id UUID NOT NULL,
    security_group_id UUID NOT NULL REFERENCES cloud_pod_security_groups(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pod_id, security_group_id)
);

-- ============================================
-- HEALTH MONITORING
-- ============================================

CREATE TABLE IF NOT EXISTS cloud_pod_health_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pod_id UUID UNIQUE NOT NULL,
    last_status VARCHAR(20) NOT NULL, -- healthy | unhealthy | unknown
    last_checked_at TIMESTAMPTZ NOT NULL,
    last_error TEXT,
    consecutive_failures INTEGER DEFAULT 0
);

-- ============================================
-- USAGE METERING
-- ============================================

CREATE TABLE IF NOT EXISTS cloud_pod_usage_samples (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    pod_id UUID NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    cpu_pct DOUBLE PRECISION NOT NULL,
    memory_mb INTEGER NOT NULL,
    disk_gb DOUBLE PRECISION NOT NULL,
    net_in_mb DOUBLE PRECISION NOT NULL,
    net_out_mb DOUBLE PRECISION NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cloud_pod_usage_samples_tenant_pod_ts ON cloud_pod_usage_samples(tenant_id, pod_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_cloud_pod_usage_samples_pod_ts ON cloud_pod_usage_samples(pod_id, timestamp);

CREATE TABLE IF NOT EXISTS cloud_pod_usage_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    pod_id UUID NOT NULL,
    date DATE NOT NULL,
    avg_cpu_pct DOUBLE PRECISION NOT NULL,
    max_cpu_pct DOUBLE PRECISION NOT NULL,
    avg_memory_mb INTEGER NOT NULL,
    max_memory_mb INTEGER NOT NULL,
    disk_gb DOUBLE PRECISION NOT NULL,
    total_net_in_mb DOUBLE PRECISION NOT NULL,
    total_net_out_mb DOUBLE PRECISION NOT NULL,
    UNIQUE(tenant_id, pod_id, date)
);

CREATE INDEX IF NOT EXISTS idx_cloud_pod_usage_daily_tenant_date ON cloud_pod_usage_daily(tenant_id, date);

-- ============================================
-- BACKUP POLICIES & BACKUPS
-- ============================================

CREATE TABLE IF NOT EXISTS cloud_pod_backup_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID,
    pod_id UUID,
    name VARCHAR(100) NOT NULL,
    schedule VARCHAR(100) NOT NULL, -- cron or "daily" | "weekly" | "hourly"
    retention_count INTEGER DEFAULT 7,
    type VARCHAR(20) NOT NULL,      -- snapshot | full-backup
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cloud_pod_backup_policies_tenant ON cloud_pod_backup_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cloud_pod_backup_policies_pod ON cloud_pod_backup_policies(pod_id);

CREATE TABLE IF NOT EXISTS cloud_pod_backups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pod_id UUID NOT NULL,
    policy_id UUID REFERENCES cloud_pod_backup_policies(id),
    backup_type VARCHAR(20) NOT NULL, -- snapshot | full-backup
    location VARCHAR(500) NOT NULL,   -- Proxmox snapshot name or backup path
    status VARCHAR(20) NOT NULL,      -- pending | running | completed | failed
    size_gb DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_cloud_pod_backups_pod_created ON cloud_pod_backups(pod_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cloud_pod_backups_status ON cloud_pod_backups(status);

-- ============================================
-- WEBHOOKS
-- ============================================

CREATE TABLE IF NOT EXISTS cloud_pod_webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    url VARCHAR(2048) NOT NULL,
    secret VARCHAR(256) NOT NULL,
    events JSONB NOT NULL,           -- string[] of subscribed events
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cloud_pod_webhooks_tenant_active ON cloud_pod_webhooks(tenant_id, is_active);

CREATE TABLE IF NOT EXISTS cloud_pod_webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id UUID NOT NULL REFERENCES cloud_pod_webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(30) NOT NULL,     -- pending | delivered | failed | permanently_failed
    http_status INTEGER,
    error_message TEXT,
    attempts INTEGER DEFAULT 0,
    next_retry_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cloud_pod_webhook_deliveries_status_retry ON cloud_pod_webhook_deliveries(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_cloud_pod_webhook_deliveries_webhook_created ON cloud_pod_webhook_deliveries(webhook_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cloud_pod_webhook_deliveries_event_type ON cloud_pod_webhook_deliveries(event_type);

-- Done!
SELECT 'CloudPods Enterprise migration completed successfully!' as status;
