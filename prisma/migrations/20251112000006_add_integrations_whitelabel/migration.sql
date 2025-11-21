-- Migration: Add API Marketplace and White-Label Platform tables
-- Created: 2024-11-12
-- Features: Webhooks, OAuth 2.0, API Keys, Resellers, Branding, Commissions

-- ====================================
-- API MARKETPLACE & INTEGRATIONS
-- ====================================

-- Webhooks
CREATE TABLE IF NOT EXISTS webhooks (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  url VARCHAR(500) NOT NULL,
  events JSONB NOT NULL, -- Array of event types
  secret VARCHAR(255) NOT NULL, -- HMAC secret for signatures
  is_active BOOLEAN DEFAULT true,
  headers JSONB, -- Custom headers to send
  retry_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_webhooks_tenant ON webhooks(tenant_id);
CREATE INDEX idx_webhooks_active ON webhooks(is_active);

-- Webhook Deliveries
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id SERIAL PRIMARY KEY,
  webhook_id INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, success, failed, retrying
  attempt INTEGER DEFAULT 1,
  response_code INTEGER,
  response_body TEXT,
  error_message TEXT,
  is_replay BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  delivered_at TIMESTAMP
);

CREATE INDEX idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_created ON webhook_deliveries(created_at DESC);

-- OAuth Applications
CREATE TABLE IF NOT EXISTS oauth_applications (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  client_id VARCHAR(255) UNIQUE NOT NULL,
  client_secret VARCHAR(255), -- NULL for public clients (mobile/SPA)
  redirect_uris JSONB NOT NULL, -- Array of allowed redirect URIs
  scopes JSONB NOT NULL, -- Array of allowed scopes
  is_public BOOLEAN DEFAULT false, -- Public vs confidential client
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_oauth_applications_tenant ON oauth_applications(tenant_id);
CREATE INDEX idx_oauth_applications_client_id ON oauth_applications(client_id);

-- OAuth Authorization Codes
CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(255) UNIQUE NOT NULL,
  client_id VARCHAR(255) NOT NULL REFERENCES oauth_applications(client_id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  redirect_uri VARCHAR(500) NOT NULL,
  scopes JSONB NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_oauth_codes_code ON oauth_authorization_codes(code);
CREATE INDEX idx_oauth_codes_expires ON oauth_authorization_codes(expires_at);

-- OAuth Refresh Tokens
CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
  id SERIAL PRIMARY KEY,
  token VARCHAR(255) UNIQUE NOT NULL,
  client_id VARCHAR(255) NOT NULL REFERENCES oauth_applications(client_id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  scopes JSONB NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_oauth_refresh_tokens_token ON oauth_refresh_tokens(token);
CREATE INDEX idx_oauth_refresh_tokens_expires ON oauth_refresh_tokens(expires_at);

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) UNIQUE NOT NULL, -- SHA-256 hash of the key
  key_prefix VARCHAR(20) NOT NULL, -- First 12 chars for identification
  scopes JSONB NOT NULL, -- Allowed scopes
  rate_limit INTEGER DEFAULT 1000, -- Requests per hour
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);

-- API Key Usage (for rate limiting)
CREATE TABLE IF NOT EXISTS api_key_usage (
  id SERIAL PRIMARY KEY,
  api_key_id INTEGER NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_key_usage_key ON api_key_usage(api_key_id);
CREATE INDEX idx_api_key_usage_created ON api_key_usage(created_at);

-- ====================================
-- WHITE-LABEL & RESELLER PLATFORM
-- ====================================

-- Branding Configurations
CREATE TABLE IF NOT EXISTS branding_configurations (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  company_name VARCHAR(255) NOT NULL,
  logo_url VARCHAR(500),
  favicon_url VARCHAR(500),
  primary_color VARCHAR(20) DEFAULT '#3B82F6',
  secondary_color VARCHAR(20) DEFAULT '#10B981',
  accent_color VARCHAR(20) DEFAULT '#F59E0B',
  custom_domain VARCHAR(255),
  custom_css TEXT,
  email_from_name VARCHAR(255),
  email_from_address VARCHAR(255),
  support_email VARCHAR(255),
  support_phone VARCHAR(50),
  terms_url VARCHAR(500),
  privacy_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_branding_tenant ON branding_configurations(tenant_id);
CREATE INDEX idx_branding_domain ON branding_configurations(custom_domain);

-- Resellers
CREATE TABLE IF NOT EXISTS resellers (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  parent_reseller_id INTEGER REFERENCES resellers(id), -- For multi-tier hierarchy
  tier INTEGER NOT NULL DEFAULT 1, -- 1, 2, or 3
  commission_rate DECIMAL(5, 2) NOT NULL, -- Percentage (e.g., 20.00 for 20%)
  custom_pricing JSONB, -- Custom pricing per product type
  max_clients INTEGER, -- Maximum number of clients allowed
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_resellers_tenant ON resellers(tenant_id);
CREATE INDEX idx_resellers_parent ON resellers(parent_reseller_id);
CREATE INDEX idx_resellers_tier ON resellers(tier);

-- Reseller Commissions
CREATE TABLE IF NOT EXISTS reseller_commissions (
  id SERIAL PRIMARY KEY,
  reseller_id INTEGER NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
  order_id INTEGER, -- Reference to order/invoice
  sale_amount DECIMAL(10, 2) NOT NULL,
  commission_rate DECIMAL(5, 2) NOT NULL,
  commission_amount DECIMAL(10, 2) NOT NULL,
  product_type VARCHAR(100),
  product_id INTEGER,
  status VARCHAR(50) DEFAULT 'pending', -- pending, paid
  payout_id INTEGER, -- Reference to payout
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reseller_commissions_reseller ON reseller_commissions(reseller_id);
CREATE INDEX idx_reseller_commissions_status ON reseller_commissions(status);
CREATE INDEX idx_reseller_commissions_created ON reseller_commissions(created_at DESC);

-- Reseller Payouts
CREATE TABLE IF NOT EXISTS reseller_payouts (
  id SERIAL PRIMARY KEY,
  reseller_id INTEGER NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  commission_count INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'processing', -- processing, completed, failed
  payment_method VARCHAR(100), -- stripe, paypal, bank_transfer, etc.
  payment_reference VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_reseller_payouts_reseller ON reseller_payouts(reseller_id);
CREATE INDEX idx_reseller_payouts_status ON reseller_payouts(status);
CREATE INDEX idx_reseller_payouts_created ON reseller_payouts(created_at DESC);

-- Integration Marketplace Templates
CREATE TABLE IF NOT EXISTS integration_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100), -- zapier, make, n8n, webhook, oauth
  logo_url VARCHAR(500),
  config_schema JSONB, -- JSON schema for configuration
  is_featured BOOLEAN DEFAULT false,
  install_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_integration_templates_category ON integration_templates(category);
CREATE INDEX idx_integration_templates_featured ON integration_templates(is_featured);

-- Installed Integrations
CREATE TABLE IF NOT EXISTS installed_integrations (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id INTEGER REFERENCES integration_templates(id),
  name VARCHAR(255) NOT NULL,
  config JSONB NOT NULL, -- Integration-specific configuration
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_installed_integrations_tenant ON installed_integrations(tenant_id);
CREATE INDEX idx_installed_integrations_template ON installed_integrations(template_id);

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

CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON webhooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oauth_applications_updated_at BEFORE UPDATE ON oauth_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_branding_updated_at BEFORE UPDATE ON branding_configurations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resellers_updated_at BEFORE UPDATE ON resellers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_installed_integrations_updated_at BEFORE UPDATE ON installed_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Cleanup old webhook deliveries (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_deliveries()
RETURNS void AS $$
BEGIN
  -- Delete successful deliveries older than 30 days
  DELETE FROM webhook_deliveries 
  WHERE status = 'success' 
    AND created_at < NOW() - INTERVAL '30 days';
  
  -- Delete failed deliveries older than 90 days
  DELETE FROM webhook_deliveries 
  WHERE status = 'failed' 
    AND created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Cleanup expired OAuth codes and tokens
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_tokens()
RETURNS void AS $$
BEGIN
  -- Delete used or expired authorization codes
  DELETE FROM oauth_authorization_codes 
  WHERE used_at IS NOT NULL 
    OR expires_at < NOW();
  
  -- Delete expired refresh tokens
  DELETE FROM oauth_refresh_tokens 
  WHERE expires_at < NOW()
    OR revoked_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql;
