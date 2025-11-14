-- Create api_keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix VARCHAR(20) NOT NULL,
  permissions JSONB DEFAULT '["read"]',
  revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMP,
  last_used TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create webhooks table
CREATE TABLE IF NOT EXISTS webhooks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events JSONB NOT NULL, -- Array of event types to listen for
  secret TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create webhook_deliveries table
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id SERIAL PRIMARY KEY,
  webhook_id INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  status_code INTEGER,
  response TEXT,
  success BOOLEAN DEFAULT false,
  error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_revoked ON api_keys(revoked) WHERE revoked = false;
CREATE INDEX idx_webhooks_user_id ON webhooks(user_id);
CREATE INDEX idx_webhooks_enabled ON webhooks(enabled) WHERE enabled = true;
CREATE INDEX idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_created_at ON webhook_deliveries(created_at DESC);

-- Add comments
COMMENT ON TABLE api_keys IS 'API keys for programmatic access';
COMMENT ON TABLE webhooks IS 'Webhook endpoints for event notifications';
COMMENT ON TABLE webhook_deliveries IS 'Log of webhook delivery attempts';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA256 hash of the API key';
COMMENT ON COLUMN api_keys.key_prefix IS 'First 15 characters of key for display';
COMMENT ON COLUMN api_keys.permissions IS 'Array of permissions: read, write, admin';
COMMENT ON COLUMN webhooks.events IS 'Array of events to trigger on: server.created, domain.updated, etc.';
COMMENT ON COLUMN webhooks.secret IS 'Secret for HMAC signature verification';
