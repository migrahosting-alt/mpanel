-- Migration: Guardian AI Foundation
-- Date: 2025-12-02
-- Description: Establishes Guardian data model for security posture, findings,
-- remediation workflows, and audit logging with tenant + region scoping.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- GUARDIAN SECURITY INSTANCES
-- ============================================

CREATE TABLE IF NOT EXISTS guardian_security_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID,
    data_region VARCHAR(50) NOT NULL DEFAULT 'us',
    name VARCHAR(150) NOT NULL,
    environment VARCHAR(50) NOT NULL DEFAULT 'production',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    mode VARCHAR(50),
    policy_pack JSONB,
    auto_remediation_settings JSONB,
    detection_sources JSONB,
    notification_settings JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT guardian_security_instances_tenant_fk FOREIGN KEY (tenant_id)
        REFERENCES tenants(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_guardian_security_instances_tenant_region
    ON guardian_security_instances(tenant_id, data_region);

-- ============================================
-- GUARDIAN SECURITY SCANS
-- ============================================

CREATE TABLE IF NOT EXISTS guardian_security_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guardian_instance_id UUID,
    tenant_id UUID NOT NULL,
    data_region VARCHAR(50) NOT NULL,
    server_id UUID,
    source_type VARCHAR(50) NOT NULL DEFAULT 'migra_agent',
    scan_type VARCHAR(50) NOT NULL DEFAULT 'scheduled',
    mode VARCHAR(50) NOT NULL DEFAULT 'report_only',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    severity_summary JSONB,
    findings_count INTEGER NOT NULL DEFAULT 0,
    triggered_by VARCHAR(255),
    triggered_by_type VARCHAR(100),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT guardian_security_scans_instance_fk FOREIGN KEY (guardian_instance_id)
        REFERENCES guardian_security_instances(id) ON DELETE SET NULL,
    CONSTRAINT guardian_security_scans_tenant_fk FOREIGN KEY (tenant_id)
        REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT guardian_security_scans_server_fk FOREIGN KEY (server_id)
        REFERENCES servers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_guardian_security_scans_tenant_region_status
    ON guardian_security_scans(tenant_id, data_region, status);
CREATE INDEX IF NOT EXISTS idx_guardian_security_scans_server_created
    ON guardian_security_scans(server_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guardian_security_scans_instance
    ON guardian_security_scans(guardian_instance_id);

-- ============================================
-- GUARDIAN SECURITY FINDINGS
-- ============================================

CREATE TABLE IF NOT EXISTS guardian_security_findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guardian_instance_id UUID,
    scan_id UUID,
    tenant_id UUID NOT NULL,
    data_region VARCHAR(50) NOT NULL,
    server_id UUID,
    severity VARCHAR(50) NOT NULL DEFAULT 'low',
    category VARCHAR(100),
    signature_id VARCHAR(100),
    title TEXT NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'open',
    remediation_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    remediation_mode VARCHAR(50),
    recommended_action TEXT,
    evidence JSONB,
    context JSONB,
    metadata JSONB,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT guardian_security_findings_instance_fk FOREIGN KEY (guardian_instance_id)
        REFERENCES guardian_security_instances(id) ON DELETE SET NULL,
    CONSTRAINT guardian_security_findings_scan_fk FOREIGN KEY (scan_id)
        REFERENCES guardian_security_scans(id) ON DELETE SET NULL,
    CONSTRAINT guardian_security_findings_tenant_fk FOREIGN KEY (tenant_id)
        REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT guardian_security_findings_server_fk FOREIGN KEY (server_id)
        REFERENCES servers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_guardian_security_findings_tenant_status
    ON guardian_security_findings(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_guardian_security_findings_server_status
    ON guardian_security_findings(server_id, status);
CREATE INDEX IF NOT EXISTS idx_guardian_security_findings_scan
    ON guardian_security_findings(scan_id);

-- ============================================
-- GUARDIAN SECURITY REMEDIATION TASKS
-- ============================================

CREATE TABLE IF NOT EXISTS guardian_security_remediation_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guardian_instance_id UUID,
    tenant_id UUID NOT NULL,
    data_region VARCHAR(50) NOT NULL,
    server_id UUID,
    scan_id UUID,
    finding_id UUID,
    mode VARCHAR(50) NOT NULL DEFAULT 'request_only',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    severity VARCHAR(50),
    requested_by UUID,
    requested_by_type VARCHAR(50),
    approvals JSONB,
    required_approvals JSONB,
    approved_tenant_by UUID,
    approved_platform_by UUID,
    approved_tenant_at TIMESTAMPTZ,
    approved_platform_at TIMESTAMPTZ,
    executed_by UUID,
    executed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    dry_run BOOLEAN NOT NULL DEFAULT TRUE,
    result JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT guardian_security_tasks_instance_fk FOREIGN KEY (guardian_instance_id)
        REFERENCES guardian_security_instances(id) ON DELETE SET NULL,
    CONSTRAINT guardian_security_tasks_tenant_fk FOREIGN KEY (tenant_id)
        REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT guardian_security_tasks_server_fk FOREIGN KEY (server_id)
        REFERENCES servers(id) ON DELETE SET NULL,
    CONSTRAINT guardian_security_tasks_scan_fk FOREIGN KEY (scan_id)
        REFERENCES guardian_security_scans(id) ON DELETE SET NULL,
    CONSTRAINT guardian_security_tasks_finding_fk FOREIGN KEY (finding_id)
        REFERENCES guardian_security_findings(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_guardian_security_tasks_tenant_region_status
    ON guardian_security_remediation_tasks(tenant_id, data_region, status);
CREATE INDEX IF NOT EXISTS idx_guardian_security_tasks_server_status
    ON guardian_security_remediation_tasks(server_id, status);
CREATE INDEX IF NOT EXISTS idx_guardian_security_tasks_finding
    ON guardian_security_remediation_tasks(finding_id);

-- ============================================
-- GUARDIAN SECURITY AUDIT EVENTS
-- ============================================

CREATE TABLE IF NOT EXISTS guardian_security_audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guardian_instance_id UUID,
    tenant_id UUID NOT NULL,
    data_region VARCHAR(50) NOT NULL,
    user_id UUID,
    actor_type VARCHAR(50) NOT NULL,
    actor_id VARCHAR(255),
    action VARCHAR(255) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'info',
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    impersonation_tenant_id UUID,
    context JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT guardian_security_audit_instance_fk FOREIGN KEY (guardian_instance_id)
        REFERENCES guardian_security_instances(id) ON DELETE SET NULL,
    CONSTRAINT guardian_security_audit_tenant_fk FOREIGN KEY (tenant_id)
        REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT guardian_security_audit_user_fk FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_guardian_security_audit_tenant_region_created
    ON guardian_security_audit_events(tenant_id, data_region, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guardian_security_audit_instance
    ON guardian_security_audit_events(guardian_instance_id);
CREATE INDEX IF NOT EXISTS idx_guardian_security_audit_user
    ON guardian_security_audit_events(user_id, created_at DESC);

-- Done!
SELECT 'Guardian AI foundation migration applied' AS status;
