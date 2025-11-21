-- Migration: Add Kubernetes and Advanced Monitoring tables
-- Created: 2024-11-12
-- Features: Kubernetes clusters, deployments, APM, distributed tracing, anomaly detection

-- ====================================
-- KUBERNETES AUTO-SCALING TABLES
-- ====================================

-- K8s Clusters
CREATE TABLE IF NOT EXISTS k8s_clusters (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  region VARCHAR(100) NOT NULL,
  provider VARCHAR(50) NOT NULL, -- gke, eks, aks, doks
  node_count INTEGER DEFAULT 3,
  node_type VARCHAR(100),
  auto_scaling BOOLEAN DEFAULT true,
  min_nodes INTEGER DEFAULT 2,
  max_nodes INTEGER DEFAULT 10,
  version VARCHAR(50),
  status VARCHAR(50) DEFAULT 'provisioning', -- provisioning, active, failed, terminated
  endpoint VARCHAR(500),
  kubeconfig TEXT,
  provisioned_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_k8s_clusters_tenant ON k8s_clusters(tenant_id);
CREATE INDEX idx_k8s_clusters_status ON k8s_clusters(status);

-- K8s Deployments
CREATE TABLE IF NOT EXISTS k8s_deployments (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cluster_id INTEGER NOT NULL REFERENCES k8s_clusters(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  namespace VARCHAR(255) DEFAULT 'default',
  image VARCHAR(500) NOT NULL,
  replicas INTEGER DEFAULT 3,
  status VARCHAR(50) DEFAULT 'active', -- active, updating, failed, deleted
  auto_scaling BOOLEAN DEFAULT true,
  min_replicas INTEGER DEFAULT 2,
  max_replicas INTEGER DEFAULT 10,
  target_cpu INTEGER DEFAULT 70, -- percentage
  target_memory INTEGER DEFAULT 80, -- percentage
  port INTEGER DEFAULT 80,
  env_vars JSONB,
  resources JSONB, -- requests and limits
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_k8s_deployments_tenant ON k8s_deployments(tenant_id);
CREATE INDEX idx_k8s_deployments_cluster ON k8s_deployments(cluster_id);
CREATE INDEX idx_k8s_deployments_status ON k8s_deployments(status);

-- K8s Failover Events
CREATE TABLE IF NOT EXISTS k8s_failover_events (
  id SERIAL PRIMARY KEY,
  deployment_id INTEGER NOT NULL REFERENCES k8s_deployments(id) ON DELETE CASCADE,
  from_region VARCHAR(100) NOT NULL,
  to_region VARCHAR(100) NOT NULL,
  reason TEXT,
  status VARCHAR(50) DEFAULT 'initiated', -- initiated, in-progress, completed, failed
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_k8s_failover_deployment ON k8s_failover_events(deployment_id);

-- K8s Scaling Events
CREATE TABLE IF NOT EXISTS k8s_scaling_events (
  id SERIAL PRIMARY KEY,
  deployment_id INTEGER NOT NULL REFERENCES k8s_deployments(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- scale_up, scale_down, manual
  previous_replicas INTEGER NOT NULL,
  new_replicas INTEGER NOT NULL,
  trigger_metric VARCHAR(50), -- cpu, memory, custom
  metric_value DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_k8s_scaling_deployment ON k8s_scaling_events(deployment_id);
CREATE INDEX idx_k8s_scaling_created ON k8s_scaling_events(created_at DESC);

-- ====================================
-- ADVANCED MONITORING TABLES
-- ====================================

-- APM Requests
CREATE TABLE IF NOT EXISTS apm_requests (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  method VARCHAR(10) NOT NULL,
  path VARCHAR(500) NOT NULL,
  status_code INTEGER NOT NULL,
  response_time INTEGER NOT NULL, -- milliseconds
  user_id INTEGER REFERENCES users(id),
  user_agent TEXT,
  ip_address VARCHAR(45),
  trace_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_apm_requests_tenant ON apm_requests(tenant_id);
CREATE INDEX idx_apm_requests_created ON apm_requests(created_at DESC);
CREATE INDEX idx_apm_requests_trace ON apm_requests(trace_id);
CREATE INDEX idx_apm_requests_path ON apm_requests(path);

-- APM Metrics (aggregated by minute)
CREATE TABLE IF NOT EXISTS apm_metrics (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  time_bucket TIMESTAMP NOT NULL,
  method VARCHAR(10) NOT NULL,
  path VARCHAR(500) NOT NULL,
  request_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  total_response_time BIGINT DEFAULT 0,
  avg_response_time DECIMAL(10, 2) DEFAULT 0,
  min_response_time INTEGER DEFAULT 0,
  max_response_time INTEGER DEFAULT 0,
  UNIQUE(tenant_id, time_bucket, method, path)
);

CREATE INDEX idx_apm_metrics_tenant_time ON apm_metrics(tenant_id, time_bucket DESC);
CREATE INDEX idx_apm_metrics_path ON apm_metrics(path);

-- Infrastructure Metrics
CREATE TABLE IF NOT EXISTS infrastructure_metrics (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  server_id VARCHAR(100),
  cpu_usage DECIMAL(5, 2) NOT NULL, -- percentage
  memory_usage DECIMAL(5, 2) NOT NULL, -- percentage
  disk_usage DECIMAL(5, 2) NOT NULL, -- percentage
  network_in BIGINT DEFAULT 0, -- bytes
  network_out BIGINT DEFAULT 0, -- bytes
  active_connections INTEGER DEFAULT 0,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_infra_metrics_tenant ON infrastructure_metrics(tenant_id);
CREATE INDEX idx_infra_metrics_server ON infrastructure_metrics(server_id);
CREATE INDEX idx_infra_metrics_recorded ON infrastructure_metrics(recorded_at DESC);

-- Monitoring Alerts
CREATE TABLE IF NOT EXISTS monitoring_alerts (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  alert_type VARCHAR(100) NOT NULL, -- anomaly_detected, slow_response, high_error_rate, resource_usage, recurring_error
  severity VARCHAR(20) NOT NULL, -- low, medium, high, critical
  details JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'open', -- open, acknowledged, resolved
  acknowledged_by INTEGER REFERENCES users(id),
  acknowledged_at TIMESTAMP,
  resolved_by INTEGER REFERENCES users(id),
  resolved_at TIMESTAMP,
  resolution TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_monitoring_alerts_tenant ON monitoring_alerts(tenant_id);
CREATE INDEX idx_monitoring_alerts_status ON monitoring_alerts(status);
CREATE INDEX idx_monitoring_alerts_severity ON monitoring_alerts(severity);
CREATE INDEX idx_monitoring_alerts_created ON monitoring_alerts(created_at DESC);

-- Alert Escalations
CREATE TABLE IF NOT EXISTS alert_escalations (
  id SERIAL PRIMARY KEY,
  alert_id INTEGER NOT NULL REFERENCES monitoring_alerts(id) ON DELETE CASCADE,
  escalation_level INTEGER NOT NULL,
  notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alert_escalations_alert ON alert_escalations(alert_id);

-- Monitoring Anomalies
CREATE TABLE IF NOT EXISTS monitoring_anomalies (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_type VARCHAR(50) NOT NULL, -- response_time, error_rate, cpu, memory, etc.
  path VARCHAR(500),
  current_value DECIMAL(15, 2) NOT NULL,
  baseline_value DECIMAL(15, 2) NOT NULL,
  z_score DECIMAL(10, 4) NOT NULL, -- statistical measure
  severity VARCHAR(20) NOT NULL, -- low, medium, high, critical
  ai_analysis JSONB, -- AI-powered root cause analysis
  status VARCHAR(50) DEFAULT 'open', -- open, investigating, resolved, false_positive
  detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP
);

CREATE INDEX idx_monitoring_anomalies_tenant ON monitoring_anomalies(tenant_id);
CREATE INDEX idx_monitoring_anomalies_status ON monitoring_anomalies(status);
CREATE INDEX idx_monitoring_anomalies_detected ON monitoring_anomalies(detected_at DESC);

-- Distributed Traces
CREATE TABLE IF NOT EXISTS distributed_traces (
  id SERIAL PRIMARY KEY,
  trace_id VARCHAR(100) NOT NULL,
  span_id VARCHAR(100) NOT NULL,
  parent_span_id VARCHAR(100),
  service_name VARCHAR(255) NOT NULL,
  operation_name VARCHAR(255) NOT NULL,
  start_time BIGINT NOT NULL, -- microseconds since epoch
  duration BIGINT NOT NULL, -- microseconds
  tags JSONB,
  logs JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(trace_id, span_id)
);

CREATE INDEX idx_distributed_traces_trace ON distributed_traces(trace_id);
CREATE INDEX idx_distributed_traces_service ON distributed_traces(service_name);
CREATE INDEX idx_distributed_traces_start ON distributed_traces(start_time DESC);

-- Log Aggregation
CREATE TABLE IF NOT EXISTS log_aggregation (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  level VARCHAR(20) NOT NULL, -- error, warn, info, debug
  message TEXT NOT NULL,
  context JSONB,
  source VARCHAR(255), -- service/component name
  stack_trace TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_log_aggregation_tenant ON log_aggregation(tenant_id);
CREATE INDEX idx_log_aggregation_level ON log_aggregation(level);
CREATE INDEX idx_log_aggregation_created ON log_aggregation(created_at DESC);
CREATE INDEX idx_log_aggregation_source ON log_aggregation(source);

-- Error Patterns
CREATE TABLE IF NOT EXISTS error_patterns (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  error_message TEXT NOT NULL,
  occurrence_count INTEGER DEFAULT 1,
  first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  stack_trace TEXT,
  status VARCHAR(50) DEFAULT 'active' -- active, resolved
);

CREATE INDEX idx_error_patterns_tenant ON error_patterns(tenant_id);
CREATE INDEX idx_error_patterns_status ON error_patterns(status);

-- Performance Baselines
CREATE TABLE IF NOT EXISTS performance_baselines (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_type VARCHAR(50) NOT NULL, -- response_time, error_rate, throughput
  path VARCHAR(500),
  baseline_value DECIMAL(15, 2) NOT NULL,
  stddev DECIMAL(15, 2),
  sample_size INTEGER NOT NULL,
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, metric_type, path)
);

CREATE INDEX idx_performance_baselines_tenant ON performance_baselines(tenant_id);

-- ====================================
-- HELPER FUNCTIONS
-- ====================================

-- Function to clean old APM data (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_apm_data()
RETURNS void AS $$
BEGIN
  -- Delete APM requests older than 30 days
  DELETE FROM apm_requests WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- Delete aggregated metrics older than 90 days
  DELETE FROM apm_metrics WHERE time_bucket < NOW() - INTERVAL '90 days';
  
  -- Delete infrastructure metrics older than 30 days
  DELETE FROM infrastructure_metrics WHERE recorded_at < NOW() - INTERVAL '30 days';
  
  -- Delete resolved alerts older than 90 days
  DELETE FROM monitoring_alerts WHERE status = 'resolved' AND resolved_at < NOW() - INTERVAL '90 days';
  
  -- Delete logs older than 30 days (except errors)
  DELETE FROM log_aggregation WHERE created_at < NOW() - INTERVAL '30 days' AND level != 'error';
  
  -- Delete error logs older than 90 days
  DELETE FROM log_aggregation WHERE created_at < NOW() - INTERVAL '90 days' AND level = 'error';
END;
$$ LANGUAGE plpgsql;

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_k8s_clusters_updated_at BEFORE UPDATE ON k8s_clusters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_k8s_deployments_updated_at BEFORE UPDATE ON k8s_deployments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
