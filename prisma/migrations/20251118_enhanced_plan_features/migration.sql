-- Enhanced Plan Access System - All 10 Features
-- Migration: 20251118_enhanced_plan_features
-- Adds: Trials, Referrals, Overages, Annual Commits, Resource Pooling, Grace Periods, 
--       Promo Codes, Loyalty Discounts, AI Recommendations, Success Metrics

-- ============================================
-- 1. USAGE-BASED BILLING & OVERAGES
-- ============================================

CREATE TABLE IF NOT EXISTS usage_overage_charges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  customer_id UUID NOT NULL,
  subscription_id UUID REFERENCES client_service_subscriptions(id),
  resource_type VARCHAR(50) NOT NULL, -- 'disk_space', 'bandwidth', 'websites', 'emails', 'databases'
  overage_amount DECIMAL(10,2) NOT NULL, -- Amount over limit (e.g., 5.5 GB)
  rate_per_unit DECIMAL(10,2) NOT NULL DEFAULT 0.10, -- $0.10/GB default
  total_charge DECIMAL(10,4) NOT NULL,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  invoice_id UUID, -- Reference to invoice when billed
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'billed', 'paid', 'waived'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_usage_overage_charges_tenant ON usage_overage_charges(tenant_id);
CREATE INDEX idx_usage_overage_charges_customer ON usage_overage_charges(customer_id);
CREATE INDEX idx_usage_overage_charges_subscription ON usage_overage_charges(subscription_id);
CREATE INDEX idx_usage_overage_charges_status ON usage_overage_charges(status);
CREATE INDEX idx_usage_overage_charges_period ON usage_overage_charges(billing_period_start, billing_period_end);

-- Overage rate configuration per plan
CREATE TABLE IF NOT EXISTS plan_overage_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  plan_id UUID REFERENCES service_plans(id),
  resource_type VARCHAR(50) NOT NULL,
  rate_per_unit DECIMAL(10,2) NOT NULL, -- e.g., $0.10/GB
  grace_amount DECIMAL(10,2) DEFAULT 0, -- Grace amount before charging (e.g., 1GB free overage)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_plan_overage_rates_plan ON plan_overage_rates(plan_id);

-- ============================================
-- 2. TRIAL PERIODS & FREEMIUM
-- ============================================

-- Add trial columns to client_service_subscriptions
ALTER TABLE client_service_subscriptions 
  ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_days INTEGER,
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS converted_from_trial BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_conversion_date TIMESTAMP;

-- Add trial configuration to service_plans
ALTER TABLE service_plans
  ADD COLUMN IF NOT EXISTS trial_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_days INTEGER DEFAULT 14,
  ADD COLUMN IF NOT EXISTS trial_requires_payment_method BOOLEAN DEFAULT true;

-- Trial conversion tracking
CREATE TABLE IF NOT EXISTS trial_conversions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  customer_id UUID NOT NULL,
  subscription_id UUID REFERENCES client_service_subscriptions(id),
  trial_started_at TIMESTAMP NOT NULL,
  trial_ended_at TIMESTAMP NOT NULL,
  converted_to_paid BOOLEAN NOT NULL,
  conversion_date TIMESTAMP,
  final_plan_id UUID REFERENCES service_plans(id),
  conversion_revenue DECIMAL(10,2),
  marketing_source VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_trial_conversions_tenant ON trial_conversions(tenant_id);
CREATE INDEX idx_trial_conversions_customer ON trial_conversions(customer_id);
CREATE INDEX idx_trial_conversions_converted ON trial_conversions(converted_to_paid);

-- ============================================
-- 3. REFERRAL PROGRAM
-- ============================================

CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  customer_id UUID NOT NULL,
  referral_code VARCHAR(50) UNIQUE NOT NULL,
  discount_type VARCHAR(20) DEFAULT 'credit', -- 'credit', 'percentage', 'fixed'
  discount_value DECIMAL(10,2) NOT NULL, -- $10 credit or 10% off
  referrer_reward_type VARCHAR(20) DEFAULT 'credit',
  referrer_reward_value DECIMAL(10,2) NOT NULL, -- $10 credit to referrer
  max_uses INTEGER, -- NULL = unlimited
  current_uses INTEGER DEFAULT 0,
  total_revenue_generated DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_referral_codes_tenant ON referral_codes(tenant_id);
CREATE INDEX idx_referral_codes_customer ON referral_codes(customer_id);
CREATE INDEX idx_referral_codes_code ON referral_codes(referral_code);

CREATE TABLE IF NOT EXISTS referral_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  referral_code_id UUID REFERENCES referral_codes(id),
  referrer_id UUID NOT NULL, -- Customer who shared the code
  referee_id UUID NOT NULL, -- New customer who used the code
  referee_subscription_id UUID REFERENCES client_service_subscriptions(id),
  referrer_reward_amount DECIMAL(10,2) NOT NULL,
  referee_discount_amount DECIMAL(10,2) NOT NULL,
  referee_subscription_value DECIMAL(10,2), -- First payment amount
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'paid', 'cancelled'
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_referral_rewards_tenant ON referral_rewards(tenant_id);
CREATE INDEX idx_referral_rewards_referrer ON referral_rewards(referrer_id);
CREATE INDEX idx_referral_rewards_referee ON referral_rewards(referee_id);
CREATE INDEX idx_referral_rewards_status ON referral_rewards(status);

-- ============================================
-- 4. ANNUAL COMMIT DISCOUNTS
-- ============================================

-- Add commitment columns to subscriptions
ALTER TABLE client_service_subscriptions
  ADD COLUMN IF NOT EXISTS has_annual_commit BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS commit_start_date DATE,
  ADD COLUMN IF NOT EXISTS commit_end_date DATE,
  ADD COLUMN IF NOT EXISTS commit_discount_percent DECIMAL(5,2), -- e.g., 15.00 for 15%
  ADD COLUMN IF NOT EXISTS early_termination_fee DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS commit_months INTEGER; -- 12, 24, 36 months

CREATE TABLE IF NOT EXISTS commitment_violations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  subscription_id UUID REFERENCES client_service_subscriptions(id),
  customer_id UUID NOT NULL,
  original_commit_end_date DATE NOT NULL,
  actual_termination_date DATE NOT NULL,
  months_remaining INTEGER NOT NULL,
  early_termination_fee DECIMAL(10,2) NOT NULL,
  fee_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'invoiced', 'paid', 'waived'
  waived_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_commitment_violations_tenant ON commitment_violations(tenant_id);
CREATE INDEX idx_commitment_violations_subscription ON commitment_violations(subscription_id);

-- ============================================
-- 5. RESOURCE POOLING (ENTERPRISE)
-- ============================================

CREATE TABLE IF NOT EXISTS resource_pools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  customer_id UUID NOT NULL, -- Enterprise customer who owns the pool
  pool_name VARCHAR(255) NOT NULL,
  pool_type VARCHAR(50) DEFAULT 'shared', -- 'shared', 'dedicated', 'hybrid'
  total_disk_gb DECIMAL(10,2) NOT NULL,
  total_bandwidth_gb DECIMAL(10,2) NOT NULL,
  total_websites INTEGER,
  total_emails INTEGER,
  total_databases INTEGER,
  used_disk_gb DECIMAL(10,2) DEFAULT 0,
  used_bandwidth_gb DECIMAL(10,2) DEFAULT 0,
  used_websites INTEGER DEFAULT 0,
  used_emails INTEGER DEFAULT 0,
  used_databases INTEGER DEFAULT 0,
  price_monthly DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_resource_pools_tenant ON resource_pools(tenant_id);
CREATE INDEX idx_resource_pools_customer ON resource_pools(customer_id);

CREATE TABLE IF NOT EXISTS pooled_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  resource_pool_id UUID REFERENCES resource_pools(id),
  subscription_id UUID REFERENCES client_service_subscriptions(id),
  allocated_disk_gb DECIMAL(10,2),
  allocated_bandwidth_gb DECIMAL(10,2),
  allocated_websites INTEGER,
  allocated_emails INTEGER,
  allocated_databases INTEGER,
  priority_level INTEGER DEFAULT 1, -- 1-10, for resource contention
  is_active BOOLEAN DEFAULT true,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  removed_at TIMESTAMP
);

CREATE INDEX idx_pooled_subscriptions_pool ON pooled_subscriptions(resource_pool_id);
CREATE INDEX idx_pooled_subscriptions_subscription ON pooled_subscriptions(subscription_id);

-- ============================================
-- 6. GRACE PERIODS & DUNNING MANAGEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS failed_payment_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  subscription_id UUID REFERENCES client_service_subscriptions(id),
  customer_id UUID NOT NULL,
  invoice_id UUID, -- Reference to invoice
  payment_amount DECIMAL(10,2) NOT NULL,
  failure_reason TEXT,
  attempt_number INTEGER NOT NULL,
  next_retry_date DATE,
  retry_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'scheduled', 'retried', 'abandoned'
  last_retry_at TIMESTAMP,
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_failed_payment_attempts_tenant ON failed_payment_attempts(tenant_id);
CREATE INDEX idx_failed_payment_attempts_subscription ON failed_payment_attempts(subscription_id);
CREATE INDEX idx_failed_payment_attempts_retry_date ON failed_payment_attempts(next_retry_date);
CREATE INDEX idx_failed_payment_attempts_status ON failed_payment_attempts(retry_status);

CREATE TABLE IF NOT EXISTS dunning_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  rule_name VARCHAR(255) NOT NULL,
  days_after_failure INTEGER NOT NULL, -- Day 1, 3, 7, 14, 30
  action_type VARCHAR(50) NOT NULL, -- 'email', 'retry_payment', 'suspend_service', 'delete_account'
  email_template_id UUID, -- Reference to email templates
  is_active BOOLEAN DEFAULT true,
  execution_order INTEGER NOT NULL, -- Order of execution
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dunning_rules_tenant ON dunning_rules(tenant_id);

-- ============================================
-- 7. PROMOTIONAL PRICING & DISCOUNT CODES
-- ============================================

CREATE TABLE IF NOT EXISTS promotional_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  promo_code VARCHAR(50) UNIQUE NOT NULL,
  promo_name VARCHAR(255) NOT NULL,
  discount_type VARCHAR(20) NOT NULL, -- 'percentage', 'fixed', 'free_months'
  discount_value DECIMAL(10,2) NOT NULL,
  applies_to VARCHAR(50) DEFAULT 'all', -- 'all', 'new_customers', 'upgrades', 'specific_plans'
  applicable_plan_ids UUID[], -- Array of plan IDs
  min_purchase_amount DECIMAL(10,2),
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  valid_from TIMESTAMP NOT NULL,
  valid_until TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_stackable BOOLEAN DEFAULT false, -- Can combine with other promos?
  created_by UUID, -- Admin user who created it
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_promotional_pricing_tenant ON promotional_pricing(tenant_id);
CREATE INDEX idx_promotional_pricing_code ON promotional_pricing(promo_code);
CREATE INDEX idx_promotional_pricing_active ON promotional_pricing(is_active);
CREATE INDEX idx_promotional_pricing_dates ON promotional_pricing(valid_from, valid_until);

CREATE TABLE IF NOT EXISTS promo_code_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  promo_id UUID REFERENCES promotional_pricing(id),
  customer_id UUID NOT NULL,
  subscription_id UUID REFERENCES client_service_subscriptions(id),
  discount_amount DECIMAL(10,2) NOT NULL,
  original_amount DECIMAL(10,2) NOT NULL,
  final_amount DECIMAL(10,2) NOT NULL,
  redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_promo_redemptions_tenant ON promo_code_redemptions(tenant_id);
CREATE INDEX idx_promo_redemptions_promo ON promo_code_redemptions(promo_id);
CREATE INDEX idx_promo_redemptions_customer ON promo_code_redemptions(customer_id);

-- ============================================
-- 8. LOYALTY & VOLUME DISCOUNTS
-- ============================================

CREATE TABLE IF NOT EXISTS loyalty_discounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  customer_id UUID NOT NULL,
  discount_type VARCHAR(20) NOT NULL, -- 'tenure', 'volume', 'staff', 'custom'
  discount_percent DECIMAL(5,2) NOT NULL, -- e.g., 5.00 for 5%
  reason VARCHAR(255), -- e.g., "3 years of service", "10+ websites"
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_loyalty_discounts_tenant ON loyalty_discounts(tenant_id);
CREATE INDEX idx_loyalty_discounts_customer ON loyalty_discounts(customer_id);
CREATE INDEX idx_loyalty_discounts_active ON loyalty_discounts(is_active);

-- Loyalty tier configuration
CREATE TABLE IF NOT EXISTS loyalty_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  tier_name VARCHAR(100) NOT NULL,
  tier_level INTEGER NOT NULL,
  requirements JSONB NOT NULL, -- e.g., {"min_months": 12, "min_spend": 500}
  benefits JSONB NOT NULL, -- e.g., {"discount_percent": 5, "priority_support": true}
  discount_percent DECIMAL(5,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 9. AI-POWERED PLAN RECOMMENDATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS plan_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  customer_id UUID NOT NULL,
  current_plan_id UUID REFERENCES service_plans(id),
  recommended_plan_id UUID REFERENCES service_plans(id),
  recommendation_reason TEXT NOT NULL,
  confidence_score DECIMAL(5,2), -- 0-100
  usage_analysis JSONB, -- e.g., {"avg_disk_usage": 85, "avg_bandwidth": 78}
  potential_savings DECIMAL(10,2),
  potential_revenue DECIMAL(10,2), -- For upsells
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'accepted', 'declined', 'expired'
  sent_at TIMESTAMP,
  accepted_at TIMESTAMP,
  declined_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_plan_recommendations_tenant ON plan_recommendations(tenant_id);
CREATE INDEX idx_plan_recommendations_customer ON plan_recommendations(customer_id);
CREATE INDEX idx_plan_recommendations_status ON plan_recommendations(status);

-- ============================================
-- 10. CLIENT SUCCESS METRICS DASHBOARD
-- ============================================

CREATE TABLE IF NOT EXISTS client_success_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  customer_id UUID NOT NULL,
  metric_date DATE NOT NULL,
  uptime_percentage DECIMAL(5,2), -- e.g., 99.99
  attacks_blocked INTEGER DEFAULT 0,
  malware_scans INTEGER DEFAULT 0,
  malware_threats_found INTEGER DEFAULT 0,
  backup_count INTEGER DEFAULT 0,
  cdn_bandwidth_saved_gb DECIMAL(10,2),
  ssl_certificates_renewed INTEGER DEFAULT 0,
  support_tickets_resolved INTEGER DEFAULT 0,
  avg_response_time_minutes DECIMAL(10,2),
  estimated_value_delivered DECIMAL(10,2), -- ROI calculation
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_client_success_metrics_tenant ON client_success_metrics(tenant_id);
CREATE INDEX idx_client_success_metrics_customer ON client_success_metrics(customer_id);
CREATE INDEX idx_client_success_metrics_date ON client_success_metrics(metric_date);

CREATE TABLE IF NOT EXISTS success_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  customer_id UUID NOT NULL,
  milestone_type VARCHAR(50) NOT NULL, -- 'first_year', '10k_attacks_blocked', '100_backups', etc.
  milestone_name VARCHAR(255) NOT NULL,
  milestone_description TEXT,
  achieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  badge_awarded BOOLEAN DEFAULT false,
  notification_sent BOOLEAN DEFAULT false
);

CREATE INDEX idx_success_milestones_tenant ON success_milestones(tenant_id);
CREATE INDEX idx_success_milestones_customer ON success_milestones(customer_id);

-- ============================================
-- TRIGGERS FOR AUTO-UPDATED TIMESTAMPS
-- ============================================

CREATE TRIGGER update_usage_overage_charges_updated_at
  BEFORE UPDATE ON usage_overage_charges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plan_overage_rates_updated_at
  BEFORE UPDATE ON plan_overage_rates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_referral_codes_updated_at
  BEFORE UPDATE ON referral_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_referral_rewards_updated_at
  BEFORE UPDATE ON referral_rewards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resource_pools_updated_at
  BEFORE UPDATE ON resource_pools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_failed_payment_attempts_updated_at
  BEFORE UPDATE ON failed_payment_attempts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_promotional_pricing_updated_at
  BEFORE UPDATE ON promotional_pricing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DEFAULT DATA - OVERAGE RATES
-- ============================================

-- Insert default overage rates for existing plans (if they exist)
INSERT INTO plan_overage_rates (tenant_id, plan_id, resource_type, rate_per_unit, grace_amount)
SELECT 
  sp.tenant_id,
  sp.id,
  'disk_space',
  CASE 
    WHEN sp.tier_level = 1 THEN 0.15 -- Starter: $0.15/GB
    WHEN sp.tier_level = 2 THEN 0.12 -- Professional: $0.12/GB
    WHEN sp.tier_level = 3 THEN 0.10 -- Business: $0.10/GB
    ELSE 0.08 -- Enterprise: $0.08/GB
  END,
  CASE 
    WHEN sp.tier_level >= 3 THEN 5.0 -- Business+ gets 5GB grace
    ELSE 1.0 -- Others get 1GB grace
  END
FROM service_plans sp
WHERE NOT EXISTS (
  SELECT 1 FROM plan_overage_rates por 
  WHERE por.plan_id = sp.id AND por.resource_type = 'disk_space'
);

INSERT INTO plan_overage_rates (tenant_id, plan_id, resource_type, rate_per_unit, grace_amount)
SELECT 
  sp.tenant_id,
  sp.id,
  'bandwidth',
  CASE 
    WHEN sp.tier_level = 1 THEN 0.05 -- Starter: $0.05/GB
    WHEN sp.tier_level = 2 THEN 0.04 -- Professional: $0.04/GB
    WHEN sp.tier_level = 3 THEN 0.03 -- Business: $0.03/GB
    ELSE 0.02 -- Enterprise: $0.02/GB
  END,
  CASE 
    WHEN sp.tier_level >= 3 THEN 20.0 -- Business+ gets 20GB grace
    ELSE 5.0 -- Others get 5GB grace
  END
FROM service_plans sp
WHERE NOT EXISTS (
  SELECT 1 FROM plan_overage_rates por 
  WHERE por.plan_id = sp.id AND por.resource_type = 'bandwidth'
);

-- ============================================
-- DEFAULT DATA - DUNNING RULES
-- ============================================

INSERT INTO dunning_rules (tenant_id, rule_name, days_after_failure, action_type, execution_order)
VALUES 
  (NULL, 'Day 1: Send payment failed notification', 1, 'email', 1),
  (NULL, 'Day 3: Retry payment automatically', 3, 'retry_payment', 2),
  (NULL, 'Day 7: Second retry + warning email', 7, 'retry_payment', 3),
  (NULL, 'Day 14: Final retry + suspension warning', 14, 'retry_payment', 4),
  (NULL, 'Day 21: Suspend service', 21, 'suspend_service', 5),
  (NULL, 'Day 30: Delete account warning', 30, 'email', 6)
ON CONFLICT DO NOTHING;

-- ============================================
-- DEFAULT DATA - LOYALTY TIERS
-- ============================================

INSERT INTO loyalty_tiers (tenant_id, tier_name, tier_level, requirements, benefits, discount_percent)
VALUES
  (NULL, 'Bronze', 1, '{"min_months": 6}'::jsonb, '{"discount_percent": 2}'::jsonb, 2.00),
  (NULL, 'Silver', 2, '{"min_months": 12}'::jsonb, '{"discount_percent": 5, "priority_support": true}'::jsonb, 5.00),
  (NULL, 'Gold', 3, '{"min_months": 24}'::jsonb, '{"discount_percent": 8, "priority_support": true, "free_migrations": 2}'::jsonb, 8.00),
  (NULL, 'Platinum', 4, '{"min_months": 36}'::jsonb, '{"discount_percent": 10, "priority_support": true, "free_migrations": 5, "dedicated_support": true}'::jsonb, 10.00)
ON CONFLICT DO NOTHING;

-- ============================================
-- DEFAULT DATA - SEASONAL PROMO CODES
-- ============================================

INSERT INTO promotional_pricing (tenant_id, promo_code, promo_name, discount_type, discount_value, applies_to, valid_from, valid_until, max_uses)
VALUES
  (NULL, 'BLACKFRIDAY2025', 'Black Friday 2025', 'percentage', 40.00, 'new_customers', '2025-11-28 00:00:00', '2025-12-01 23:59:59', 1000),
  (NULL, 'SUMMER2025', 'Summer Special', 'free_months', 3.00, 'new_customers', '2025-06-01 00:00:00', '2025-08-31 23:59:59', 500),
  (NULL, 'WELCOME10', 'Welcome Discount', 'percentage', 10.00, 'new_customers', '2025-01-01 00:00:00', '2025-12-31 23:59:59', NULL),
  (NULL, 'UPGRADE15', 'Upgrade Incentive', 'percentage', 15.00, 'upgrades', '2025-01-01 00:00:00', '2025-12-31 23:59:59', NULL)
ON CONFLICT (promo_code) DO NOTHING;

-- ============================================
-- ENABLE TRIALS ON DEFAULT PLANS
-- ============================================

UPDATE service_plans
SET 
  trial_enabled = true,
  trial_days = CASE 
    WHEN tier_level = 1 THEN 7  -- Starter: 7 days
    WHEN tier_level = 2 THEN 14 -- Professional: 14 days
    WHEN tier_level = 3 THEN 30 -- Business: 30 days
    ELSE 0 -- Enterprise: No trial (contact sales)
  END,
  trial_requires_payment_method = CASE
    WHEN tier_level <= 2 THEN true -- Starter/Pro require payment method
    ELSE false -- Business+ can trial without payment
  END
WHERE tier_level IN (1, 2, 3);

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

COMMENT ON TABLE usage_overage_charges IS 'Tracks overage charges for resource usage beyond plan limits';
COMMENT ON TABLE referral_codes IS 'Customer referral codes with rewards tracking';
COMMENT ON TABLE resource_pools IS 'Enterprise resource pooling for flexible allocation';
COMMENT ON TABLE failed_payment_attempts IS 'Dunning management for failed payments';
COMMENT ON TABLE promotional_pricing IS 'Promotional discount codes and seasonal campaigns';
COMMENT ON TABLE loyalty_discounts IS 'Customer loyalty and tenure-based discounts';
COMMENT ON TABLE plan_recommendations IS 'AI-powered plan upgrade/downgrade recommendations';
COMMENT ON TABLE client_success_metrics IS 'ROI and value delivery tracking for customers';
