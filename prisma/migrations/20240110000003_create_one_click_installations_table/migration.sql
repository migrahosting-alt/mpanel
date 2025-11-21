-- Migration: Create one-click installations table
-- Created: 2024-01-10

-- Create one_click_installations table
CREATE TABLE IF NOT EXISTS one_click_installations (
  id SERIAL PRIMARY KEY,
  website_id INTEGER NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  database_id INTEGER REFERENCES databases(id) ON DELETE SET NULL,
  application VARCHAR(100) NOT NULL,  -- 'wordpress', 'joomla', 'drupal', etc.
  version VARCHAR(50) NOT NULL,
  install_path TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- 'pending', 'installing', 'installed', 'failed'
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  installed_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_one_click_installations_website_id ON one_click_installations(website_id);
CREATE INDEX IF NOT EXISTS idx_one_click_installations_database_id ON one_click_installations(database_id);
CREATE INDEX IF NOT EXISTS idx_one_click_installations_application ON one_click_installations(application);
CREATE INDEX IF NOT EXISTS idx_one_click_installations_status ON one_click_installations(status);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_one_click_installations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER one_click_installations_updated_at
  BEFORE UPDATE ON one_click_installations
  FOR EACH ROW
  EXECUTE FUNCTION update_one_click_installations_updated_at();

-- Add comments
COMMENT ON TABLE one_click_installations IS 'One-click application installations (WordPress, Joomla, etc.)';
COMMENT ON COLUMN one_click_installations.application IS 'Application name: wordpress, joomla, drupal, etc.';
COMMENT ON COLUMN one_click_installations.version IS 'Installed version of the application';
COMMENT ON COLUMN one_click_installations.install_path IS 'File system path where application is installed';
COMMENT ON COLUMN one_click_installations.config IS 'Installation configuration (admin credentials, site URL, etc.)';
COMMENT ON COLUMN one_click_installations.status IS 'Installation status: pending, installing, installed, failed';
COMMENT ON COLUMN one_click_installations.error_message IS 'Error message if installation failed';
