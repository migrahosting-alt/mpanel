-- Create installed_apps table
CREATE TABLE IF NOT EXISTS installed_apps (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  website_id INTEGER NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  app_type VARCHAR(50) NOT NULL, -- wordpress, laravel, nodejs, etc.
  app_name VARCHAR(255) NOT NULL,
  version VARCHAR(50),
  domain VARCHAR(255) NOT NULL,
  config JSONB,
  status VARCHAR(50) DEFAULT 'installing', -- installing, installed, failed, uninstalling
  error TEXT,
  installed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_installed_apps_user_id ON installed_apps(user_id);
CREATE INDEX idx_installed_apps_website_id ON installed_apps(website_id);
CREATE INDEX idx_installed_apps_app_type ON installed_apps(app_type);
CREATE INDEX idx_installed_apps_status ON installed_apps(status);

-- Add comments
COMMENT ON TABLE installed_apps IS 'Installed applications and their configurations';
COMMENT ON COLUMN installed_apps.app_type IS 'Type of application: wordpress, laravel, nodejs, nextjs, django, moodle, ghost, drupal';
COMMENT ON COLUMN installed_apps.config IS 'JSON configuration including database credentials and app settings';
COMMENT ON COLUMN installed_apps.status IS 'Installation status: installing, installed, failed, uninstalling';
