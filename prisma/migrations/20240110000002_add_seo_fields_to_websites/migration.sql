-- Migration: Add SEO fields to websites table
-- Created: 2024-01-10

-- Add SEO-related columns to websites table
ALTER TABLE websites
  ADD COLUMN IF NOT EXISTS meta_title VARCHAR(70),
  ADD COLUMN IF NOT EXISTS meta_description VARCHAR(160),
  ADD COLUMN IF NOT EXISTS meta_keywords TEXT,
  ADD COLUMN IF NOT EXISTS robots_meta VARCHAR(100) DEFAULT 'index, follow',
  ADD COLUMN IF NOT EXISTS og_title VARCHAR(100),
  ADD COLUMN IF NOT EXISTS og_description VARCHAR(200),
  ADD COLUMN IF NOT EXISTS og_image VARCHAR(500),
  ADD COLUMN IF NOT EXISTS sitemap_generated_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS sitemap_submitted_at TIMESTAMP;

-- Create index for sitemap timestamps
CREATE INDEX IF NOT EXISTS idx_websites_sitemap_generated ON websites(sitemap_generated_at);

-- Add comments
COMMENT ON COLUMN websites.meta_title IS 'SEO meta title (max 70 characters)';
COMMENT ON COLUMN websites.meta_description IS 'SEO meta description (max 160 characters)';
COMMENT ON COLUMN websites.meta_keywords IS 'SEO keywords (comma-separated)';
COMMENT ON COLUMN websites.robots_meta IS 'Robots meta tag directive';
COMMENT ON COLUMN websites.og_title IS 'Open Graph title for social sharing';
COMMENT ON COLUMN websites.og_description IS 'Open Graph description for social sharing';
COMMENT ON COLUMN websites.og_image IS 'Open Graph image URL for social sharing';
COMMENT ON COLUMN websites.sitemap_generated_at IS 'Last sitemap generation timestamp';
COMMENT ON COLUMN websites.sitemap_submitted_at IS 'Last sitemap submission to search engines timestamp';
