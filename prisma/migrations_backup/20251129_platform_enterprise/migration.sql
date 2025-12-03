-- Migration: Platform Enterprise Core
-- Date: 2025-11-29
-- Description: Adds enterprise platform features:
--   - System Settings (global config)
--   - Job Engine (worker orchestration)
--   - Cloud Resource Plans & Subscriptions
--   - Cloud Pod Templates v2
--   - Cloud Pod Volumes
--   - Cloud Pod DNS Records
--   - Cloud Pod Lifecycle Hooks
--   - System Events (logging)

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SYSTEM SETTINGS
-- ============================================

CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    namespace VARCHAR(100) NOT NULL,
    key VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    value_type VARCHAR(20) DEFAULT 'string',
    updated_by UUID,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(namespace, key)
);

-- Insert default CloudPods settings
INSERT INTO system_settings (namespace, key, value, value_type) VALUES
    ('cloudpods', 'auto_heal.enabled', 'true', 'boolean'),
    ('cloudpods', 'auto_heal.failure_threshold', '3', 'number'),
    ('cloudpods', 'backup.default_retention_count', '7', 'number'),
    ('cloudpods', 'metrics.sample_interval_seconds', '300', 'number'),
    ('cloudpods', 'audit.retention_days', '180', 'number'),
    ('cloudpods', 'webhooks.max_attempts', '8', 'number'),
    ('cloudpods', 'webhooks.initial_retry_delay_seconds', '60', 'number'),
    ('platform', 'timezone', 'UTC', 'string'),
    ('platform', 'brand_name', 'MigraCloud', 'string'),
    ('platform', 'primary_color', '#3B82F6', 'string'),
    ('billing', 'default_currency', 'USD', 'string'),
    ('billing', 'default_tax_rate', '0', 'number')
ON CONFLICT (namespace, key) DO NOTHING;

-- ============================================
-- PLATFORM JOBS (Worker Orchestration)
-- ============================================

CREATE TABLE IF NOT EXISTS platform_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    queue VARCHAR(50) NOT NULL,
    type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending',
    priority INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_jobs_queue_status_scheduled ON platform_jobs(queue, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_platform_jobs_status ON platform_jobs(status);
CREATE INDEX IF NOT EXISTS idx_platform_jobs_type ON platform_jobs(type);

CREATE TABLE IF NOT EXISTS job_workers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    queue VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'online',
    last_heartbeat_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_workers_queue_status ON job_workers(queue, status);

-- ============================================
-- SYSTEM EVENTS (Logging)
-- ============================================

CREATE TABLE IF NOT EXISTS system_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service VARCHAR(100) NOT NULL,
    level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    context JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_events_service_level ON system_events(service, level);
CREATE INDEX IF NOT EXISTS idx_system_events_created ON system_events(created_at);

-- ============================================
-- CLOUD RESOURCE PLANS
-- ============================================

CREATE TABLE IF NOT EXISTS cloud_resource_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    cpu_cores INTEGER NOT NULL,
    memory_mb INTEGER NOT NULL,
    disk_gb INTEGER NOT NULL,
    bandwidth_gb INTEGER,
    price_monthly DECIMAL(10, 2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert CloudPods plans (FINAL APPROVED PRICES - no shared hosting)
INSERT INTO cloud_resource_plans (code, name, description, cpu_cores, memory_mb, disk_gb, bandwidth_gb, price_monthly) VALUES
    ('cloudpods-student', 'Student', 'Free dev/testing CloudPod for students and labs.', 1, 1024, 2, 50, 0.00),
    ('cloudpods-starter', 'Starter', 'Entry-level CloudPod for small apps and dev stacks.', 1, 1024, 30, NULL, 1.49),
    ('cloudpods-premium', 'Premium', 'More power for production workloads and growing apps.', 2, 2048, 75, NULL, 2.49),
    ('cloudpods-business', 'Business', 'High value CloudPod for agencies and small businesses.', 3, 4096, 100, NULL, 3.99)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS cloud_tenant_resource_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    plan_id UUID NOT NULL REFERENCES cloud_resource_plans(id),
    quantity INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'active',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cloud_tenant_resource_subs_tenant ON cloud_tenant_resource_subscriptions(tenant_id, status);

CREATE TABLE IF NOT EXISTS cloud_tenant_resource_totals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID UNIQUE NOT NULL,
    cpu_cores_total INTEGER DEFAULT 0,
    memory_mb_total INTEGER DEFAULT 0,
    disk_gb_total INTEGER DEFAULT 0,
    bandwidth_gb_total INTEGER,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CLOUD POD TEMPLATES v2
-- ============================================

CREATE TABLE IF NOT EXISTS cloud_pod_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'os' | 'app'
    description TEXT,
    proxmox_template_vmid INTEGER,
    default_node VARCHAR(100),
    storage_pool VARCHAR(100),
    network_bridge VARCHAR(50),
    app_stack VARCHAR(50),
    minimum_plan_code VARCHAR(50),
    tags JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default templates
INSERT INTO cloud_pod_templates (code, name, type, description, app_stack, is_active) VALUES
    ('ubuntu-22.04', 'Ubuntu 22.04 LTS', 'os', 'Ubuntu 22.04 LTS Server', NULL, TRUE),
    ('ubuntu-24.04', 'Ubuntu 24.04 LTS', 'os', 'Ubuntu 24.04 LTS Server', NULL, TRUE),
    ('debian-12', 'Debian 12', 'os', 'Debian 12 (Bookworm)', NULL, TRUE),
    ('rocky-9', 'Rocky Linux 9', 'os', 'Rocky Linux 9 (Enterprise)', NULL, TRUE),
    ('wordpress', 'WordPress Stack', 'app', 'WordPress with Apache, PHP, MariaDB', 'wordpress', TRUE),
    ('laravel', 'Laravel Stack', 'app', 'Laravel with Nginx, PHP-FPM, MySQL', 'laravel', TRUE),
    ('nodejs', 'Node.js Stack', 'app', 'Node.js with PM2, Nginx reverse proxy', 'nodejs', TRUE),
    ('docker', 'Docker Host', 'app', 'Docker CE with Docker Compose', 'docker', TRUE),
    ('nextjs', 'Next.js Stack', 'app', 'Next.js with Node.js and PM2', 'nextjs', TRUE)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- CLOUD POD VOLUMES
-- ============================================

CREATE TABLE IF NOT EXISTS cloud_pod_volumes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    pod_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    size_gb INTEGER NOT NULL,
    storage_pool VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'creating',
    proxmox_volume_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cloud_pod_volumes_tenant ON cloud_pod_volumes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cloud_pod_volumes_pod ON cloud_pod_volumes(pod_id);
CREATE INDEX IF NOT EXISTS idx_cloud_pod_volumes_status ON cloud_pod_volumes(status);

-- ============================================
-- CLOUD POD DNS RECORDS
-- ============================================

CREATE TABLE IF NOT EXISTS cloud_pod_dns_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    pod_id UUID NOT NULL,
    zone_name VARCHAR(255) NOT NULL,
    hostname VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    type VARCHAR(10) DEFAULT 'A',
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cloud_pod_dns_tenant ON cloud_pod_dns_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cloud_pod_dns_pod ON cloud_pod_dns_records(pod_id);
CREATE INDEX IF NOT EXISTS idx_cloud_pod_dns_zone ON cloud_pod_dns_records(zone_name);

-- ============================================
-- CLOUD POD HOOKS
-- ============================================

CREATE TABLE IF NOT EXISTS cloud_pod_hooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    event VARCHAR(50) NOT NULL,
    type VARCHAR(20) NOT NULL,
    target VARCHAR(2048) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    config JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cloud_pod_hooks_tenant_event ON cloud_pod_hooks(tenant_id, event);
CREATE INDEX IF NOT EXISTS idx_cloud_pod_hooks_event_active ON cloud_pod_hooks(event, is_active);

-- Done!
SELECT 'Platform Enterprise Core migration completed successfully!' as status;
