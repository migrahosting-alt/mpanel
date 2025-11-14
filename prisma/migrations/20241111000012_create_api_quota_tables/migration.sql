-- Create API quota tables
-- Migration: 20241111000012_create_api_quota_tables

CREATE TABLE IF NOT EXISTS api_quotas (
  id SERIAL PRIMARY KEY,
  api_key_id INTEGER NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  requests_per_hour INTEGER DEFAULT 100,
  requests_per_day INTEGER DEFAULT 1000,
  requests_per_month INTEGER DEFAULT 10000,
  max_storage BIGINT DEFAULT 104857600, -- 100MB in bytes
  max_bandwidth BIGINT DEFAULT 1073741824, -- 1GB in bytes
  max_domains INTEGER DEFAULT 1,
  max_websites INTEGER DEFAULT 1,
  max_databases INTEGER DEFAULT 1,
  max_email_accounts INTEGER DEFAULT 5,
  overage_allowed BOOLEAN DEFAULT false,
  overage_rate DECIMAL(10, 4) DEFAULT 0.0001, -- Rate per request over quota
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS api_usage_logs (
  id BIGSERIAL PRIMARY KEY,
  api_key_id INTEGER NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint VARCHAR(500),
  method VARCHAR(10),
  response_size INTEGER DEFAULT 0,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for api_quotas
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_quotas_api_key_id ON api_quotas(api_key_id);

-- Indexes for api_usage_logs
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_api_key_id ON api_usage_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_timestamp ON api_usage_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_api_key_timestamp 
  ON api_usage_logs(api_key_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_endpoint ON api_usage_logs(endpoint);

-- Composite index for usage analysis
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_analysis 
  ON api_usage_logs(api_key_id, timestamp DESC, endpoint, method);

-- Add trigger to update updated_at on api_quotas
CREATE OR REPLACE FUNCTION update_api_quotas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_api_quotas_updated_at
  BEFORE UPDATE ON api_quotas
  FOR EACH ROW
  EXECUTE FUNCTION update_api_quotas_updated_at();

-- Analyze tables for query optimization
ANALYZE api_quotas;
ANALYZE api_usage_logs;
