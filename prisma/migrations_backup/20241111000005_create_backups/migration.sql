-- Create backups table
CREATE TABLE IF NOT EXISTS backups (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- manual, scheduled, automatic
  resource_type VARCHAR(50) NOT NULL, -- website, database, email, full
  resource_id INTEGER,
  description TEXT,
  path TEXT, -- S3/MinIO path
  size BIGINT, -- Size in bytes
  status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, failed
  error TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create backup_schedules table
CREATE TABLE IF NOT EXISTS backup_schedules (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type VARCHAR(50) NOT NULL,
  resource_id INTEGER NOT NULL,
  frequency VARCHAR(50) NOT NULL, -- daily, weekly, monthly
  retention_days INTEGER DEFAULT 30,
  enabled BOOLEAN DEFAULT true,
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_backups_user_id ON backups(user_id);
CREATE INDEX idx_backups_resource ON backups(resource_type, resource_id);
CREATE INDEX idx_backups_status ON backups(status);
CREATE INDEX idx_backups_created_at ON backups(created_at);
CREATE INDEX idx_backup_schedules_user_id ON backup_schedules(user_id);
CREATE INDEX idx_backup_schedules_next_run ON backup_schedules(next_run) WHERE enabled = true;

-- Add comments
COMMENT ON TABLE backups IS 'Backup records for websites, databases, email, and full accounts';
COMMENT ON TABLE backup_schedules IS 'Automated backup schedules';
COMMENT ON COLUMN backups.type IS 'Type of backup: manual, scheduled, or automatic';
COMMENT ON COLUMN backups.resource_type IS 'Resource being backed up: website, database, email, or full';
COMMENT ON COLUMN backups.path IS 'S3/MinIO storage path for backup file';
COMMENT ON COLUMN backup_schedules.frequency IS 'Backup frequency: daily, weekly, or monthly';
COMMENT ON COLUMN backup_schedules.retention_days IS 'Number of days to retain backups before auto-deletion';
