-- Migration: Add Wave 3 Features (CDN, Advanced DNS, Enhanced Backups)
-- Created: 2024-11-12
-- Features: Multi-Region CDN, DNSSEC, GeoDNS, Health Checks, PITR Backups

-- ====================================
-- MULTI-REGION CDN MANAGEMENT
-- ====================================

-- CDN Configurations
CREATE TABLE IF NOT EXISTS cdn_configurations (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  domain_id INTEGER REFERENCES domains(id),
  provider VARCHAR(50) NOT NULL, -- cloudflare, cloudfront, fastly, bunny
  provider_config JSONB NOT NULL, -- Provider-specific configuration
  caching_rules JSONB, -- Cache TTLs and rules
  geo_routing JSONB, -- Geographic routing configuration
  ssl_config JSONB, -- SSL/TLS configuration
  status VARCHAR(50) DEFAULT 'active', -- active, inactive, deleted
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cdn_tenant ON cdn_configurations(tenant_id);
CREATE INDEX idx_cdn_domain ON cdn_configurations(domain_id);
CREATE INDEX idx_cdn_provider ON cdn_configurations(provider);

-- CDN Purge Logs
CREATE TABLE IF NOT EXISTS cdn_purge_logs (
  id SERIAL PRIMARY KEY,
  cdn_id INTEGER NOT NULL REFERENCES cdn_configurations(id) ON DELETE CASCADE,
  purge_type VARCHAR(50) NOT NULL, -- full, selective
  urls JSONB, -- URLs to purge (if selective)
  status VARCHAR(50) DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cdn_purge_cdn ON cdn_purge_logs(cdn_id);
CREATE INDEX idx_cdn_purge_created ON cdn_purge_logs(created_at DESC);

-- CDN Analytics (aggregated metrics)
CREATE TABLE IF NOT EXISTS cdn_analytics (
  id SERIAL PRIMARY KEY,
  cdn_id INTEGER NOT NULL REFERENCES cdn_configurations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  requests_total BIGINT DEFAULT 0,
  bandwidth_bytes BIGINT DEFAULT 0,
  cache_hit_ratio DECIMAL(5, 2), -- Percentage
  unique_visitors INTEGER DEFAULT 0,
  threats_blocked INTEGER DEFAULT 0,
  avg_response_time INTEGER, -- Milliseconds
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cdn_analytics_cdn ON cdn_analytics(cdn_id);
CREATE INDEX idx_cdn_analytics_date ON cdn_analytics(date DESC);

-- ====================================
-- ADVANCED DNS MANAGEMENT
-- ====================================

-- DNSSEC Configurations
CREATE TABLE IF NOT EXISTS dnssec_configurations (
  id SERIAL PRIMARY KEY,
  zone_id INTEGER NOT NULL REFERENCES dns_zones(id) ON DELETE CASCADE,
  algorithm VARCHAR(50) NOT NULL, -- RSASHA256, ECDSAP256SHA256, etc.
  ksk_id VARCHAR(255) NOT NULL, -- Key Signing Key ID
  zsk_id VARCHAR(255) NOT NULL, -- Zone Signing Key ID
  ds_records JSONB NOT NULL, -- DS records for registrar
  auto_renewal BOOLEAN DEFAULT true,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dnssec_zone ON dnssec_configurations(zone_id);

-- DNSSEC Keys
CREATE TABLE IF NOT EXISTS dnssec_keys (
  id VARCHAR(255) PRIMARY KEY,
  zone_name VARCHAR(255) NOT NULL,
  key_type VARCHAR(10) NOT NULL, -- KSK or ZSK
  algorithm VARCHAR(50) NOT NULL,
  flags INTEGER NOT NULL, -- 257 for KSK, 256 for ZSK
  public_key TEXT NOT NULL,
  private_key TEXT NOT NULL, -- Encrypted in production
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);

CREATE INDEX idx_dnssec_keys_zone ON dnssec_keys(zone_name);

-- GeoDNS Policies
CREATE TABLE IF NOT EXISTS geodns_policies (
  id SERIAL PRIMARY KEY,
  zone_id INTEGER NOT NULL REFERENCES dns_zones(id) ON DELETE CASCADE,
  record_name VARCHAR(255) NOT NULL,
  record_type VARCHAR(10) NOT NULL, -- A, AAAA, CNAME, etc.
  routing_rules JSONB NOT NULL, -- Geographic routing rules
  health_check_id INTEGER, -- Reference to health check
  fallback_target VARCHAR(255), -- Default target if no match
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_geodns_zone ON geodns_policies(zone_id);
CREATE INDEX idx_geodns_record ON geodns_policies(record_name);

-- DNS Health Checks
CREATE TABLE IF NOT EXISTS dns_health_checks (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  target VARCHAR(500) NOT NULL, -- Hostname or IP to check
  protocol VARCHAR(20) DEFAULT 'HTTPS', -- HTTP, HTTPS, TCP, PING
  port INTEGER DEFAULT 443,
  path VARCHAR(500) DEFAULT '/',
  interval_seconds INTEGER DEFAULT 30,
  timeout_seconds INTEGER DEFAULT 10,
  unhealthy_threshold INTEGER DEFAULT 3, -- Failures before unhealthy
  healthy_threshold INTEGER DEFAULT 2, -- Successes before healthy
  expected_status INTEGER DEFAULT 200,
  notification_settings JSONB, -- Email, SMS, webhook notifications
  current_status VARCHAR(50) DEFAULT 'unknown', -- healthy, unhealthy, checking
  last_state_change TIMESTAMP,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_health_checks_target ON dns_health_checks(target);
CREATE INDEX idx_health_checks_status ON dns_health_checks(current_status);

-- Health Check Results
CREATE TABLE IF NOT EXISTS health_check_results (
  id SERIAL PRIMARY KEY,
  health_check_id INTEGER NOT NULL REFERENCES dns_health_checks(id) ON DELETE CASCADE,
  is_healthy BOOLEAN NOT NULL,
  response_time INTEGER, -- Milliseconds
  status_code INTEGER,
  error_message TEXT,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_health_check_results_check ON health_check_results(health_check_id);
CREATE INDEX idx_health_check_results_checked ON health_check_results(checked_at DESC);

-- DNS Failover Events
CREATE TABLE IF NOT EXISTS dns_failover_events (
  id SERIAL PRIMARY KEY,
  policy_id INTEGER NOT NULL REFERENCES geodns_policies(id) ON DELETE CASCADE,
  health_check_id INTEGER NOT NULL REFERENCES dns_health_checks(id),
  original_target JSONB,
  failover_target VARCHAR(255),
  triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_failover_policy ON dns_failover_events(policy_id);
CREATE INDEX idx_failover_triggered ON dns_failover_events(triggered_at DESC);

-- DNS Query Logs (for analytics)
CREATE TABLE IF NOT EXISTS dns_query_logs (
  id BIGSERIAL PRIMARY KEY,
  zone_id INTEGER NOT NULL REFERENCES dns_zones(id) ON DELETE CASCADE,
  record_name VARCHAR(255) NOT NULL,
  record_type VARCHAR(10) NOT NULL,
  client_ip VARCHAR(45), -- IPv4 or IPv6
  country VARCHAR(2), -- ISO country code
  status VARCHAR(20) DEFAULT 'NOERROR', -- NOERROR, NXDOMAIN, SERVFAIL, etc.
  response_time INTEGER, -- Microseconds
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dns_query_logs_zone ON dns_query_logs(zone_id);
CREATE INDEX idx_dns_query_logs_created ON dns_query_logs(created_at DESC);
CREATE INDEX idx_dns_query_logs_country ON dns_query_logs(country);

-- Partition by date for performance (PostgreSQL 10+)
-- CREATE TABLE dns_query_logs_y2024m11 PARTITION OF dns_query_logs
--   FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');

-- ====================================
-- ENHANCED BACKUP & DISASTER RECOVERY
-- ====================================

-- PITR Backups
CREATE TABLE IF NOT EXISTS pitr_backups (
  id SERIAL PRIMARY KEY,
  database_id INTEGER NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  backup_name VARCHAR(255) NOT NULL,
  backup_type VARCHAR(50) NOT NULL, -- full, incremental, differential
  s3_key VARCHAR(500) NOT NULL, -- S3 object key
  backup_size BIGINT NOT NULL, -- Bytes
  checksum VARCHAR(64) NOT NULL, -- SHA-256 checksum
  compression BOOLEAN DEFAULT true,
  encryption BOOLEAN DEFAULT true,
  metadata JSONB, -- Database-specific metadata (binlog position, WAL LSN, etc.)
  replication_status JSONB, -- Cross-region replication info
  status VARCHAR(50) DEFAULT 'completed', -- pending, completed, failed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pitr_backups_database ON pitr_backups(database_id);
CREATE INDEX idx_pitr_backups_type ON pitr_backups(backup_type);
CREATE INDEX idx_pitr_backups_created ON pitr_backups(created_at DESC);

-- Backup Restore Logs
CREATE TABLE IF NOT EXISTS backup_restore_logs (
  id SERIAL PRIMARY KEY,
  backup_id INTEGER NOT NULL REFERENCES pitr_backups(id),
  database_id INTEGER NOT NULL REFERENCES databases(id),
  point_in_time TIMESTAMP, -- Target point-in-time for recovery
  status VARCHAR(50) DEFAULT 'completed', -- completed, failed
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_restore_logs_backup ON backup_restore_logs(backup_id);
CREATE INDEX idx_restore_logs_database ON backup_restore_logs(database_id);
CREATE INDEX idx_restore_logs_created ON backup_restore_logs(created_at DESC);

-- Backup Restore Tests
CREATE TABLE IF NOT EXISTS backup_restore_tests (
  id SERIAL PRIMARY KEY,
  backup_id INTEGER NOT NULL REFERENCES pitr_backups(id),
  test_status VARCHAR(50) NOT NULL, -- passed, failed, error
  verification_result JSONB, -- Detailed test results
  tested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_restore_tests_backup ON backup_restore_tests(backup_id);
CREATE INDEX idx_restore_tests_tested ON backup_restore_tests(tested_at DESC);

-- Backup Retention Policies
CREATE TABLE IF NOT EXISTS backup_retention_policies (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  database_type VARCHAR(50), -- mysql, postgresql, mongodb, redis, or NULL for all
  daily_retention INTEGER DEFAULT 7, -- Days to keep daily backups
  weekly_retention INTEGER DEFAULT 4, -- Weeks to keep weekly backups
  monthly_retention INTEGER DEFAULT 12, -- Months to keep monthly backups
  yearly_retention INTEGER DEFAULT 7, -- Years to keep yearly backups
  compliance_mode BOOLEAN DEFAULT false, -- WORM (Write Once Read Many) for compliance
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_retention_tenant ON backup_retention_policies(tenant_id);

-- Backup Replication Jobs
CREATE TABLE IF NOT EXISTS backup_replication_jobs (
  id SERIAL PRIMARY KEY,
  backup_id INTEGER NOT NULL REFERENCES pitr_backups(id),
  source_region VARCHAR(50) NOT NULL,
  target_region VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, failed
  bytes_transferred BIGINT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_replication_backup ON backup_replication_jobs(backup_id);
CREATE INDEX idx_replication_status ON backup_replication_jobs(status);

-- ====================================
-- HELPER FUNCTIONS
-- ====================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cdn_updated_at BEFORE UPDATE ON cdn_configurations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dnssec_updated_at BEFORE UPDATE ON dnssec_configurations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_geodns_updated_at BEFORE UPDATE ON geodns_policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_health_checks_updated_at BEFORE UPDATE ON dns_health_checks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_retention_updated_at BEFORE UPDATE ON backup_retention_policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Cleanup old DNS query logs (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_dns_query_logs()
RETURNS void AS $$
BEGIN
  -- Delete query logs older than 90 days
  DELETE FROM dns_query_logs 
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Cleanup old health check results
CREATE OR REPLACE FUNCTION cleanup_old_health_check_results()
RETURNS void AS $$
BEGIN
  -- Delete health check results older than 30 days
  DELETE FROM health_check_results 
  WHERE checked_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Cleanup old CDN analytics
CREATE OR REPLACE FUNCTION cleanup_old_cdn_analytics()
RETURNS void AS $$
BEGIN
  -- Delete CDN analytics older than 1 year
  DELETE FROM cdn_analytics 
  WHERE date < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;
