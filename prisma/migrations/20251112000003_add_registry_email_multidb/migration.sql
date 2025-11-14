-- Container Registry, Email Marketing, Multi-Database Support Migration

-- ============================================
-- Container Registry Tables
-- ============================================

CREATE TABLE IF NOT EXISTS container_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  tag VARCHAR(100) NOT NULL,
  registry_url VARCHAR(500) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, available, vulnerable, scan_failed
  scan_status VARCHAR(50) DEFAULT 'pending', -- pending, scanning, scanned, vulnerable, scan_failed
  vulnerability_count INTEGER DEFAULT 0,
  size_bytes BIGINT,
  public BOOLEAN DEFAULT false,
  signed BOOLEAN DEFAULT false,
  signature VARCHAR(500),
  push_count INTEGER DEFAULT 0,
  pull_count INTEGER DEFAULT 0,
  pushed_at TIMESTAMP,
  last_pulled_at TIMESTAMP,
  last_scanned_at TIMESTAMP,
  signed_at TIMESTAMP,
  built_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, name, tag)
);

CREATE INDEX idx_container_images_user ON container_images(user_id);
CREATE INDEX idx_container_images_tenant ON container_images(tenant_id);
CREATE INDEX idx_container_images_status ON container_images(status);
CREATE INDEX idx_container_images_scan_status ON container_images(scan_status);

CREATE TABLE IF NOT EXISTS image_scan_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id UUID NOT NULL REFERENCES container_images(id) ON DELETE CASCADE,
  scanner VARCHAR(50) NOT NULL, -- trivy, clair, etc.
  scan_data JSONB NOT NULL,
  vulnerability_count INTEGER DEFAULT 0,
  critical_count INTEGER DEFAULT 0,
  high_count INTEGER DEFAULT 0,
  medium_count INTEGER DEFAULT 0,
  low_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_scan_results_image ON image_scan_results(image_id);
CREATE INDEX idx_scan_results_created ON image_scan_results(created_at DESC);

-- ============================================
-- Email Marketing Tables
-- ============================================

CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  from_name VARCHAR(255) NOT NULL,
  from_email VARCHAR(255) NOT NULL,
  reply_to VARCHAR(255),
  template_id UUID REFERENCES email_templates(id),
  segment_id UUID,
  status VARCHAR(50) DEFAULT 'draft', -- draft, scheduled, sending, sent, cancelled
  scheduled_at TIMESTAMP,
  sent_at TIMESTAMP,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  bounce_count INTEGER DEFAULT 0,
  unsubscribe_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_campaigns_tenant ON email_campaigns(tenant_id);
CREATE INDEX idx_email_campaigns_status ON email_campaigns(status);
CREATE INDEX idx_email_campaigns_scheduled ON email_campaigns(scheduled_at);

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  html_content TEXT,
  text_content TEXT,
  category VARCHAR(100),
  thumbnail_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_templates_tenant ON email_templates(tenant_id);
CREATE INDEX idx_email_templates_category ON email_templates(category);

CREATE TABLE IF NOT EXISTS email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL,
  tracking_id UUID DEFAULT gen_random_uuid(),
  status VARCHAR(50) DEFAULT 'pending', -- pending, sent, failed, bounced
  opened BOOLEAN DEFAULT false,
  clicked BOOLEAN DEFAULT false,
  bounced BOOLEAN DEFAULT false,
  unsubscribed BOOLEAN DEFAULT false,
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  bounced_at TIMESTAMP,
  unsubscribed_at TIMESTAMP,
  error_message TEXT,
  sent_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_sends_campaign ON email_sends(campaign_id);
CREATE INDEX idx_email_sends_tracking ON email_sends(tracking_id);
CREATE INDEX idx_email_sends_user ON email_sends(user_id);

CREATE TABLE IF NOT EXISTS email_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id UUID NOT NULL,
  url TEXT NOT NULL,
  clicked_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_clicks_tracking ON email_clicks(tracking_id);

CREATE TABLE IF NOT EXISTS drip_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  trigger_event VARCHAR(100) NOT NULL, -- signup, purchase, abandoned_cart, etc.
  segment_id UUID,
  status VARCHAR(50) DEFAULT 'draft', -- draft, active, paused
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_drip_campaigns_tenant ON drip_campaigns(tenant_id);
CREATE INDEX idx_drip_campaigns_status ON drip_campaigns(status);

CREATE TABLE IF NOT EXISTS drip_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drip_campaign_id UUID NOT NULL REFERENCES drip_campaigns(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  subject VARCHAR(500) NOT NULL,
  template_id UUID REFERENCES email_templates(id),
  delay_days INTEGER DEFAULT 0,
  delay_hours INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_drip_emails_campaign ON drip_emails(drip_campaign_id);

CREATE TABLE IF NOT EXISTS drip_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drip_campaign_id UUID NOT NULL REFERENCES drip_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'active', -- active, completed, unsubscribed
  subscribed_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  unsubscribed_at TIMESTAMP
);

CREATE INDEX idx_drip_subscribers_campaign ON drip_subscribers(drip_campaign_id);
CREATE INDEX idx_drip_subscribers_user ON drip_subscribers(user_id);

CREATE TABLE IF NOT EXISTS drip_email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES drip_subscribers(id) ON DELETE CASCADE,
  drip_email_id UUID NOT NULL REFERENCES drip_emails(id) ON DELETE CASCADE,
  sent_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  variant_a_subject VARCHAR(500) NOT NULL,
  variant_a_template_id UUID REFERENCES email_templates(id),
  variant_b_subject VARCHAR(500) NOT NULL,
  variant_b_template_id UUID REFERENCES email_templates(id),
  test_percentage INTEGER DEFAULT 50,
  segment_id UUID,
  status VARCHAR(50) DEFAULT 'draft', -- draft, active, completed
  winner_variant VARCHAR(1), -- A or B
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ab_tests_tenant ON ab_tests(tenant_id);
CREATE INDEX idx_ab_tests_status ON ab_tests(status);

-- ============================================
-- Multi-Database Management Tables
-- ============================================

ALTER TABLE databases ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'postgresql'; -- postgresql, mysql, mariadb, mongodb, redis
ALTER TABLE databases ADD COLUMN IF NOT EXISTS version VARCHAR(50);
ALTER TABLE databases ADD COLUMN IF NOT EXISTS size VARCHAR(50) DEFAULT 'small'; -- small, medium, large
ALTER TABLE databases ADD COLUMN IF NOT EXISTS replication_enabled BOOLEAN DEFAULT false;
ALTER TABLE databases ADD COLUMN IF NOT EXISTS sharding_enabled BOOLEAN DEFAULT false;
ALTER TABLE databases ADD COLUMN IF NOT EXISTS connection_string TEXT;
ALTER TABLE databases ADD COLUMN IF NOT EXISTS username VARCHAR(255);
ALTER TABLE databases ADD COLUMN IF NOT EXISTS password_hash VARCHAR(500);
ALTER TABLE databases ADD COLUMN IF NOT EXISTS provisioned_at TIMESTAMP;
ALTER TABLE databases ADD COLUMN IF NOT EXISTS failover_at TIMESTAMP;
ALTER TABLE databases ADD COLUMN IF NOT EXISTS error_message TEXT;

CREATE TABLE IF NOT EXISTS database_replicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id UUID NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL, -- master, replica
  status VARCHAR(50) DEFAULT 'provisioning', -- provisioning, active, failed
  lag_seconds INTEGER DEFAULT 0,
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_database_replicas_database ON database_replicas(database_id);
CREATE INDEX idx_database_replicas_server ON database_replicas(server_id);

CREATE TABLE IF NOT EXISTS database_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id UUID NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  size_bytes BIGINT,
  connections_count INTEGER,
  queries_per_second DECIMAL(10, 2),
  cache_hit_ratio DECIMAL(5, 2),
  replication_lag_seconds INTEGER,
  cpu_usage DECIMAL(5, 2),
  memory_usage BIGINT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_database_metrics_database ON database_metrics(database_id);
CREATE INDEX idx_database_metrics_created ON database_metrics(created_at DESC);

CREATE TABLE IF NOT EXISTS slow_query_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id UUID NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  query_time DECIMAL(10, 6) NOT NULL,
  lock_time DECIMAL(10, 6),
  rows_examined INTEGER,
  rows_sent INTEGER,
  executed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_slow_query_database ON slow_query_log(database_id);
CREATE INDEX idx_slow_query_time ON slow_query_log(query_time DESC);
CREATE INDEX idx_slow_query_executed ON slow_query_log(executed_at DESC);

CREATE TABLE IF NOT EXISTS database_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id UUID NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- full, incremental, differential
  size_bytes BIGINT,
  storage_path TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'in_progress', -- in_progress, completed, failed
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  error_message TEXT
);

CREATE INDEX idx_database_backups_database ON database_backups(database_id);
CREATE INDEX idx_database_backups_status ON database_backups(status);
CREATE INDEX idx_database_backups_started ON database_backups(started_at DESC);

-- ============================================
-- Customer Segmentation (for email marketing)
-- ============================================

CREATE TABLE IF NOT EXISTS customer_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL,
  segment_name VARCHAR(100) NOT NULL,
  added_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_customer_segments_tenant ON customer_segments(tenant_id);
CREATE INDEX idx_customer_segments_customer ON customer_segments(customer_id);
CREATE INDEX idx_customer_segments_segment ON customer_segments(segment_id);

-- ============================================
-- User Events (for drip campaign triggers)
-- ============================================

CREATE TABLE IF NOT EXISTS user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL, -- signup, login, purchase, etc.
  event_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_events_user ON user_events(user_id);
CREATE INDEX idx_user_events_type ON user_events(event_type);
CREATE INDEX idx_user_events_created ON user_events(created_at DESC);
