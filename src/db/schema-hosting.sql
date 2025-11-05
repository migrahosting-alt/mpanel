-- Extended schema for hosting control panel features
-- This adds servers, websites, DNS, email, databases, and system management

-- Servers/Nodes table
CREATE TABLE IF NOT EXISTS servers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    hostname VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    ip_address_v6 VARCHAR(45),
    location VARCHAR(100),
    provider VARCHAR(100),
    os VARCHAR(100),
    os_version VARCHAR(50),
    cpu_cores INT,
    ram_mb INT,
    disk_gb INT,
    role VARCHAR(50) DEFAULT 'web', -- web, database, email, dns, backup
    status VARCHAR(50) DEFAULT 'active', -- active, maintenance, offline
    agent_version VARCHAR(50),
    agent_last_seen TIMESTAMP,
    tags JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Websites/Applications table
CREATE TABLE IF NOT EXISTS websites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    server_id UUID REFERENCES servers(id),
    subscription_id UUID REFERENCES subscriptions(id),
    name VARCHAR(255) NOT NULL,
    primary_domain VARCHAR(255) NOT NULL,
    additional_domains JSONB DEFAULT '[]',
    document_root VARCHAR(500),
    app_type VARCHAR(50) DEFAULT 'php', -- php, node, python, static, wordpress, laravel
    app_version VARCHAR(50),
    php_version VARCHAR(10),
    node_version VARCHAR(10),
    python_version VARCHAR(10),
    ssl_enabled BOOLEAN DEFAULT FALSE,
    ssl_provider VARCHAR(50), -- letsencrypt, custom, none
    ssl_expires_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active', -- active, suspended, deploying, error
    deploy_source VARCHAR(50), -- manual, git, ftp
    git_repo VARCHAR(500),
    git_branch VARCHAR(100),
    env_variables JSONB DEFAULT '{}',
    system_user VARCHAR(100),
    last_deployed_at TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- DNS Zones table
CREATE TABLE IF NOT EXISTS dns_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    domain_id UUID REFERENCES domains(id),
    name VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(10) DEFAULT 'MASTER', -- MASTER, SLAVE, NATIVE
    master VARCHAR(255),
    account VARCHAR(40),
    dnssec BOOLEAN DEFAULT FALSE,
    serial BIGINT DEFAULT 1,
    status VARCHAR(50) DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- DNS Records table
CREATE TABLE IF NOT EXISTS dns_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_id UUID REFERENCES dns_zones(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(10) NOT NULL, -- A, AAAA, CNAME, MX, TXT, SRV, CAA, NS, PTR
    content TEXT NOT NULL,
    ttl INT DEFAULT 3600,
    priority INT,
    disabled BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email Mailboxes table
CREATE TABLE IF NOT EXISTS mailboxes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    domain_id UUID REFERENCES domains(id),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    quota_mb INT DEFAULT 1024,
    used_mb INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active', -- active, suspended, deleted
    forward_to VARCHAR(255),
    is_catch_all BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Databases table
CREATE TABLE IF NOT EXISTS databases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    server_id UUID REFERENCES servers(id),
    website_id UUID REFERENCES websites(id),
    name VARCHAR(255) NOT NULL,
    db_type VARCHAR(20) NOT NULL, -- postgresql, mysql, mariadb
    db_user VARCHAR(255) NOT NULL,
    db_password_hash VARCHAR(255),
    db_host VARCHAR(255) DEFAULT 'localhost',
    db_port INT DEFAULT 5432,
    charset VARCHAR(50) DEFAULT 'utf8mb4',
    collation VARCHAR(50),
    size_mb INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',
    connection_string TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(server_id, name)
);

-- FTP/SFTP Accounts table
CREATE TABLE IF NOT EXISTS ftp_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    server_id UUID REFERENCES servers(id),
    website_id UUID REFERENCES websites(id),
    username VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    protocol VARCHAR(10) DEFAULT 'sftp', -- ftp, sftp
    home_directory VARCHAR(500) NOT NULL,
    allowed_paths JSONB DEFAULT '[]',
    quota_mb INT,
    status VARCHAR(50) DEFAULT 'active',
    last_login TIMESTAMP,
    ssh_key TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(server_id, username)
);

-- Cron Jobs table
CREATE TABLE IF NOT EXISTS cron_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    server_id UUID REFERENCES servers(id),
    website_id UUID REFERENCES websites(id),
    name VARCHAR(255) NOT NULL,
    command TEXT NOT NULL,
    schedule VARCHAR(100) NOT NULL, -- cron expression
    enabled BOOLEAN DEFAULT TRUE,
    run_as_user VARCHAR(100),
    timeout_seconds INT DEFAULT 300,
    last_run TIMESTAMP,
    last_status VARCHAR(50),
    last_output TEXT,
    next_run TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backups table (extended)
CREATE TABLE IF NOT EXISTS backups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    backup_type VARCHAR(50) NOT NULL, -- website, database, dns, full, email
    source_id UUID, -- website_id, database_id, etc.
    server_id UUID REFERENCES servers(id),
    filename VARCHAR(500) NOT NULL,
    storage_path VARCHAR(1000),
    storage_provider VARCHAR(50) DEFAULT 'minio', -- minio, s3, local
    size_mb INT,
    compression VARCHAR(20) DEFAULT 'gzip',
    encrypted BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'completed', -- pending, in_progress, completed, failed
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    expires_at TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Background Jobs/Tasks Queue
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    job_type VARCHAR(100) NOT NULL, -- provision_website, backup, ssl_renew, deploy_app, etc.
    entity_type VARCHAR(50), -- website, database, mailbox, etc.
    entity_id UUID,
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed, cancelled
    priority INT DEFAULT 5,
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    payload JSONB DEFAULT '{}',
    result JSONB,
    error TEXT,
    scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    correlation_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Server Metrics (time-series data)
CREATE TABLE IF NOT EXISTS server_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
    metric_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cpu_usage DECIMAL(5, 2),
    memory_usage_mb INT,
    memory_total_mb INT,
    disk_usage_gb DECIMAL(10, 2),
    disk_total_gb DECIMAL(10, 2),
    network_in_mbps DECIMAL(10, 2),
    network_out_mbps DECIMAL(10, 2),
    load_average_1m DECIMAL(5, 2),
    load_average_5m DECIMAL(5, 2),
    load_average_15m DECIMAL(5, 2),
    active_connections INT,
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for performance
CREATE INDEX idx_servers_tenant ON servers(tenant_id);
CREATE INDEX idx_servers_status ON servers(status);
CREATE INDEX idx_websites_tenant_customer ON websites(tenant_id, customer_id);
CREATE INDEX idx_websites_server ON websites(server_id);
CREATE INDEX idx_websites_primary_domain ON websites(primary_domain);
CREATE INDEX idx_dns_zones_name ON dns_zones(name);
CREATE INDEX idx_dns_records_zone ON dns_records(zone_id);
CREATE INDEX idx_dns_records_name_type ON dns_records(name, type);
CREATE INDEX idx_mailboxes_email ON mailboxes(email);
CREATE INDEX idx_mailboxes_domain ON mailboxes(domain_id);
CREATE INDEX idx_databases_server ON databases(server_id);
CREATE INDEX idx_databases_website ON databases(website_id);
CREATE INDEX idx_ftp_accounts_server_username ON ftp_accounts(server_id, username);
CREATE INDEX idx_cron_jobs_server ON cron_jobs(server_id);
CREATE INDEX idx_cron_jobs_website ON cron_jobs(website_id);
CREATE INDEX idx_cron_jobs_next_run ON cron_jobs(next_run) WHERE enabled = TRUE;
CREATE INDEX idx_backups_source ON backups(source_id, backup_type);
CREATE INDEX idx_backups_expires ON backups(expires_at);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_scheduled ON jobs(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_server_metrics_server_time ON server_metrics(server_id, metric_time DESC);

-- Apply updated_at triggers
CREATE TRIGGER update_servers_updated_at BEFORE UPDATE ON servers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_websites_updated_at BEFORE UPDATE ON websites FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dns_zones_updated_at BEFORE UPDATE ON dns_zones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dns_records_updated_at BEFORE UPDATE ON dns_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mailboxes_updated_at BEFORE UPDATE ON mailboxes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_databases_updated_at BEFORE UPDATE ON databases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ftp_accounts_updated_at BEFORE UPDATE ON ftp_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cron_jobs_updated_at BEFORE UPDATE ON cron_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
