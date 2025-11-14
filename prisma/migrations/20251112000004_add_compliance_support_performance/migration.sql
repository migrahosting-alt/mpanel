-- Migration: Add Compliance, Support, and Performance tables
-- Date: 2025-11-12
-- Description: Database schema for Compliance & Audit System, Advanced Support System, and Performance Optimization Suite

-- ============================================================================
-- COMPLIANCE & AUDIT SYSTEM TABLES
-- ============================================================================

-- Audit trail with blockchain-style hash chain for immutability
CREATE TABLE IF NOT EXISTS audit_trail (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  severity VARCHAR(20) DEFAULT 'info', -- info, warning, critical
  compliance_framework TEXT[], -- Array of applicable frameworks
  previous_hash VARCHAR(64),
  hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_trail_tenant ON audit_trail(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_user ON audit_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_action ON audit_trail(action);
CREATE INDEX IF NOT EXISTS idx_audit_trail_created ON audit_trail(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_trail_hash ON audit_trail(hash);

-- Data lineage tracking for GDPR compliance
CREATE TABLE IF NOT EXISTS data_lineage (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  data_type VARCHAR(100) NOT NULL, -- customer, payment, pii, etc.
  data_id VARCHAR(255) NOT NULL,
  operation VARCHAR(50) NOT NULL, -- create, read, update, delete, export
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  before_state JSONB,
  after_state JSONB,
  purpose TEXT, -- Why was data accessed (GDPR requirement)
  legal_basis VARCHAR(100), -- consent, contract, legal_obligation, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_data_lineage_tenant ON data_lineage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_data_lineage_type_id ON data_lineage(data_type, data_id);
CREATE INDEX IF NOT EXISTS idx_data_lineage_user ON data_lineage(user_id);
CREATE INDEX IF NOT EXISTS idx_data_lineage_created ON data_lineage(created_at);

-- Compliance reports
CREATE TABLE IF NOT EXISTS compliance_reports (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  framework VARCHAR(50) NOT NULL, -- SOC2, ISO27001, GDPR, HIPAA, PCI_DSS
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  report_data JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'generated',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_compliance_reports_tenant ON compliance_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_framework ON compliance_reports(framework);

-- Compliance evidence packages for auditors
CREATE TABLE IF NOT EXISTS compliance_evidence (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  framework VARCHAR(50) NOT NULL,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  evidence_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_compliance_evidence_tenant ON compliance_evidence(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_evidence_framework ON compliance_evidence(framework);

-- Query analysis reports
CREATE TABLE IF NOT EXISTS query_analysis_reports (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  threshold_ms INTEGER NOT NULL,
  queries_analyzed INTEGER NOT NULL,
  report_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_query_analysis_tenant ON query_analysis_reports(tenant_id);

-- Authentication logs (if not exists from 2FA)
CREATE TABLE IF NOT EXISTS authentication_logs (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  success BOOLEAN NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  failure_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_logs_tenant ON authentication_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_auth_logs_user ON authentication_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_logs_created ON authentication_logs(created_at);

-- Security incidents
CREATE TABLE IF NOT EXISTS security_incidents (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  incident_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL, -- low, medium, high, critical
  description TEXT,
  status VARCHAR(50) DEFAULT 'open', -- open, investigating, resolved
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_incidents_tenant ON security_incidents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_incidents_created ON security_incidents(created_at);

-- Data access requests (GDPR Article 15)
CREATE TABLE IF NOT EXISTS data_access_requests (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  request_type VARCHAR(50) NOT NULL, -- access, deletion, portability
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_data_access_requests_tenant ON data_access_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_data_access_requests_user ON data_access_requests(user_id);

-- ============================================================================
-- ADVANCED SUPPORT SYSTEM TABLES
-- ============================================================================

-- Support tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
  category VARCHAR(100), -- technical, billing, general, etc.
  sentiment VARCHAR(20), -- positive, neutral, negative
  status VARCHAR(50) DEFAULT 'open', -- open, in_progress, resolved, closed
  channel VARCHAR(50) DEFAULT 'email', -- email, chat, phone, portal
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP,
  first_response_at TIMESTAMP,
  response_by TIMESTAMP, -- SLA target
  resolved_at TIMESTAMP,
  resolution_by TIMESTAMP, -- SLA target
  closed_at TIMESTAMP,
  escalated BOOLEAN DEFAULT FALSE,
  escalated_at TIMESTAMP,
  escalated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  tags TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant ON support_tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created ON support_tickets(created_at);

-- Ticket replies
CREATE TABLE IF NOT EXISTS ticket_replies (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ticket_replies_ticket ON ticket_replies(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_replies_created ON ticket_replies(created_at);

-- Ticket history
CREATE TABLE IF NOT EXISTS ticket_history (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL, -- created, assigned, status_change, escalated, etc.
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ticket_history_ticket ON ticket_history(ticket_id);

-- Ticket attachments
CREATE TABLE IF NOT EXISTS ticket_attachments (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES support_tickets(id) ON DELETE CASCADE,
  reply_id INTEGER REFERENCES ticket_replies(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket ON ticket_attachments(ticket_id);

-- SLA breaches
CREATE TABLE IF NOT EXISTS sla_breaches (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES support_tickets(id) ON DELETE CASCADE,
  breach_type VARCHAR(50) NOT NULL, -- response, resolution
  actual_time_minutes NUMERIC(10,2) NOT NULL,
  target_time_minutes INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sla_breaches_ticket ON sla_breaches(ticket_id);

-- Support agents
CREATE TABLE IF NOT EXISTS support_agents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'available', -- available, busy, offline
  role VARCHAR(50) DEFAULT 'agent', -- agent, senior_agent, manager
  categories JSONB DEFAULT '[]', -- Expertise categories
  accepts_chat BOOLEAN DEFAULT TRUE,
  max_concurrent_chats INTEGER DEFAULT 3,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_agents_user ON support_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_support_agents_status ON support_agents(status);

-- Live chat sessions
CREATE TABLE IF NOT EXISTS live_chat_sessions (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'waiting', -- waiting, active, ended
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  agent_joined_at TIMESTAMP,
  ended_at TIMESTAMP,
  ended_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_tenant ON live_chat_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON live_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_agent ON live_chat_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON live_chat_sessions(status);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES live_chat_sessions(id) ON DELETE CASCADE,
  sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);

-- Knowledge base
CREATE TABLE IF NOT EXISTS knowledge_base (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = global article
  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(100),
  tags TEXT[],
  status VARCHAR(50) DEFAULT 'draft', -- draft, published, archived
  views INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_tenant ON knowledge_base(tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_status ON knowledge_base(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_search ON knowledge_base USING GIN (to_tsvector('english', title || ' ' || content));

-- Satisfaction surveys
CREATE TABLE IF NOT EXISTS satisfaction_surveys (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- ticket, chat
  resource_id INTEGER NOT NULL, -- ticket ID or chat session ID
  rating INTEGER, -- 1-5 for CSAT
  nps_score INTEGER, -- 0-10 for NPS
  feedback TEXT,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_satisfaction_surveys_user ON satisfaction_surveys(user_id);
CREATE INDEX IF NOT EXISTS idx_satisfaction_surveys_type ON satisfaction_surveys(type, resource_id);

-- Ticket macros (canned responses)
CREATE TABLE IF NOT EXISTS ticket_macros (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  actions JSONB NOT NULL, -- {reply, status, tags, assignTo, etc.}
  category VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ticket_macros_tenant ON ticket_macros(tenant_id);

-- ============================================================================
-- PERFORMANCE OPTIMIZATION SUITE TABLES
-- ============================================================================

-- Web Vitals metrics
CREATE TABLE IF NOT EXISTS web_vitals_metrics (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE,
  metric_name VARCHAR(20) NOT NULL, -- LCP, FID, CLS, FCP, TTFB
  value NUMERIC(10,2) NOT NULL,
  url TEXT,
  user_agent TEXT,
  connection_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_web_vitals_tenant ON web_vitals_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_web_vitals_website ON web_vitals_metrics(website_id);
CREATE INDEX IF NOT EXISTS idx_web_vitals_metric ON web_vitals_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_web_vitals_created ON web_vitals_metrics(created_at);

-- Performance budget violations
CREATE TABLE IF NOT EXISTS performance_budget_violations (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE,
  metric_name VARCHAR(20) NOT NULL,
  actual_value NUMERIC(10,2) NOT NULL,
  budget_value NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_perf_violations_tenant ON performance_budget_violations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_perf_violations_website ON performance_budget_violations(website_id);
CREATE INDEX IF NOT EXISTS idx_perf_violations_created ON performance_budget_violations(created_at);

-- CDN purge logs
CREATE TABLE IF NOT EXISTS cdn_purge_logs (
  id SERIAL PRIMARY KEY,
  website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- cloudflare, cloudfront, fastly
  urls JSONB, -- Array of URLs purged
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cdn_purge_website ON cdn_purge_logs(website_id);
CREATE INDEX IF NOT EXISTS idx_cdn_purge_created ON cdn_purge_logs(created_at);

-- Asset optimization reports
CREATE TABLE IF NOT EXISTS asset_optimization_reports (
  id SERIAL PRIMARY KEY,
  website_id INTEGER REFERENCES websites(id) ON DELETE CASCADE,
  recommendations JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_asset_reports_website ON asset_optimization_reports(website_id);

-- Add CDN fields to websites table if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'websites' AND column_name = 'cdn_zone_id') THEN
    ALTER TABLE websites ADD COLUMN cdn_zone_id VARCHAR(255);
    ALTER TABLE websites ADD COLUMN cdn_api_key VARCHAR(255);
    ALTER TABLE websites ADD COLUMN cdn_distribution_id VARCHAR(255);
    ALTER TABLE websites ADD COLUMN cdn_service_id VARCHAR(255);
  END IF;
END
$$;

-- ============================================================================
-- SYSTEM ALERTS TABLE (for monitoring)
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_alerts (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  alert_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL, -- info, warning, critical
  message TEXT NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_system_alerts_tenant ON system_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_system_alerts_created ON system_alerts(created_at);

-- ============================================================================
-- SERVER HEALTH CHECKS TABLE (for availability metrics)
-- ============================================================================

CREATE TABLE IF NOT EXISTS server_health_checks (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  server_id INTEGER REFERENCES servers(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL, -- active, degraded, down
  response_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_server_health_tenant ON server_health_checks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_server_health_server ON server_health_checks(server_id);
CREATE INDEX IF NOT EXISTS idx_server_health_created ON server_health_checks(created_at);

COMMENT ON TABLE audit_trail IS 'Immutable audit trail with blockchain-style hash chain for tamper detection';
COMMENT ON TABLE data_lineage IS 'GDPR-compliant data access and modification tracking';
COMMENT ON TABLE compliance_reports IS 'Generated compliance reports for SOC2, ISO27001, GDPR, HIPAA, PCI DSS';
COMMENT ON TABLE support_tickets IS 'Support ticketing system with AI-powered triage';
COMMENT ON TABLE live_chat_sessions IS 'Live chat sessions with agent routing';
COMMENT ON TABLE knowledge_base IS 'Knowledge base articles with full-text search';
COMMENT ON TABLE web_vitals_metrics IS 'Core Web Vitals tracking (LCP, FID, CLS, FCP, TTFB)';
COMMENT ON TABLE performance_budget_violations IS 'Performance budget violations for monitoring';
