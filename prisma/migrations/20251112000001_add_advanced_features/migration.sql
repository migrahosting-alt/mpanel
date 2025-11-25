-- Migration: Add WebSocket and AI feature tables
-- Created: 2025-11-12

-- Two-Factor Authentication
CREATE TABLE IF NOT EXISTS two_factor_auth (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method VARCHAR(20) NOT NULL CHECK (method IN ('totp', 'sms', 'email', 'webauthn')),
  secret TEXT, -- Encrypted TOTP secret
  enabled BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, method)
);

CREATE INDEX idx_2fa_user_enabled ON two_factor_auth(user_id, enabled);

-- Two-Factor temporary codes (SMS/Email)
CREATE TABLE IF NOT EXISTS two_factor_codes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method VARCHAR(20) NOT NULL,
  code VARCHAR(255) NOT NULL, -- Hashed
  phone_number VARCHAR(20),
  email VARCHAR(255),
  used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_2fa_codes_user ON two_factor_codes(user_id, method, used);

-- Backup codes for 2FA
CREATE TABLE IF NOT EXISTS backup_codes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(255) NOT NULL, -- Hashed
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_backup_codes_user ON backup_codes(user_id, used);

-- Authentication logs
CREATE TABLE IF NOT EXISTS auth_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  method VARCHAR(50) NOT NULL,
  success BOOLEAN NOT NULL,
  ip_address INET,
  user_agent TEXT,
  location VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_auth_logs_user ON auth_logs(user_id, created_at DESC);
CREATE INDEX idx_auth_logs_ip ON auth_logs(ip_address, created_at DESC);

-- AI service usage tracking
CREATE TABLE IF NOT EXISTS ai_usage (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  service VARCHAR(50) NOT NULL, -- 'code_gen', 'debug', 'optimize', 'triage', etc.
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  cost DECIMAL(10, 4) DEFAULT 0,
  model VARCHAR(50),
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_user ON ai_usage(user_id, created_at DESC);
CREATE INDEX idx_ai_usage_tenant ON ai_usage(tenant_id, created_at DESC);
CREATE INDEX idx_ai_usage_service ON ai_usage(service, created_at DESC);

-- Customer intent analysis (AI predictions)
CREATE TABLE IF NOT EXISTS customer_intent_analysis (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  upgrade_probability DECIMAL(5, 2), -- 0-100%
  churn_risk VARCHAR(20), -- 'low', 'medium', 'high'
  recommended_products JSONB,
  analysis_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_intent_analysis_customer ON customer_intent_analysis(customer_id, created_at DESC);

-- Revenue forecasts (AI-generated)
CREATE TABLE IF NOT EXISTS revenue_forecasts (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  forecast_month DATE NOT NULL,
  revenue_low DECIMAL(12, 2),
  revenue_mid DECIMAL(12, 2),
  revenue_high DECIMAL(12, 2),
  confidence DECIMAL(5, 2),
  analysis_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_revenue_forecasts_tenant ON revenue_forecasts(tenant_id, forecast_month);

-- WebSocket connections tracking
CREATE TABLE IF NOT EXISTS websocket_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  socket_id VARCHAR(255) NOT NULL,
  connected_at TIMESTAMP DEFAULT NOW(),
  disconnected_at TIMESTAMP,
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_ws_sessions_user ON websocket_sessions(user_id, connected_at DESC);
CREATE INDEX idx_ws_sessions_active ON websocket_sessions(user_id) WHERE disconnected_at IS NULL;

-- Real-time notifications
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'info', -- 'info', 'success', 'warning', 'error'
  action JSONB, -- { "url": "/...", "label": "View" }
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read, created_at DESC);

-- Security audit logs (enhanced)
CREATE TABLE IF NOT EXISTS security_audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id INTEGER,
  ip_address INET,
  user_agent TEXT,
  request_data JSONB,
  response_status INTEGER,
  success BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_security_audit_user ON security_audit_logs(user_id, created_at DESC);
CREATE INDEX idx_security_audit_tenant ON security_audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_security_audit_action ON security_audit_logs(action, created_at DESC);

-- IP whitelist/blacklist
CREATE TABLE IF NOT EXISTS ip_access_control (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  ip_address INET NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('whitelist', 'blacklist')),
  reason TEXT,
  expires_at TIMESTAMP,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ip_access_tenant ON ip_access_control(tenant_id, type);
CREATE INDEX idx_ip_access_ip ON ip_access_control(ip_address);

-- Session management (enhanced)
CREATE TABLE IF NOT EXISTS user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  refresh_token_hash VARCHAR(255) UNIQUE,
  ip_address INET,
  user_agent TEXT,
  device_info JSONB,
  location VARCHAR(255),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_activity TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON user_sessions(user_id, expires_at);
CREATE INDEX idx_sessions_token ON user_sessions(token_hash);

-- API rate limiting tracking
CREATE TABLE IF NOT EXISTS api_rate_limits (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  ip_address INET,
  endpoint VARCHAR(255) NOT NULL,
  requests_count INTEGER DEFAULT 1,
  window_start TIMESTAMP DEFAULT NOW(),
  blocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rate_limits_user ON api_rate_limits(user_id, window_start DESC);
CREATE INDEX idx_rate_limits_ip ON api_rate_limits(ip_address, window_start DESC);

COMMENT ON TABLE two_factor_auth IS 'Two-factor authentication configuration for users';
COMMENT ON TABLE ai_usage IS 'AI service usage tracking for billing and analytics';
COMMENT ON TABLE customer_intent_analysis IS 'AI-powered customer behavior predictions';
COMMENT ON TABLE revenue_forecasts IS 'AI-generated revenue forecasting data';
COMMENT ON TABLE websocket_sessions IS 'Real-time WebSocket connection tracking';
COMMENT ON TABLE notifications IS 'In-app notification system';
COMMENT ON TABLE security_audit_logs IS 'Comprehensive security event audit trail';
