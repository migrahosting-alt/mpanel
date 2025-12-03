-- Create tenant_branding table for white-label customization
-- Migration: 20241111000011_create_tenant_branding_table

CREATE TABLE IF NOT EXISTS tenant_branding (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_name VARCHAR(255),
  logo_url VARCHAR(500),
  favicon_url VARCHAR(500),
  theme JSONB DEFAULT '{}',
  custom_css TEXT,
  custom_domain VARCHAR(255),
  email_from_name VARCHAR(255),
  email_from_address VARCHAR(255),
  support_email VARCHAR(255),
  support_phone VARCHAR(50),
  footer_text TEXT,
  privacy_policy_url VARCHAR(500),
  terms_of_service_url VARCHAR(500),
  meta_title VARCHAR(255),
  meta_description TEXT,
  meta_keywords TEXT,
  social_links JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for tenant_branding
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_branding_tenant_id 
  ON tenant_branding(tenant_id) WHERE is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_branding_custom_domain 
  ON tenant_branding(custom_domain) WHERE custom_domain IS NOT NULL AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_tenant_branding_active ON tenant_branding(is_active);
CREATE INDEX IF NOT EXISTS idx_tenant_branding_created_at ON tenant_branding(created_at DESC);

-- GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_tenant_branding_theme ON tenant_branding USING GIN (theme);
CREATE INDEX IF NOT EXISTS idx_tenant_branding_social_links ON tenant_branding USING GIN (social_links);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_tenant_branding_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tenant_branding_updated_at
  BEFORE UPDATE ON tenant_branding
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_branding_updated_at();

-- Analyze table for query optimization
ANALYZE tenant_branding;
