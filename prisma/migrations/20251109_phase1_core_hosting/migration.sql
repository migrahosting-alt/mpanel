-- Phase 1: Core Hosting Features Migration
-- Domains, SSL, DNS, Email, Databases, File Manager, Backups

-- Domains Table
CREATE TABLE IF NOT EXISTS domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain_name VARCHAR(255) NOT NULL UNIQUE,
  type VARCHAR(50) NOT NULL DEFAULT 'primary', -- primary, addon, subdomain, alias
  document_root VARCHAR(500),
  php_version VARCHAR(20) DEFAULT '8.2',
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, suspended, pending
  auto_ssl BOOLEAN DEFAULT true,
  redirect_url VARCHAR(500),
  redirect_type VARCHAR(10), -- 301, 302
  disk_usage_mb INTEGER DEFAULT 0,
  bandwidth_usage_mb INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_domains_tenant ON domains(tenant_id);
CREATE INDEX idx_domains_user ON domains(user_id);
CREATE INDEX idx_domains_name ON domains(domain_name);

-- SSL Certificates Table
CREATE TABLE IF NOT EXISTS ssl_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL DEFAULT 'letsencrypt', -- letsencrypt, custom, self-signed
  certificate TEXT,
  private_key TEXT,
  certificate_chain TEXT,
  issuer VARCHAR(255),
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  auto_renew BOOLEAN DEFAULT true,
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, expired, pending, failed
  last_renewal_attempt TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ssl_domain ON ssl_certificates(domain_id);
CREATE INDEX idx_ssl_expiry ON ssl_certificates(valid_until);

-- DNS Zones Table
CREATE TABLE IF NOT EXISTS dns_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  domain_id UUID REFERENCES domains(id) ON DELETE CASCADE,
  zone_name VARCHAR(255) NOT NULL UNIQUE,
  type VARCHAR(50) NOT NULL DEFAULT 'MASTER', -- MASTER, SLAVE
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  soa_serial BIGINT,
  soa_refresh INTEGER DEFAULT 3600,
  soa_retry INTEGER DEFAULT 1800,
  soa_expire INTEGER DEFAULT 604800,
  soa_ttl INTEGER DEFAULT 86400,
  primary_ns VARCHAR(255) DEFAULT 'ns1.migrahosting.com',
  admin_email VARCHAR(255) DEFAULT 'admin@migrahosting.com',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dns_zones_tenant ON dns_zones(tenant_id);
CREATE INDEX idx_dns_zones_name ON dns_zones(zone_name);

-- DNS Records Table
CREATE TABLE IF NOT EXISTS dns_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES dns_zones(id) ON DELETE CASCADE,
  record_type VARCHAR(20) NOT NULL, -- A, AAAA, CNAME, MX, TXT, SRV, CAA, NS, PTR
  name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  ttl INTEGER DEFAULT 3600,
  priority INTEGER, -- For MX, SRV records
  weight INTEGER, -- For SRV records
  port INTEGER, -- For SRV records
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dns_records_zone ON dns_records(zone_id);
CREATE INDEX idx_dns_records_type ON dns_records(record_type);

-- Email Accounts Table
CREATE TABLE IF NOT EXISTS email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  email_address VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  quota_mb INTEGER DEFAULT 1024, -- 1GB default
  usage_mb INTEGER DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, suspended, disabled
  spam_filter_enabled BOOLEAN DEFAULT true,
  spam_threshold INTEGER DEFAULT 5,
  auto_responder_enabled BOOLEAN DEFAULT false,
  auto_responder_subject VARCHAR(255),
  auto_responder_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_accounts_tenant ON email_accounts(tenant_id);
CREATE INDEX idx_email_accounts_domain ON email_accounts(domain_id);
CREATE INDEX idx_email_accounts_address ON email_accounts(email_address);

-- Email Forwarders Table
CREATE TABLE IF NOT EXISTS email_forwarders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  source_address VARCHAR(255) NOT NULL,
  destination_address VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_forwarders_tenant ON email_forwarders(tenant_id);
CREATE INDEX idx_email_forwarders_source ON email_forwarders(source_address);

-- Databases Table
CREATE TABLE IF NOT EXISTS hosting_databases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  database_name VARCHAR(255) NOT NULL UNIQUE,
  database_type VARCHAR(50) NOT NULL DEFAULT 'mysql', -- mysql, postgresql
  db_collation VARCHAR(50) DEFAULT 'utf8mb4_unicode_ci',
  size_mb INTEGER DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hosting_databases_tenant ON hosting_databases(tenant_id);
CREATE INDEX idx_hosting_databases_user ON hosting_databases(user_id);

-- Database Users Table
CREATE TABLE IF NOT EXISTS database_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id UUID NOT NULL REFERENCES hosting_databases(id) ON DELETE CASCADE,
  username VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  privileges TEXT, -- JSON array of privileges
  remote_access BOOLEAN DEFAULT false,
  allowed_hosts TEXT, -- Comma-separated list
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_database_users_database ON database_users(database_id);

-- FTP Accounts Table
CREATE TABLE IF NOT EXISTS ftp_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  home_directory VARCHAR(500) NOT NULL,
  quota_mb INTEGER DEFAULT 0, -- 0 = unlimited
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ftp_accounts_tenant ON ftp_accounts(tenant_id);
CREATE INDEX idx_ftp_accounts_user ON ftp_accounts(user_id);

-- Backups Table
CREATE TABLE IF NOT EXISTS backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  backup_type VARCHAR(50) NOT NULL, -- full, files, databases, email
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
  file_path VARCHAR(500),
  file_size_mb INTEGER,
  backup_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  retention_days INTEGER DEFAULT 30,
  expires_at TIMESTAMP,
  storage_location VARCHAR(255) DEFAULT 'local', -- local, s3, ftp
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_backups_tenant ON backups(tenant_id);
CREATE INDEX idx_backups_user ON backups(user_id);
CREATE INDEX idx_backups_date ON backups(backup_date);
CREATE INDEX idx_backups_expiry ON backups(expires_at);

-- Cron Jobs Table
CREATE TABLE IF NOT EXISTS cron_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  command TEXT NOT NULL,
  schedule VARCHAR(100) NOT NULL, -- Cron syntax
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  last_output TEXT,
  email_output BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cron_jobs_tenant ON cron_jobs(tenant_id);
CREATE INDEX idx_cron_jobs_next_run ON cron_jobs(next_run);

-- Activity Logs Table (for audit trail)
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL, -- create_domain, delete_email, etc.
  resource_type VARCHAR(50), -- domain, email, database
  resource_id UUID,
  ip_address VARCHAR(45),
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_logs_tenant ON activity_logs(tenant_id);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at);
