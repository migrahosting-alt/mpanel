-- Add hosting-specific columns to existing domains table

-- Add type column for domain classification
ALTER TABLE domains ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL DEFAULT 'primary';
COMMENT ON COLUMN domains.type IS 'Domain type: primary, addon, subdomain, alias';

-- Add document root for web hosting
ALTER TABLE domains ADD COLUMN IF NOT EXISTS document_root VARCHAR(500);
COMMENT ON COLUMN domains.document_root IS 'Physical path to domain web files';

-- Add PHP version selection
ALTER TABLE domains ADD COLUMN IF NOT EXISTS php_version VARCHAR(20) DEFAULT '8.2';
COMMENT ON COLUMN domains.php_version IS 'PHP version for this domain';

-- Add auto SSL management
ALTER TABLE domains ADD COLUMN IF NOT EXISTS auto_ssl BOOLEAN DEFAULT true;
COMMENT ON COLUMN domains.auto_ssl IS 'Automatically provision Let''s Encrypt SSL';

-- Add redirect URL and type
ALTER TABLE domains ADD COLUMN IF NOT EXISTS redirect_url VARCHAR(500);
COMMENT ON COLUMN domains.redirect_url IS 'URL to redirect this domain to';

ALTER TABLE domains ADD COLUMN IF NOT EXISTS redirect_type VARCHAR(10);
COMMENT ON COLUMN domains.redirect_type IS 'HTTP redirect type: 301 or 302';

-- Add resource usage tracking
ALTER TABLE domains ADD COLUMN IF NOT EXISTS disk_usage_mb INTEGER DEFAULT 0;
COMMENT ON COLUMN domains.disk_usage_mb IS 'Disk space used by domain in MB';

ALTER TABLE domains ADD COLUMN IF NOT EXISTS bandwidth_usage_mb INTEGER DEFAULT 0;
COMMENT ON COLUMN domains.bandwidth_usage_mb IS 'Bandwidth used this month in MB';

-- Create index on type for filtering
CREATE INDEX IF NOT EXISTS idx_domains_type ON domains(type);
