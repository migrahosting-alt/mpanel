-- Provisioning Tasks Migration (Adapted for existing schema)

-- Create provisioning_tasks table with UUID
CREATE TABLE IF NOT EXISTS provisioning_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  website_id UUID REFERENCES websites(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending',
  result_data JSONB,
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- Add provisioning-related columns to websites table (if not exists)
ALTER TABLE websites 
  ADD COLUMN IF NOT EXISTS username VARCHAR(50),
  ADD COLUMN IF NOT EXISTS password_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS provisioning_error TEXT,
  ADD COLUMN IF NOT EXISTS provisioned_at TIMESTAMP;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_provisioning_tasks_customer_id ON provisioning_tasks(customer_id);
CREATE INDEX IF NOT EXISTS idx_provisioning_tasks_website_id ON provisioning_tasks(website_id);
CREATE INDEX IF NOT EXISTS idx_provisioning_tasks_status ON provisioning_tasks(status);
CREATE INDEX IF NOT EXISTS idx_provisioning_tasks_created_at ON provisioning_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_websites_username ON websites(username);

-- Update servers table with control_panel_url if missing
ALTER TABLE servers 
  ADD COLUMN IF NOT EXISTS control_panel_url VARCHAR(255),
  ADD COLUMN IF NOT EXISTS api_token TEXT,
  ADD COLUMN IF NOT EXISTS api_username VARCHAR(100),
  ADD COLUMN IF NOT EXISTS api_password_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS db_host VARCHAR(255) DEFAULT 'localhost',
  ADD COLUMN IF NOT EXISTS max_accounts INTEGER DEFAULT 500,
  ADD COLUMN IF NOT EXISTS location VARCHAR(100),
  ADD COLUMN IF NOT EXISTS nameserver1 VARCHAR(255),
  ADD COLUMN IF NOT EXISTS nameserver2 VARCHAR(255);

-- Add control_panel column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'servers' AND column_name = 'control_panel'
  ) THEN
    ALTER TABLE servers ADD COLUMN control_panel VARCHAR(50);
  END IF;
END $$;

-- Comments
COMMENT ON TABLE servers IS 'Physical/virtual servers that host customer accounts';
COMMENT ON TABLE provisioning_tasks IS 'Tracks automated provisioning job status';
COMMENT ON COLUMN websites.username IS 'cPanel/Plesk account username';
COMMENT ON COLUMN websites.password_encrypted IS 'Encrypted account password';

-- Insert sample server (localhost for development) - Skip if exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM servers WHERE hostname = 'localhost.dev') THEN
    INSERT INTO servers (
      name,
      hostname, 
      ip_address, 
      control_panel, 
      control_panel_url,
      status,
      location,
      nameserver1,
      nameserver2
    ) VALUES (
      'Development Server',
      'localhost.dev',
      '127.0.0.1',
      'cpanel',
      'https://localhost:2087',
      'active',
      'Development',
      'ns1.migrahosting.com',
      'ns2.migrahosting.com'
    );
  END IF;
END $$;
