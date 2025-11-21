-- Create missing tables for complete mPanel functionality
-- Run with: docker exec mpanel-postgres psql -U mpanel -d mpanel -f prisma/migrations/complete_schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- WEBSITES / HOSTING ACCOUNTS
-- =====================================================
CREATE TABLE IF NOT EXISTS websites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  server_id INTEGER REFERENCES servers(id),
  product_id UUID REFERENCES products(id),
  domain VARCHAR(255) NOT NULL,
  username VARCHAR(100),
  password_encrypted TEXT,
  document_root VARCHAR(500),
  disk_used BIGINT DEFAULT 0,
  disk_limit BIGINT,
  bandwidth_used BIGINT DEFAULT 0,
  bandwidth_limit BIGINT,
  email_accounts INT DEFAULT 0,
  email_limit INT,
  database_count INT DEFAULT 0,
  database_limit INT,
  subdomain_count INT DEFAULT 0,
  subdomain_limit INT,
  ftp_accounts INT DEFAULT 0,
  ftp_limit INT,
  php_version VARCHAR(20),
  status VARCHAR(50) DEFAULT 'active',
  suspended_reason TEXT,
  ip_address VARCHAR(45),
  ssl_enabled BOOLEAN DEFAULT false,
  ssl_cert_id UUID,
  auto_ssl BOOLEAN DEFAULT true,
  backup_enabled BOOLEAN DEFAULT true,
  last_backup TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_websites_tenant ON websites(tenant_id);
CREATE INDEX idx_websites_user ON websites(user_id);
CREATE INDEX idx_websites_server ON websites(server_id);
CREATE INDEX idx_websites_domain ON websites(domain);
CREATE INDEX idx_websites_status ON websites(status);

-- =====================================================
-- DNS ZONES
-- =====================================================
CREATE TABLE IF NOT EXISTS dns_zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  domain_id UUID REFERENCES domains(id),
  zone_name VARCHAR(255) NOT NULL UNIQUE,
  zone_type VARCHAR(20) DEFAULT 'master',
  serial BIGINT DEFAULT extract(epoch from now())::bigint,
  refresh INT DEFAULT 3600,
  retry INT DEFAULT 600,
  expire INT DEFAULT 604800,
  minimum INT DEFAULT 86400,
  primary_ns VARCHAR(255),
  admin_email VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  dnssec_enabled BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dns_zones_tenant ON dns_zones(tenant_id);
CREATE INDEX idx_dns_zones_user ON dns_zones(user_id);
CREATE INDEX idx_dns_zones_domain ON dns_zones(domain_id);
CREATE INDEX idx_dns_zones_name ON dns_zones(zone_name);

-- =====================================================
-- DNS RECORDS
-- =====================================================
CREATE TABLE IF NOT EXISTS dns_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zone_id UUID REFERENCES dns_zones(id) ON DELETE CASCADE,
  record_type VARCHAR(10) NOT NULL,
  name VARCHAR(255) NOT NULL,
  value TEXT NOT NULL,
  ttl INT DEFAULT 3600,
  priority INT,
  weight INT,
  port INT,
  flags INT,
  tag VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dns_records_zone ON dns_records(zone_id);
CREATE INDEX idx_dns_records_type ON dns_records(record_type);
CREATE INDEX idx_dns_records_name ON dns_records(name);

-- =====================================================
-- MAILBOXES / EMAIL ACCOUNTS
-- =====================================================
CREATE TABLE IF NOT EXISTS mailboxes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  website_id UUID REFERENCES websites(id),
  domain_id UUID REFERENCES domains(id),
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(100) NOT NULL,
  password_hash TEXT NOT NULL,
  quota_mb INT DEFAULT 1024,
  used_mb INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  forward_to TEXT,
  is_catchall BOOLEAN DEFAULT false,
  spam_filter_enabled BOOLEAN DEFAULT true,
  auto_reply_enabled BOOLEAN DEFAULT false,
  auto_reply_message TEXT,
  auto_reply_start TIMESTAMP,
  auto_reply_end TIMESTAMP,
  last_login TIMESTAMP,
  imap_enabled BOOLEAN DEFAULT true,
  pop3_enabled BOOLEAN DEFAULT true,
  smtp_enabled BOOLEAN DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mailboxes_tenant ON mailboxes(tenant_id);
CREATE INDEX idx_mailboxes_user ON mailboxes(user_id);
CREATE INDEX idx_mailboxes_website ON mailboxes(website_id);
CREATE INDEX idx_mailboxes_email ON mailboxes(email);
CREATE INDEX idx_mailboxes_status ON mailboxes(status);

-- =====================================================
-- DATABASES
-- =====================================================
CREATE TABLE IF NOT EXISTS databases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  website_id UUID REFERENCES websites(id),
  server_id INTEGER REFERENCES servers(id),
  database_name VARCHAR(100) NOT NULL,
  database_type VARCHAR(20) DEFAULT 'mysql',
  database_user VARCHAR(100),
  database_password_encrypted TEXT,
  host VARCHAR(255),
  port INT,
  size_mb INT DEFAULT 0,
  quota_mb INT,
  charset VARCHAR(50) DEFAULT 'utf8mb4',
  collation VARCHAR(50) DEFAULT 'utf8mb4_unicode_ci',
  status VARCHAR(50) DEFAULT 'active',
  remote_access_enabled BOOLEAN DEFAULT false,
  allowed_hosts TEXT[],
  backup_enabled BOOLEAN DEFAULT true,
  last_backup TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_databases_tenant ON databases(tenant_id);
CREATE INDEX idx_databases_user ON databases(user_id);
CREATE INDEX idx_databases_website ON databases(website_id);
CREATE INDEX idx_databases_server ON databases(server_id);
CREATE INDEX idx_databases_name ON databases(database_name);
CREATE INDEX idx_databases_status ON databases(status);

-- =====================================================
-- SSL CERTIFICATES
-- =====================================================
CREATE TABLE IF NOT EXISTS ssl_certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  website_id UUID REFERENCES websites(id),
  domain_id UUID REFERENCES domains(id),
  domain_names TEXT[] NOT NULL,
  certificate_type VARCHAR(50) DEFAULT 'letsencrypt',
  issuer VARCHAR(255),
  certificate_pem TEXT,
  private_key_pem TEXT,
  chain_pem TEXT,
  issued_at TIMESTAMP,
  expires_at TIMESTAMP,
  auto_renew BOOLEAN DEFAULT true,
  status VARCHAR(50) DEFAULT 'pending',
  validation_method VARCHAR(50) DEFAULT 'http-01',
  acme_order_url TEXT,
  last_renewal_attempt TIMESTAMP,
  renewal_failures INT DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ssl_tenant ON ssl_certificates(tenant_id);
CREATE INDEX idx_ssl_user ON ssl_certificates(user_id);
CREATE INDEX idx_ssl_website ON ssl_certificates(website_id);
CREATE INDEX idx_ssl_domain ON ssl_certificates(domain_id);
CREATE INDEX idx_ssl_status ON ssl_certificates(status);
CREATE INDEX idx_ssl_expires ON ssl_certificates(expires_at);

-- =====================================================
-- BACKUPS
-- =====================================================
CREATE TABLE IF NOT EXISTS backups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  website_id UUID REFERENCES websites(id),
  database_id UUID REFERENCES databases(id),
  backup_type VARCHAR(50) NOT NULL,
  backup_method VARCHAR(50) DEFAULT 'full',
  file_path TEXT,
  file_size BIGINT,
  storage_location VARCHAR(100) DEFAULT 'local',
  storage_provider VARCHAR(50),
  storage_path TEXT,
  compression VARCHAR(20) DEFAULT 'gzip',
  encryption_enabled BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'pending',
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  retention_days INT DEFAULT 30,
  auto_delete_at TIMESTAMP,
  checksum VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_backups_tenant ON backups(tenant_id);
CREATE INDEX idx_backups_user ON backups(user_id);
CREATE INDEX idx_backups_website ON backups(website_id);
CREATE INDEX idx_backups_database ON backups(database_id);
CREATE INDEX idx_backups_type ON backups(backup_type);
CREATE INDEX idx_backups_status ON backups(status);
CREATE INDEX idx_backups_created ON backups(created_at);

-- =====================================================
-- CRON JOBS
-- =====================================================
CREATE TABLE IF NOT EXISTS cron_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  website_id UUID REFERENCES websites(id),
  name VARCHAR(255),
  command TEXT NOT NULL,
  schedule VARCHAR(100) NOT NULL,
  working_directory VARCHAR(500),
  environment_vars JSONB,
  status VARCHAR(50) DEFAULT 'active',
  last_run TIMESTAMP,
  last_exit_code INT,
  last_output TEXT,
  next_run TIMESTAMP,
  run_count INT DEFAULT 0,
  failure_count INT DEFAULT 0,
  email_on_failure BOOLEAN DEFAULT false,
  notification_email VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cron_tenant ON cron_jobs(tenant_id);
CREATE INDEX idx_cron_user ON cron_jobs(user_id);
CREATE INDEX idx_cron_website ON cron_jobs(website_id);
CREATE INDEX idx_cron_status ON cron_jobs(status);

-- =====================================================
-- FILE UPLOADS / ATTACHMENTS
-- =====================================================
CREATE TABLE IF NOT EXISTS file_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  file_size BIGINT,
  file_path TEXT NOT NULL,
  storage_location VARCHAR(100) DEFAULT 'local',
  public_url TEXT,
  thumbnail_url TEXT,
  entity_type VARCHAR(50),
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_file_uploads_tenant ON file_uploads(tenant_id);
CREATE INDEX idx_file_uploads_user ON file_uploads(user_id);
CREATE INDEX idx_file_uploads_entity ON file_uploads(entity_type, entity_id);

-- =====================================================
-- AUDIT LOGS
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID,
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  changes JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  status VARCHAR(20) DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- =====================================================
-- NOTIFICATIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  link VARCHAR(500),
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  priority VARCHAR(20) DEFAULT 'normal',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_tenant ON notifications(tenant_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created ON notifications(created_at);

-- =====================================================
-- UPDATE TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for all tables
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN 
    SELECT table_name 
    FROM information_schema.columns 
    WHERE column_name = 'updated_at' 
    AND table_schema = 'public'
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS update_%I_updated_at ON %I;
      CREATE TRIGGER update_%I_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    ', t, t, t, t);
  END LOOP;
END;
$$;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mpanel;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mpanel;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ All missing tables created successfully!';
  RAISE NOTICE '📊 Tables created: websites, dns_zones, dns_records, mailboxes, databases, ssl_certificates, backups, cron_jobs, file_uploads, audit_logs, notifications';
END $$;
