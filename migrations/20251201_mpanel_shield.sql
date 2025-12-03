-- mPanel Shield Phase 1 schema additions
-- Creates shield policy + decision tables for the managed trust boundary

CREATE TABLE IF NOT EXISTS shield_policies (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID REFERENCES tenants(id) ON DELETE SET NULL,
    name            TEXT NOT NULL,
    version         INTEGER NOT NULL DEFAULT 1,
    status          VARCHAR(32) NOT NULL DEFAULT 'active',
    mode            VARCHAR(32) NOT NULL DEFAULT 'report_only',
    rollout_stage   VARCHAR(64),
    ruleset         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shield_policies_tenant
    ON shield_policies (tenant_id);

CREATE TABLE IF NOT EXISTS shield_decisions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    policy_id       UUID REFERENCES shield_policies(id) ON DELETE SET NULL,
    tenant_id       UUID REFERENCES tenants(id) ON DELETE SET NULL,
    request_id      TEXT,
    result          VARCHAR(32) NOT NULL,
    reason          TEXT,
    mode            VARCHAR(32) NOT NULL DEFAULT 'report_only',
    policy_version  INTEGER,
    context         JSONB,
    hash            TEXT,
    prev_hash       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shield_decisions_tenant
    ON shield_decisions (tenant_id);

CREATE INDEX IF NOT EXISTS idx_shield_decisions_policy
    ON shield_decisions (policy_id);
