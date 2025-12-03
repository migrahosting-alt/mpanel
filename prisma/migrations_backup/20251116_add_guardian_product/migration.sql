-- Migration: Add AFM Guardian product tables
-- Created: 2025-11-16
-- Description: Tables for managing Migra AFM Guardian (AI Support Assistant) product

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Guardian instances table (one per customer/website)
CREATE TABLE IF NOT EXISTS guardian_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Instance configuration
  instance_name VARCHAR(255) NOT NULL,
  widget_token VARCHAR(255) UNIQUE NOT NULL, -- For widget auth
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'disabled')),
  
  -- Guardian settings
  gateway_url VARCHAR(500) NOT NULL DEFAULT 'http://localhost:8080',
  orchestrator_url VARCHAR(500),
  allowed_origins TEXT[], -- CORS origins for widget
  max_messages_per_day INTEGER DEFAULT 100,
  enable_voice BOOLEAN DEFAULT false,
  
  -- LLM configuration
  llm_provider VARCHAR(50) DEFAULT 'openai', -- openai, anthropic, etc
  llm_model VARCHAR(100) DEFAULT 'gpt-4o-mini',
  llm_temperature DECIMAL(3,2) DEFAULT 0.7,
  
  -- Branding
  widget_title VARCHAR(255) DEFAULT 'AI Support Assistant',
  widget_subtitle VARCHAR(500),
  primary_color VARCHAR(20) DEFAULT '#3b82f6',
  assistant_name VARCHAR(100) DEFAULT 'Abigail',
  avatar_url VARCHAR(500),
  
  -- Usage tracking
  total_messages INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  last_message_at TIMESTAMP,
  
  -- Billing
  product_id UUID REFERENCES products(id),
  monthly_price DECIMAL(10,2),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_customer_instance UNIQUE(tenant_id, customer_id, instance_name)
);

-- Guardian chat sessions table
CREATE TABLE IF NOT EXISTS guardian_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_id UUID REFERENCES guardian_instances(id) ON DELETE CASCADE,
  
  -- Session metadata
  session_id VARCHAR(255) UNIQUE NOT NULL,
  user_identifier VARCHAR(255), -- Email, user_id, or anonymous ID
  ip_address INET,
  user_agent TEXT,
  
  -- Session stats
  message_count INTEGER DEFAULT 0,
  tool_calls_count INTEGER DEFAULT 0,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  
  -- Satisfaction
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Guardian messages table (conversation history)
CREATE TABLE IF NOT EXISTS guardian_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES guardian_sessions(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES guardian_instances(id) ON DELETE CASCADE,
  
  -- Message content
  role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  
  -- Tool execution (if assistant used a tool)
  tool_name VARCHAR(100),
  tool_input JSONB,
  tool_result JSONB,
  tool_execution_time_ms INTEGER,
  
  -- LLM metadata
  llm_model VARCHAR(100),
  llm_tokens_prompt INTEGER,
  llm_tokens_completion INTEGER,
  llm_cost DECIMAL(10,6),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Guardian analytics table (daily aggregations)
CREATE TABLE IF NOT EXISTS guardian_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_id UUID REFERENCES guardian_instances(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  -- Volume metrics
  sessions_count INTEGER DEFAULT 0,
  messages_count INTEGER DEFAULT 0,
  unique_users_count INTEGER DEFAULT 0,
  
  -- Tool usage
  tool_calls_count INTEGER DEFAULT 0,
  top_tools JSONB, -- {"dns_list_records": 45, "user_get_summary": 23}
  
  -- Performance
  avg_response_time_ms INTEGER,
  success_rate DECIMAL(5,2),
  
  -- Satisfaction
  avg_rating DECIMAL(3,2),
  ratings_count INTEGER DEFAULT 0,
  
  -- Cost tracking
  total_llm_cost DECIMAL(10,6),
  total_tokens INTEGER,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_instance_date UNIQUE(instance_id, date)
);

-- Indexes for performance
CREATE INDEX idx_guardian_instances_tenant_id ON guardian_instances(tenant_id);
CREATE INDEX idx_guardian_instances_customer_id ON guardian_instances(customer_id);
CREATE INDEX idx_guardian_instances_status ON guardian_instances(status);
CREATE INDEX idx_guardian_instances_widget_token ON guardian_instances(widget_token);

CREATE INDEX idx_guardian_sessions_instance_id ON guardian_sessions(instance_id);
CREATE INDEX idx_guardian_sessions_session_id ON guardian_sessions(session_id);
CREATE INDEX idx_guardian_sessions_started_at ON guardian_sessions(started_at);

CREATE INDEX idx_guardian_messages_session_id ON guardian_messages(session_id);
CREATE INDEX idx_guardian_messages_instance_id ON guardian_messages(instance_id);
CREATE INDEX idx_guardian_messages_created_at ON guardian_messages(created_at);
CREATE INDEX idx_guardian_messages_tool_name ON guardian_messages(tool_name) WHERE tool_name IS NOT NULL;

CREATE INDEX idx_guardian_analytics_instance_id ON guardian_analytics(instance_id);
CREATE INDEX idx_guardian_analytics_date ON guardian_analytics(date);

-- Triggers for updated_at
CREATE TRIGGER update_guardian_instances_updated_at
  BEFORE UPDATE ON guardian_instances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guardian_sessions_updated_at
  BEFORE UPDATE ON guardian_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guardian_analytics_updated_at
  BEFORE UPDATE ON guardian_analytics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default Guardian products
INSERT INTO products (
  tenant_id, 
  name, 
  description, 
  type, 
  billing_cycle, 
  price, 
  setup_fee,
  metadata,
  status
)
SELECT 
  id as tenant_id,
  'AI Support Assistant - Starter',
  'AI-powered support chat with 1,000 messages/month, basic tools, email support',
  'guardian',
  'monthly',
  29.99,
  0.00,
  jsonb_build_object(
    'max_messages_per_month', 1000,
    'max_instances', 1,
    'tools', jsonb_build_array('dns_list_records', 'user_get_summary'),
    'voice_enabled', false,
    'custom_branding', false,
    'analytics_retention_days', 30,
    'support_level', 'email'
  ),
  'active'
FROM tenants
WHERE NOT EXISTS (
  SELECT 1 FROM products 
  WHERE type = 'guardian' 
  AND name = 'AI Support Assistant - Starter'
)
LIMIT 1;

INSERT INTO products (
  tenant_id, 
  name, 
  description, 
  type, 
  billing_cycle, 
  price, 
  setup_fee,
  metadata,
  status
)
SELECT 
  id as tenant_id,
  'AI Support Assistant - Professional',
  'AI-powered support chat with 5,000 messages/month, all tools, voice support, custom branding',
  'guardian',
  'monthly',
  79.99,
  0.00,
  jsonb_build_object(
    'max_messages_per_month', 5000,
    'max_instances', 3,
    'tools', jsonb_build_array('dns_list_records', 'user_get_summary', 'backups_list'),
    'voice_enabled', true,
    'custom_branding', true,
    'analytics_retention_days', 90,
    'support_level', 'priority'
  ),
  'active'
FROM tenants
WHERE NOT EXISTS (
  SELECT 1 FROM products 
  WHERE type = 'guardian' 
  AND name = 'AI Support Assistant - Professional'
)
LIMIT 1;

INSERT INTO products (
  tenant_id, 
  name, 
  description, 
  type, 
  billing_cycle, 
  price, 
  setup_fee,
  metadata,
  status
)
SELECT 
  id as tenant_id,
  'AI Support Assistant - Enterprise',
  'Unlimited messages, unlimited instances, all tools, voice, white-label, dedicated support',
  'guardian',
  'monthly',
  199.99,
  0.00,
  jsonb_build_object(
    'max_messages_per_month', -1,
    'max_instances', -1,
    'tools', jsonb_build_array('dns_list_records', 'user_get_summary', 'backups_list', 'custom_tools'),
    'voice_enabled', true,
    'custom_branding', true,
    'white_label', true,
    'analytics_retention_days', 365,
    'support_level', 'dedicated'
  ),
  'active'
FROM tenants
WHERE NOT EXISTS (
  SELECT 1 FROM products 
  WHERE type = 'guardian' 
  AND name = 'AI Support Assistant - Enterprise'
)
LIMIT 1;

COMMENT ON TABLE guardian_instances IS 'AFM Guardian AI assistant instances provisioned for customers';
COMMENT ON TABLE guardian_sessions IS 'Chat sessions with the AI assistant';
COMMENT ON TABLE guardian_messages IS 'Individual messages in chat conversations';
COMMENT ON TABLE guardian_analytics IS 'Daily aggregated analytics for Guardian instances';
