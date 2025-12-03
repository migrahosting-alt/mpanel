-- Migration: Phase 3 Additive Schema
-- Date: 2025-12-03
-- Description: Add cloud_pod_nodes, cloud_pod_allocations, cloud_pod_metrics,
--              monitoring_service_status, monitoring_slow_queries.
--              Only NEW tables; does NOT touch existing tables, columns, or indexes.
-- ============================================================================

-- ============================================================================
-- CloudPods Provisioning Engine
-- ============================================================================

-- cloud_pod_nodes: Proxmox/host nodes available for CloudPods
CREATE TABLE IF NOT EXISTS cloud_pod_nodes (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,          -- e.g. "srv1-web", "pod-node-1"
  provider        TEXT NOT NULL,          -- "proxmox"
  api_url         TEXT NOT NULL,          -- https://10.x.x.x:8006/api2/json
  node_name       TEXT NOT NULL,          -- actual Proxmox node name
  status          TEXT NOT NULL DEFAULT 'active', -- active/maintenance/disabled
  total_cpu_cores INT NOT NULL,
  total_memory_mb INT NOT NULL,
  total_disk_gb   INT NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cloud_pod_nodes_status ON cloud_pod_nodes(status);
CREATE INDEX IF NOT EXISTS idx_cloud_pod_nodes_provider ON cloud_pod_nodes(provider);

-- cloud_pod_allocations: Tracks resource allocations per node
CREATE TABLE IF NOT EXISTS cloud_pod_allocations (
  id              SERIAL PRIMARY KEY,
  node_id         INT NOT NULL REFERENCES cloud_pod_nodes(id) ON DELETE CASCADE,
  used_cpu_cores  INT NOT NULL DEFAULT 0,
  used_memory_mb  INT NOT NULL DEFAULT 0,
  used_disk_gb    INT NOT NULL DEFAULT 0,
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cloud_pod_allocations_node_id ON cloud_pod_allocations(node_id);

-- cloud_pod_metrics: Per-pod runtime metrics
CREATE TABLE IF NOT EXISTS cloud_pod_metrics (
  id              SERIAL PRIMARY KEY,
  pod_id          UUID NOT NULL,  -- FK to cloud_pods.id
  cpu_usage       NUMERIC(5,2) NOT NULL,
  memory_usage    NUMERIC(5,2) NOT NULL,
  disk_usage      NUMERIC(5,2) NOT NULL,
  collected_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cloud_pod_metrics_pod_time ON cloud_pod_metrics (pod_id, collected_at DESC);

-- ============================================================================
-- Monitoring Telemetry Layer
-- ============================================================================

-- monitoring_service_status: Service health tracking
CREATE TABLE IF NOT EXISTS monitoring_service_status (
  id             SERIAL PRIMARY KEY,
  service_name   TEXT NOT NULL, -- 'db-core', 'mail-core', 'mpanel-core', etc.
  status         TEXT NOT NULL, -- 'up' | 'down' | 'degraded'
  latency_ms     INT,
  checked_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitoring_service_status_service_time
  ON monitoring_service_status (service_name, checked_at DESC);

-- monitoring_slow_queries: Slow query tracking
CREATE TABLE IF NOT EXISTS monitoring_slow_queries (
  id             SERIAL PRIMARY KEY,
  query_hash     TEXT NOT NULL,
  sample_query   TEXT NOT NULL,
  avg_duration_ms NUMERIC(10,2) NOT NULL,
  calls          BIGINT NOT NULL,
  last_seen_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitoring_slow_queries_hash ON monitoring_slow_queries(query_hash);
CREATE INDEX IF NOT EXISTS idx_monitoring_slow_queries_last_seen ON monitoring_slow_queries(last_seen_at DESC);

-- ============================================================================
-- Verification
-- ============================================================================

-- Optional: Print summary of new tables
DO $$
BEGIN
  RAISE NOTICE 'Phase 3 additive schema applied.';
  RAISE NOTICE 'New tables: cloud_pod_nodes, cloud_pod_allocations, cloud_pod_metrics, monitoring_service_status, monitoring_slow_queries.';
END $$;

