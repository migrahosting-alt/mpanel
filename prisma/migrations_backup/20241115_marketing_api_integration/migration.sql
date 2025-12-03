-- Marketing API Integration Tables
-- Migration: 20241115_marketing_api_integration

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- API Keys table for marketing website authentication
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  key_hash VARCHAR(64) NOT NULL,  -- SHA-256 hash of API key (never store plain text)
  name VARCHAR(255) NOT NULL,
  scope VARCHAR(50) DEFAULT 'marketing',  -- marketing, general, admin, webhook
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_by UUID,  -- Admin user who created the key
  notes TEXT,
  UNIQUE(key_hash)
);

CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_tenant_id ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_scope ON api_keys(scope);
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active);

-- Trigger for updated_at
CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Marketing Webhooks table for real-time event notifications
CREATE TABLE IF NOT EXISTS marketing_webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  url VARCHAR(500) NOT NULL,
  events JSONB NOT NULL,  -- Array of subscribed event types
  secret VARCHAR(255) NOT NULL,  -- Webhook secret for signature verification
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_triggered_at TIMESTAMP,
  total_deliveries INTEGER DEFAULT 0,
  failed_deliveries INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2)  -- Calculated: (total - failed) / total * 100
);

CREATE INDEX idx_marketing_webhooks_tenant_id ON marketing_webhooks(tenant_id);
CREATE INDEX idx_marketing_webhooks_api_key_id ON marketing_webhooks(api_key_id);
CREATE INDEX idx_marketing_webhooks_is_active ON marketing_webhooks(is_active);

-- Trigger for updated_at
CREATE TRIGGER update_marketing_webhooks_updated_at
  BEFORE UPDATE ON marketing_webhooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Webhook Delivery Logs table for debugging
CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID REFERENCES marketing_webhooks(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,  -- HTTP status code
  response_body TEXT,
  delivery_attempts INTEGER DEFAULT 1,
  delivered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  error_message TEXT
);

CREATE INDEX idx_webhook_delivery_logs_webhook_id ON webhook_delivery_logs(webhook_id);
CREATE INDEX idx_webhook_delivery_logs_created_at ON webhook_delivery_logs(created_at);
CREATE INDEX idx_webhook_delivery_logs_event_type ON webhook_delivery_logs(event_type);

-- API Activity Logs table for security and monitoring
CREATE TABLE IF NOT EXISTS api_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,  -- GET, POST, PUT, DELETE
  status_code INTEGER,
  ip_address INET,
  user_agent TEXT,
  request_body JSONB,  -- Only for POST/PUT (sanitized)
  response_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_activity_logs_api_key_id ON api_activity_logs(api_key_id);
CREATE INDEX idx_api_activity_logs_tenant_id ON api_activity_logs(tenant_id);
CREATE INDEX idx_api_activity_logs_created_at ON api_activity_logs(created_at);
CREATE INDEX idx_api_activity_logs_endpoint ON api_activity_logs(endpoint);

-- Add marketing_source and UTM fields to customers table if not exists
ALTER TABLE customers ADD COLUMN IF NOT EXISTS marketing_source VARCHAR(100);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS utm_source VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS utm_content VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS utm_term VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_customers_marketing_source ON customers(marketing_source);
CREATE INDEX IF NOT EXISTS idx_customers_utm_campaign ON customers(utm_campaign);

-- Add password_hash to customers table for API-created accounts
ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Password reset tokens table (if not exists)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_tokens_customer_id ON password_reset_tokens(customer_id);

-- Promo code usage tracking
CREATE TABLE IF NOT EXISTS promo_code_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promo_code_id UUID REFERENCES promo_codes(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(promo_code_id, customer_id)
);

CREATE INDEX idx_promo_code_usage_promo_code_id ON promo_code_usage(promo_code_id);
CREATE INDEX idx_promo_code_usage_customer_id ON promo_code_usage(customer_id);

-- Promo codes table (if not exists)
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  discount_type VARCHAR(20) DEFAULT 'percentage',  -- percentage, fixed
  discount_amount DECIMAL(10,2) NOT NULL,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  starts_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, code)
);

CREATE INDEX idx_promo_codes_code ON promo_codes(code);
CREATE INDEX idx_promo_codes_tenant_id ON promo_codes(tenant_id);
CREATE INDEX idx_promo_codes_is_active ON promo_codes(is_active);

-- Trigger for updated_at
CREATE TRIGGER update_promo_codes_updated_at
  BEFORE UPDATE ON promo_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Incidents table for system status (if not exists)
CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  severity VARCHAR(20) DEFAULT 'minor',  -- minor, major, critical
  status VARCHAR(20) DEFAULT 'investigating',  -- investigating, identified, monitoring, resolved
  affected_services JSONB,  -- Array of affected service IDs
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP
);

CREATE INDEX idx_incidents_tenant_id ON incidents(tenant_id);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_created_at ON incidents(created_at);

-- Trigger for updated_at
CREATE TRIGGER update_incidents_updated_at
  BEFORE UPDATE ON incidents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to trigger webhooks (called by application)
CREATE OR REPLACE FUNCTION notify_marketing_webhook(
  p_tenant_id UUID,
  p_event_type VARCHAR(100),
  p_payload JSONB
) RETURNS void AS $$
DECLARE
  v_webhook RECORD;
BEGIN
  -- Find all active webhooks subscribed to this event
  FOR v_webhook IN
    SELECT id, url, secret, events
    FROM marketing_webhooks
    WHERE tenant_id = p_tenant_id
      AND is_active = true
      AND events @> to_jsonb(ARRAY[p_event_type])
  LOOP
    -- Log webhook delivery attempt
    INSERT INTO webhook_delivery_logs (
      webhook_id, tenant_id, event_type, payload, created_at
    ) VALUES (
      v_webhook.id, p_tenant_id, p_event_type, p_payload, NOW()
    );
    
    -- Actual webhook delivery handled by application (async)
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Sample data for testing (optional - remove in production)
-- INSERT INTO api_keys (tenant_id, key_hash, name, scope)
-- VALUES (
--   (SELECT id FROM tenants LIMIT 1),
--   encode(sha256('test_key_12345'::bytea), 'hex'),
--   'Test Marketing API Key',
--   'marketing'
-- );

-- Grant permissions (adjust as needed)
-- GRANT SELECT, INSERT, UPDATE ON api_keys TO mpanel_app;
-- GRANT SELECT, INSERT, UPDATE ON marketing_webhooks TO mpanel_app;
-- GRANT SELECT, INSERT ON webhook_delivery_logs TO mpanel_app;
-- GRANT SELECT, INSERT ON api_activity_logs TO mpanel_app;

COMMENT ON TABLE api_keys IS 'API keys for marketing website and third-party integrations';
COMMENT ON TABLE marketing_webhooks IS 'Webhook endpoints for real-time event notifications to marketing website';
COMMENT ON TABLE webhook_delivery_logs IS 'Audit log of webhook deliveries for debugging and monitoring';
COMMENT ON TABLE api_activity_logs IS 'Activity log of all API requests for security monitoring';
COMMENT ON TABLE promo_codes IS 'Promotional discount codes for marketing campaigns';
COMMENT ON TABLE promo_code_usage IS 'Tracking which customers used which promo codes';
COMMENT ON TABLE incidents IS 'System incidents for status page reporting';
