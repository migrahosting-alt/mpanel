-- Create resource_metrics table
CREATE TABLE IF NOT EXISTS resource_metrics (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type VARCHAR(50) NOT NULL, -- server, website, database, email
  resource_id INTEGER,
  metrics JSONB NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create monitoring_alerts table
CREATE TABLE IF NOT EXISTS monitoring_alerts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id INTEGER REFERENCES alert_rules(id) ON DELETE SET NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id INTEGER,
  severity VARCHAR(20) DEFAULT 'warning', -- info, warning, critical
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'active', -- active, acknowledged, resolved
  acknowledged_at TIMESTAMP,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create alert_rules table
CREATE TABLE IF NOT EXISTS alert_rules (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id INTEGER NOT NULL,
  metric VARCHAR(100) NOT NULL, -- cpu, memory, disk, connections, etc.
  operator VARCHAR(10) NOT NULL, -- >, <, >=, <=, ==
  threshold NUMERIC NOT NULL,
  duration INTEGER DEFAULT 300, -- Seconds to persist before alerting
  notification_channels JSONB DEFAULT '["email"]',
  enabled BOOLEAN DEFAULT true,
  last_triggered TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_resource_metrics_resource ON resource_metrics(resource_type, resource_id);
CREATE INDEX idx_resource_metrics_timestamp ON resource_metrics(timestamp DESC);
CREATE INDEX idx_resource_metrics_user_id ON resource_metrics(user_id);
CREATE INDEX idx_monitoring_alerts_user_id ON monitoring_alerts(user_id);
CREATE INDEX idx_monitoring_alerts_status ON monitoring_alerts(status);
CREATE INDEX idx_monitoring_alerts_created_at ON monitoring_alerts(created_at DESC);
CREATE INDEX idx_alert_rules_user_id ON alert_rules(user_id);
CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled) WHERE enabled = true;

-- Add comments
COMMENT ON TABLE resource_metrics IS 'Time-series metrics for resources';
COMMENT ON TABLE monitoring_alerts IS 'Alerts triggered by monitoring rules';
COMMENT ON TABLE alert_rules IS 'User-defined alert rules and thresholds';
COMMENT ON COLUMN resource_metrics.metrics IS 'JSONB object containing metric values';
COMMENT ON COLUMN alert_rules.duration IS 'Duration in seconds that condition must persist before alerting';
COMMENT ON COLUMN alert_rules.notification_channels IS 'Array of notification methods: email, slack, webhook';
