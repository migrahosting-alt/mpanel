-- Add comprehensive notification and enhancement tables
-- Migration: 20251117_add_notification_system

-- Notification Preferences Table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id),
  
  -- Channel preferences
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  push_enabled BOOLEAN DEFAULT false,
  webhook_enabled BOOLEAN DEFAULT false,
  
  -- Category preferences (JSON for flexibility)
  billing_notifications JSONB DEFAULT '{"email": true, "sms": false, "frequency": "instant"}'::jsonb,
  support_notifications JSONB DEFAULT '{"email": true, "sms": false, "frequency": "instant"}'::jsonb,
  marketing_notifications JSONB DEFAULT '{"email": true, "sms": false, "frequency": "weekly"}'::jsonb,
  security_notifications JSONB DEFAULT '{"email": true, "sms": true, "frequency": "instant"}'::jsonb,
  product_updates JSONB DEFAULT '{"email": true, "sms": false, "frequency": "monthly"}'::jsonb,
  
  -- Contact info
  phone_number VARCHAR(20),
  phone_verified BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id)
);

-- Email Queue Table (for background processing)
CREATE TABLE IF NOT EXISTS email_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  
  -- Email details
  from_address VARCHAR(255) NOT NULL,
  to_address TEXT NOT NULL, -- Can be comma-separated
  cc_address TEXT,
  bcc_address TEXT,
  subject VARCHAR(500) NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT,
  
  -- Metadata
  department VARCHAR(50),
  template_name VARCHAR(100),
  template_data JSONB,
  
  -- Processing
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, sent, failed
  priority INTEGER DEFAULT 5, -- 1 (highest) to 10 (lowest)
  scheduled_for TIMESTAMP,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_attempt_at TIMESTAMP,
  sent_at TIMESTAMP,
  failed_at TIMESTAMP,
  error_message TEXT,
  
  -- Tracking
  message_id VARCHAR(255),
  provider_response JSONB,
  
  -- Attachments (JSON array of {filename, path, contentType})
  attachments JSONB,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email Analytics Table
CREATE TABLE IF NOT EXISTS email_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_queue_id UUID REFERENCES email_queue(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  
  -- Email info
  department VARCHAR(50),
  template_name VARCHAR(100),
  subject VARCHAR(500),
  sent_at TIMESTAMP,
  
  -- Engagement tracking
  delivered BOOLEAN DEFAULT false,
  delivered_at TIMESTAMP,
  opened BOOLEAN DEFAULT false,
  opened_at TIMESTAMP,
  clicked BOOLEAN DEFAULT false,
  clicked_at TIMESTAMP,
  bounced BOOLEAN DEFAULT false,
  bounced_at TIMESTAMP,
  bounce_type VARCHAR(50), -- hard, soft, block
  complained BOOLEAN DEFAULT false,
  complained_at TIMESTAMP,
  unsubscribed BOOLEAN DEFAULT false,
  unsubscribed_at TIMESTAMP,
  
  -- Link tracking
  links_clicked JSONB, -- Array of {url, clicked_at}
  
  -- Device/Client info
  user_agent TEXT,
  ip_address INET,
  device_type VARCHAR(50),
  email_client VARCHAR(100),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SMS Queue Table
CREATE TABLE IF NOT EXISTS sms_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  
  -- SMS details
  to_number VARCHAR(20) NOT NULL,
  from_number VARCHAR(20),
  message TEXT NOT NULL,
  
  -- Metadata
  purpose VARCHAR(50), -- 2fa, alert, marketing, notification
  
  -- Processing
  status VARCHAR(20) DEFAULT 'pending',
  priority INTEGER DEFAULT 5,
  scheduled_for TIMESTAMP,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  sent_at TIMESTAMP,
  failed_at TIMESTAMP,
  error_message TEXT,
  
  -- Tracking
  message_sid VARCHAR(255),
  provider_response JSONB,
  cost DECIMAL(10, 4),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Onboarding Sequences Table
CREATE TABLE IF NOT EXISTS onboarding_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger_event VARCHAR(100) NOT NULL, -- user_created, plan_upgraded, etc.
  active BOOLEAN DEFAULT true,
  
  -- Sequence steps (JSON array)
  steps JSONB NOT NULL, -- [{day: 1, template: 'welcome', channel: 'email'}, ...]
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Onboarding Progress Table
CREATE TABLE IF NOT EXISTS onboarding_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sequence_id UUID NOT NULL REFERENCES onboarding_sequences(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id),
  
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  current_step INTEGER DEFAULT 0,
  
  -- Step completion tracking (JSON)
  steps_completed JSONB DEFAULT '[]'::jsonb,
  
  status VARCHAR(20) DEFAULT 'active', -- active, paused, completed, cancelled
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(sequence_id, user_id)
);

-- Customer Satisfaction Surveys Table
CREATE TABLE IF NOT EXISTS csat_surveys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Survey context
  survey_type VARCHAR(50) NOT NULL, -- support_ticket, nps, product, onboarding
  reference_id UUID, -- ticket_id, order_id, etc.
  reference_type VARCHAR(50),
  
  -- Survey sent
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_via VARCHAR(20) DEFAULT 'email',
  
  -- Response
  responded_at TIMESTAMP,
  score INTEGER, -- 1-5 for CSAT, 0-10 for NPS
  feedback TEXT,
  
  -- NPS categorization
  nps_category VARCHAR(20), -- detractor (0-6), passive (7-8), promoter (9-10)
  
  -- Follow-up
  follow_up_required BOOLEAN DEFAULT false,
  follow_up_completed BOOLEAN DEFAULT false,
  follow_up_notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API Usage Tracking Table
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  
  -- Request details
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  
  -- Usage tracking
  ip_address INET,
  user_agent TEXT,
  api_key_id UUID,
  
  -- Quota tracking
  quota_consumed INTEGER DEFAULT 1,
  
  -- Timestamp (partitioned by date for performance)
  request_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API Quotas Table
CREATE TABLE IF NOT EXISTS api_quotas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  
  -- Quota limits
  endpoint_pattern VARCHAR(255), -- e.g., /api/guardian/*, /api/domains/*
  quota_limit INTEGER NOT NULL, -- requests per period
  quota_period VARCHAR(20) DEFAULT 'day', -- minute, hour, day, month
  
  -- Current usage
  quota_used INTEGER DEFAULT 0,
  quota_reset_at TIMESTAMP,
  
  -- Overage
  overage_allowed BOOLEAN DEFAULT false,
  overage_rate DECIMAL(10, 4), -- cost per request over quota
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(tenant_id, user_id, endpoint_pattern)
);

-- Referral System Table
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  
  -- Referrer
  referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code VARCHAR(50) NOT NULL UNIQUE,
  
  -- Referred user
  referred_id UUID REFERENCES users(id) ON DELETE SET NULL,
  referred_email VARCHAR(255),
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, completed, paid
  signup_date TIMESTAMP,
  conversion_date TIMESTAMP, -- when referred user made first payment
  
  -- Commission
  commission_type VARCHAR(20) DEFAULT 'percentage', -- percentage, fixed
  commission_amount DECIMAL(10, 2),
  commission_status VARCHAR(20) DEFAULT 'pending', -- pending, approved, paid
  commission_paid_at TIMESTAMP,
  
  -- Tracking
  clicks INTEGER DEFAULT 0,
  last_click_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log Table (comprehensive)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  
  -- Actor
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email VARCHAR(255),
  user_role VARCHAR(50),
  
  -- Action
  action VARCHAR(100) NOT NULL, -- user.created, invoice.paid, server.restarted
  resource_type VARCHAR(50), -- user, invoice, server, domain
  resource_id UUID,
  
  -- Details
  description TEXT,
  changes JSONB, -- {before: {...}, after: {...}}
  metadata JSONB, -- additional context
  
  -- Request context
  ip_address INET,
  user_agent TEXT,
  request_id VARCHAR(100),
  
  -- Severity
  severity VARCHAR(20) DEFAULT 'info', -- debug, info, warning, error, critical
  
  -- Compliance
  gdpr_relevant BOOLEAN DEFAULT false,
  pci_relevant BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge Base Articles Table
CREATE TABLE IF NOT EXISTS kb_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  
  -- Article details
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  
  -- Organization
  category_id UUID,
  tags TEXT[], -- Array of tags
  
  -- Status
  status VARCHAR(20) DEFAULT 'draft', -- draft, published, archived
  published_at TIMESTAMP,
  
  -- Author
  author_id UUID REFERENCES users(id),
  
  -- SEO
  meta_title VARCHAR(255),
  meta_description VARCHAR(500),
  
  -- Engagement
  views INTEGER DEFAULT 0,
  helpful_votes INTEGER DEFAULT 0,
  unhelpful_votes INTEGER DEFAULT 0,
  
  -- Search
  search_vector tsvector,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(slug)
);

-- White Label Settings Table
CREATE TABLE IF NOT EXISTS white_label_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Branding
  company_name VARCHAR(255),
  logo_url TEXT,
  logo_dark_url TEXT,
  favicon_url TEXT,
  
  -- Colors
  primary_color VARCHAR(7) DEFAULT '#3B82F6',
  secondary_color VARCHAR(7) DEFAULT '#8B5CF6',
  accent_color VARCHAR(7) DEFAULT '#10B981',
  
  -- Domain
  custom_domain VARCHAR(255),
  custom_domain_verified BOOLEAN DEFAULT false,
  
  -- Email branding
  email_from_name VARCHAR(255),
  email_from_address VARCHAR(255),
  email_header_html TEXT,
  email_footer_html TEXT,
  
  -- Portal customization
  portal_title VARCHAR(255),
  portal_welcome_message TEXT,
  custom_css TEXT,
  custom_js TEXT,
  
  -- Support
  support_email VARCHAR(255),
  support_phone VARCHAR(20),
  support_url TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(tenant_id)
);

-- Session Management Table
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id),
  
  -- Session details
  session_token VARCHAR(500) NOT NULL UNIQUE,
  refresh_token VARCHAR(500),
  
  -- Device info
  device_name VARCHAR(255),
  device_type VARCHAR(50), -- desktop, mobile, tablet
  browser VARCHAR(100),
  os VARCHAR(100),
  ip_address INET,
  user_agent TEXT,
  
  -- Location
  country VARCHAR(2),
  city VARCHAR(100),
  
  -- Status
  active BOOLEAN DEFAULT true,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  
  -- Security
  suspicious BOOLEAN DEFAULT false,
  forced_logout BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backup Schedules Table
CREATE TABLE IF NOT EXISTS backup_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  
  -- Schedule details
  name VARCHAR(255) NOT NULL,
  resource_type VARCHAR(50) NOT NULL, -- database, files, website
  resource_id UUID,
  
  -- Schedule (cron format)
  cron_expression VARCHAR(100) NOT NULL,
  timezone VARCHAR(50) DEFAULT 'UTC',
  
  -- Backup settings
  backup_type VARCHAR(20) DEFAULT 'full', -- full, incremental, differential
  retention_days INTEGER DEFAULT 30,
  compression BOOLEAN DEFAULT true,
  encryption BOOLEAN DEFAULT true,
  
  -- Storage
  storage_location VARCHAR(255), -- s3, minio, local
  storage_path TEXT,
  
  -- Status
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMP,
  last_run_status VARCHAR(20),
  next_run_at TIMESTAMP,
  
  -- Notifications
  notify_on_success BOOLEAN DEFAULT false,
  notify_on_failure BOOLEAN DEFAULT true,
  notification_emails TEXT[],
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_notification_prefs_user ON notification_preferences(user_id);
CREATE INDEX idx_notification_prefs_tenant ON notification_preferences(tenant_id);

CREATE INDEX idx_email_queue_status ON email_queue(status, scheduled_for);
CREATE INDEX idx_email_queue_tenant ON email_queue(tenant_id);
CREATE INDEX idx_email_queue_priority ON email_queue(priority, created_at);

CREATE INDEX idx_email_analytics_template ON email_analytics(department, template_name);
CREATE INDEX idx_email_analytics_user ON email_analytics(user_id);
CREATE INDEX idx_email_analytics_sent ON email_analytics(sent_at);

CREATE INDEX idx_sms_queue_status ON sms_queue(status, scheduled_for);
CREATE INDEX idx_sms_queue_user ON sms_queue(user_id);

CREATE INDEX idx_onboarding_progress_user ON onboarding_progress(user_id);
CREATE INDEX idx_onboarding_progress_sequence ON onboarding_progress(sequence_id);

CREATE INDEX idx_csat_user ON csat_surveys(user_id);
CREATE INDEX idx_csat_type_ref ON csat_surveys(survey_type, reference_id);

CREATE INDEX idx_api_usage_tenant_date ON api_usage(tenant_id, request_date);
CREATE INDEX idx_api_usage_user_date ON api_usage(user_id, request_date);
CREATE INDEX idx_api_usage_endpoint ON api_usage(endpoint, request_date);

CREATE INDEX idx_api_quotas_tenant_user ON api_quotas(tenant_id, user_id);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX idx_referrals_code ON referrals(referral_code);
CREATE INDEX idx_referrals_status ON referrals(status);

CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

CREATE INDEX idx_kb_articles_slug ON kb_articles(slug);
CREATE INDEX idx_kb_articles_status ON kb_articles(status, published_at);
CREATE INDEX idx_kb_articles_search ON kb_articles USING gin(search_vector);

CREATE INDEX idx_white_label_tenant ON white_label_settings(tenant_id);

CREATE INDEX idx_sessions_user ON user_sessions(user_id, active);
CREATE INDEX idx_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at);

CREATE INDEX idx_backup_schedules_tenant ON backup_schedules(tenant_id);
CREATE INDEX idx_backup_schedules_next_run ON backup_schedules(enabled, next_run_at);

-- Create triggers for updated_at
CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_queue_updated_at BEFORE UPDATE ON email_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_analytics_updated_at BEFORE UPDATE ON email_analytics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sms_queue_updated_at BEFORE UPDATE ON sms_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_onboarding_sequences_updated_at BEFORE UPDATE ON onboarding_sequences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_onboarding_progress_updated_at BEFORE UPDATE ON onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_csat_surveys_updated_at BEFORE UPDATE ON csat_surveys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_quotas_updated_at BEFORE UPDATE ON api_quotas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_referrals_updated_at BEFORE UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kb_articles_updated_at BEFORE UPDATE ON kb_articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_white_label_settings_updated_at BEFORE UPDATE ON white_label_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_sessions_updated_at BEFORE UPDATE ON user_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_backup_schedules_updated_at BEFORE UPDATE ON backup_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Full-text search trigger for KB articles
CREATE OR REPLACE FUNCTION kb_articles_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.content, '') || ' ' || COALESCE(array_to_string(NEW.tags, ' '), ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kb_articles_search_update BEFORE INSERT OR UPDATE ON kb_articles
  FOR EACH ROW EXECUTE FUNCTION kb_articles_search_trigger();
