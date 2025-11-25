-- Provisioning Tables Migration
-- Creates tables for automated service provisioning

-- Servers table - hosting servers that run cPanel/Plesk/DirectAdmin
CREATE TABLE IF NOT EXISTS servers (
  id SERIAL PRIMARY KEY,
  hostname VARCHAR(255) NOT NULL UNIQUE,
  ip_address VARCHAR(45) NOT NULL,
  control_panel VARCHAR(50), -- 'cpanel', 'plesk', 'directadmin', 'custom'
  control_panel_url VARCHAR(255),
  api_token TEXT,
  api_username VARCHAR(100),
  api_password_encrypted TEXT,
  db_host VARCHAR(255) DEFAULT 'localhost',
  max_accounts INTEGER DEFAULT 500,
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'disabled', 'maintenance'
  location VARCHAR(100),
  nameserver1 VARCHAR(255),
  nameserver2 VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Provisioning tasks table - tracks provisioning progress
CREATE TABLE IF NOT EXISTS provisioning_tasks (
  id SERIAL PRIMARY KEY,
  service_id INTEGER REFERENCES services(id),
  customer_id INTEGER REFERENCES customers(id),
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  result_data JSONB, -- Stores results from each step
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- Add provisioning-related columns to services table
ALTER TABLE services 
  ADD COLUMN IF NOT EXISTS username VARCHAR(50),
  ADD COLUMN IF NOT EXISTS password_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS server_id INTEGER REFERENCES servers(id),
  ADD COLUMN IF NOT EXISTS provisioning_error TEXT,
  ADD COLUMN IF NOT EXISTS provisioned_at TIMESTAMP;

-- Add server_id to websites table
ALTER TABLE websites
  ADD COLUMN IF NOT EXISTS server_id INTEGER REFERENCES servers(id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_provisioning_tasks_service_id ON provisioning_tasks(service_id);
CREATE INDEX IF NOT EXISTS idx_provisioning_tasks_status ON provisioning_tasks(status);
CREATE INDEX IF NOT EXISTS idx_provisioning_tasks_created_at ON provisioning_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_services_server_id ON services(server_id);
CREATE INDEX IF NOT EXISTS idx_services_username ON services(username);
CREATE INDEX IF NOT EXISTS idx_servers_status ON servers(status);

-- Insert sample server (localhost for development)
INSERT INTO servers (
  hostname, 
  ip_address, 
  control_panel, 
  control_panel_url,
  status,
  location,
  nameserver1,
  nameserver2
) VALUES (
  'localhost.dev',
  '127.0.0.1',
  'cpanel',
  'https://localhost:2087',
  'active',
  'Development',
  'ns1.migrahosting.com',
  'ns2.migrahosting.com'
) ON CONFLICT (hostname) DO NOTHING;

-- Add comment documentation
COMMENT ON TABLE servers IS 'Physical/virtual servers that host customer accounts';
COMMENT ON TABLE provisioning_tasks IS 'Tracks automated provisioning job status';
COMMENT ON COLUMN services.username IS 'cPanel/Plesk account username';
COMMENT ON COLUMN services.password_encrypted IS 'Encrypted account password';
COMMENT ON COLUMN services.server_id IS 'Server where this service is hosted';
