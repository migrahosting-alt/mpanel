-- Advanced Billing & Serverless Functions Migration
-- Run after main enterprise features migration

-- ============================================
-- Serverless Functions Tables
-- ============================================

CREATE TABLE IF NOT EXISTS serverless_functions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  runtime VARCHAR(50) NOT NULL, -- nodejs18, nodejs20, python39, python311, go121
  handler VARCHAR(255), -- Entry point (e.g., 'index.handler')
  code TEXT NOT NULL,
  environment JSONB DEFAULT '{}',
  memory_mb INTEGER DEFAULT 256,
  timeout_seconds INTEGER DEFAULT 30,
  status VARCHAR(50) DEFAULT 'active', -- active, disabled, error
  invocations_count INTEGER DEFAULT 0,
  last_invocation_at TIMESTAMP,
  total_duration_ms BIGINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_serverless_functions_user ON serverless_functions(user_id);
CREATE INDEX idx_serverless_functions_tenant ON serverless_functions(tenant_id);
CREATE INDEX idx_serverless_functions_status ON serverless_functions(status);

CREATE TABLE IF NOT EXISTS function_invocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_id UUID NOT NULL REFERENCES serverless_functions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL, -- running, success, failed, timeout
  payload JSONB,
  result JSONB,
  error TEXT,
  logs TEXT,
  duration_ms INTEGER,
  memory_used_mb INTEGER,
  cold_start BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_function_invocations_function ON function_invocations(function_id);
CREATE INDEX idx_function_invocations_status ON function_invocations(status);
CREATE INDEX idx_function_invocations_created ON function_invocations(created_at DESC);

CREATE TABLE IF NOT EXISTS function_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_id UUID NOT NULL REFERENCES serverless_functions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  schedule VARCHAR(255) NOT NULL, -- Cron expression
  payload JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_function_schedules_next_run ON function_schedules(next_run_at) WHERE enabled = true;

-- ============================================
-- Usage-Based Billing Tables
-- ============================================

CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  metric_name VARCHAR(100) NOT NULL, -- bandwidth, storage, requests, compute_hours, etc.
  quantity DECIMAL(15, 4) NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX idx_usage_records_subscription ON usage_records(subscription_id);
CREATE INDEX idx_usage_records_timestamp ON usage_records(timestamp);
CREATE INDEX idx_usage_records_metric ON usage_records(metric_name);

CREATE TABLE IF NOT EXISTS subscription_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  metric_name VARCHAR(100) NOT NULL,
  period_start DATE NOT NULL,
  quantity DECIMAL(15, 4) NOT NULL DEFAULT 0,
  billed BOOLEAN DEFAULT false,
  UNIQUE(subscription_id, metric_name, period_start)
);

CREATE INDEX idx_subscription_usage_period ON subscription_usage(period_start);
CREATE INDEX idx_subscription_usage_billed ON subscription_usage(billed) WHERE billed = false;

-- ============================================
-- Payment Plans & Installments
-- ============================================

CREATE TABLE IF NOT EXISTS payment_plan_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, paid, failed, cancelled
  paid_at TIMESTAMP,
  stripe_payment_intent_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_installments_invoice ON payment_plan_installments(invoice_id);
CREATE INDEX idx_installments_due_date ON payment_plan_installments(due_date);
CREATE INDEX idx_installments_status ON payment_plan_installments(status);

-- Add payment plan columns to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_plan_enabled BOOLEAN DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_plan_installments INTEGER;

-- ============================================
-- Dunning Management
-- ============================================

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS dunning_retry_count INTEGER DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255);

CREATE TABLE IF NOT EXISTS dunning_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  retry_number INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL, -- success, failed
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_dunning_logs_invoice ON dunning_logs(invoice_id);
CREATE INDEX idx_dunning_logs_created ON dunning_logs(created_at DESC);

-- ============================================
-- Revenue Recognition (ASC 606)
-- ============================================

CREATE TABLE IF NOT EXISTS revenue_recognition_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL UNIQUE REFERENCES invoices(id) ON DELETE CASCADE,
  schedule JSONB NOT NULL, -- Array of {month, amount, recognitionDate}
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recognized_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  recognition_month VARCHAR(7) NOT NULL, -- YYYY-MM format
  amount DECIMAL(10, 2) NOT NULL,
  recognized_at DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(invoice_id, recognition_month)
);

CREATE INDEX idx_recognized_revenue_month ON recognized_revenue(recognition_month);
CREATE INDEX idx_recognized_revenue_invoice ON recognized_revenue(invoice_id);

-- ============================================
-- Pricing Models & Tiers
-- ============================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS pricing_model VARCHAR(50) DEFAULT 'flat'; -- flat, tiered, volume, usage
ALTER TABLE products ADD COLUMN IF NOT EXISTS usage_tiers JSONB; -- Tiered pricing configuration

-- Example usage_tiers structure:
-- {
--   "bandwidth": [
--     {"from": 0, "upTo": 100, "unitPrice": 0.10},
--     {"from": 100, "upTo": 1000, "unitPrice": 0.08},
--     {"from": 1000, "upTo": null, "unitPrice": 0.05}
--   ]
-- }

-- ============================================
-- Volume Discounts
-- ============================================

CREATE TABLE IF NOT EXISTS volume_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL for tenant-wide
  min_amount DECIMAL(10, 2) NOT NULL,
  discount_percent DECIMAL(5, 2) NOT NULL,
  valid_from DATE,
  valid_until DATE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_volume_discounts_tenant ON volume_discounts(tenant_id);
CREATE INDEX idx_volume_discounts_customer ON volume_discounts(customer_id);

-- ============================================
-- Contract Management
-- ============================================

CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contract_number VARCHAR(100) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  total_value DECIMAL(12, 2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  billing_frequency VARCHAR(50), -- monthly, quarterly, annually
  auto_renew BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'draft', -- draft, active, expired, cancelled
  terms TEXT,
  signed_at TIMESTAMP,
  signed_by_name VARCHAR(255),
  document_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_contracts_customer ON contracts(customer_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_dates ON contracts(start_date, end_date);

-- ============================================
-- Quote System
-- ============================================

CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  quote_number VARCHAR(100) UNIQUE NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  tax DECIMAL(10, 2) DEFAULT 0,
  discount DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  valid_until DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'draft', -- draft, sent, accepted, rejected, expired
  notes TEXT,
  accepted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_quotes_customer ON quotes(customer_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_valid_until ON quotes(valid_until);
CREATE INDEX idx_quote_items_quote ON quote_items(quote_id);
