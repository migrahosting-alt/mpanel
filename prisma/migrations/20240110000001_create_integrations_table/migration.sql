-- Migration: Create integrations table
-- Created: 2024-01-10

-- Create integrations table
CREATE TABLE IF NOT EXISTS integrations (
  id SERIAL PRIMARY KEY,
  website_id INTEGER NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,  -- 'analytics', 'seo', 'business', 'social_media'
  provider VARCHAR(100) NOT NULL,  -- 'google_analytics', 'facebook_pixel', etc.
  config JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(50) NOT NULL DEFAULT 'active',  -- 'active', 'pending_verification', 'inactive', 'error'
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  UNIQUE (website_id, type, provider)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_integrations_website_id ON integrations(website_id);
CREATE INDEX IF NOT EXISTS idx_integrations_type ON integrations(type);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations(status);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_integrations_updated_at();

-- Add comments
COMMENT ON TABLE integrations IS 'Third-party integrations for websites';
COMMENT ON COLUMN integrations.type IS 'Type of integration: analytics, seo, business, social_media';
COMMENT ON COLUMN integrations.provider IS 'Provider name: google_analytics, facebook_pixel, etc.';
COMMENT ON COLUMN integrations.config IS 'JSON configuration for the integration';
COMMENT ON COLUMN integrations.status IS 'Current status: active, pending_verification, inactive, error';
