-- Create custom_reports table for storing user-defined report configurations
-- Migration: 20241111000010_create_custom_reports_table

CREATE TABLE IF NOT EXISTS custom_reports (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  metrics JSONB NOT NULL DEFAULT '[]',
  filters JSONB DEFAULT '{}',
  schedule JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_generated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create resource_metrics table for storing system resource usage
CREATE TABLE IF NOT EXISTS resource_metrics (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resource_id INTEGER,
  resource_type VARCHAR(50) NOT NULL, -- 'server', 'website', 'database'
  metrics JSONB NOT NULL DEFAULT '{}',
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for custom_reports
CREATE INDEX IF NOT EXISTS idx_custom_reports_tenant_id ON custom_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_custom_reports_user_id ON custom_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_reports_active ON custom_reports(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_custom_reports_created_at ON custom_reports(created_at DESC);

-- Indexes for resource_metrics
CREATE INDEX IF NOT EXISTS idx_resource_metrics_tenant_id ON resource_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_resource_metrics_resource ON resource_metrics(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_metrics_recorded_at ON resource_metrics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_resource_metrics_metrics ON resource_metrics USING GIN (metrics);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_resource_metrics_tenant_type_time 
  ON resource_metrics(tenant_id, resource_type, recorded_at DESC);

-- Add trigger to update updated_at on custom_reports
CREATE OR REPLACE FUNCTION update_custom_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_custom_reports_updated_at
  BEFORE UPDATE ON custom_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_reports_updated_at();

-- Analyze tables for query optimization
ANALYZE custom_reports;
ANALYZE resource_metrics;
