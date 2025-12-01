-- Migration: Add-ons System
-- Date: 2025-11-28
-- Description: Create subscription_addons table and seed add-on products
-- ============================================================================

-- Create subscription_addons table for tracking add-ons attached to subscriptions
CREATE TABLE IF NOT EXISTS subscription_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  
  -- Must match one of the codes in ADDONS_BY_CODE (addons.js)
  addon_code VARCHAR(100) NOT NULL,
  
  -- Number of units purchased (>=1, only >1 for stackable add-ons)
  units INT NOT NULL DEFAULT 1 CHECK (units >= 1),
  
  -- Price snapshot at time of purchase (in USD)
  unit_price_usd DECIMAL(10, 2) NOT NULL,
  
  -- Billing period: 'MONTHLY' or 'YEARLY'
  billing_period VARCHAR(20) NOT NULL CHECK (billing_period IN ('MONTHLY', 'YEARLY')),
  
  -- Next billing date for this add-on
  next_billing_date TIMESTAMP WITH TIME ZONE,
  
  -- Status: active, cancelled, suspended
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'suspended')),
  
  -- Stripe subscription item ID (if using Stripe for billing)
  stripe_subscription_item_id VARCHAR(255),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_subscription_addons_subscription ON subscription_addons(subscription_id);
CREATE INDEX idx_subscription_addons_code ON subscription_addons(addon_code);
CREATE INDEX idx_subscription_addons_status ON subscription_addons(status) WHERE status = 'active';
CREATE INDEX idx_subscription_addons_next_billing ON subscription_addons(next_billing_date) WHERE status = 'active';

-- Domain add-ons table (for DOMAIN-specific add-ons like Premium SSL)
CREATE TABLE IF NOT EXISTS domain_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_registration_id UUID NOT NULL, -- References domain_registrations table if exists
  domain_name VARCHAR(255) NOT NULL,
  
  -- Must match one of the codes in ADDONS_BY_CODE
  addon_code VARCHAR(100) NOT NULL,
  
  -- Price snapshot at time of purchase (in USD)
  unit_price_usd DECIMAL(10, 2) NOT NULL,
  
  -- Billing period: 'MONTHLY' or 'YEARLY'
  billing_period VARCHAR(20) NOT NULL CHECK (billing_period IN ('MONTHLY', 'YEARLY')),
  
  -- Next billing date for this add-on
  next_billing_date TIMESTAMP WITH TIME ZONE,
  
  -- Status: active, cancelled, suspended
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'suspended')),
  
  -- Stripe subscription item ID (if using Stripe for billing)
  stripe_subscription_item_id VARCHAR(255),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Only one of each add-on type per domain
  UNIQUE(domain_name, addon_code)
);

CREATE INDEX idx_domain_addons_domain ON domain_addons(domain_name);
CREATE INDEX idx_domain_addons_code ON domain_addons(addon_code);
CREATE INDEX idx_domain_addons_status ON domain_addons(status) WHERE status = 'active';

-- ============================================================================
-- Seed Add-on Products into products table
-- These are the add-on products that can be purchased
-- ============================================================================

-- Get the default tenant ID (MigraHosting)
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Get the default tenant
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'migrahosting' OR name ILIKE '%migrahosting%' LIMIT 1;
  
  -- If no tenant found, use default instance
  IF v_tenant_id IS NULL THEN
    SELECT id INTO v_tenant_id FROM tenants LIMIT 1;
  END IF;
  
  -- If still no tenant, create one
  IF v_tenant_id IS NULL THEN
    INSERT INTO tenants (name, slug, domain)
    VALUES ('MigraHosting', 'migrahosting', 'migrahosting.com')
    RETURNING id INTO v_tenant_id;
  END IF;

  -- Insert Premium SSL add-on
  INSERT INTO products (tenant_id, name, description, type, billing_cycle, price, setup_fee, currency, taxable, metadata, status)
  VALUES (
    v_tenant_id,
    'Premium SSL',
    'Premium SSL certificate with managed renewals and site seal for one domain.',
    'addon',
    'yearly',
    9.99,
    0,
    'USD',
    true,
    '{"addon_code": "ADDON_PREMIUM_SSL", "applicableTo": ["DOMAIN"], "stackable": false, "provisioning": {"enablePremiumSsl": true}}'::jsonb,
    'active'
  )
  ON CONFLICT DO NOTHING;

  -- Insert Daily Backups add-on
  INSERT INTO products (tenant_id, name, description, type, billing_cycle, price, setup_fee, currency, taxable, metadata, status)
  VALUES (
    v_tenant_id,
    'Daily Backups',
    'Automatic daily backups with 30-day retention for your hosting or VPS service.',
    'addon',
    'monthly',
    4.99,
    0,
    'USD',
    true,
    '{"addon_code": "ADDON_DAILY_BACKUPS", "applicableTo": ["HOSTING", "VPS"], "stackable": false, "provisioning": {"enablePremiumBackups30d": true}}'::jsonb,
    'active'
  )
  ON CONFLICT DO NOTHING;

  -- Insert Priority Support add-on
  INSERT INTO products (tenant_id, name, description, type, billing_cycle, price, setup_fee, currency, taxable, metadata, status)
  VALUES (
    v_tenant_id,
    'Priority Support',
    'Jump the queue with priority support and faster response SLAs.',
    'addon',
    'monthly',
    19.99,
    0,
    'USD',
    true,
    '{"addon_code": "ADDON_PRIORITY_SUPPORT", "applicableTo": ["HOSTING", "VPS"], "stackable": false, "provisioning": {"enablePrioritySupport": true}}'::jsonb,
    'active'
  )
  ON CONFLICT DO NOTHING;

  -- Insert 100GB Storage add-on
  INSERT INTO products (tenant_id, name, description, type, billing_cycle, price, setup_fee, currency, taxable, metadata, status)
  VALUES (
    v_tenant_id,
    '100GB Storage',
    'Extra 100GB of premium SSD storage on top of your base plan quota.',
    'addon',
    'monthly',
    7.99,
    0,
    'USD',
    true,
    '{"addon_code": "ADDON_100GB_STORAGE", "applicableTo": ["HOSTING", "VPS"], "stackable": true, "maxUnits": 10, "provisioning": {"extraStorageGbPerUnit": 100}}'::jsonb,
    'active'
  )
  ON CONFLICT DO NOTHING;

  -- Insert CDN add-on
  INSERT INTO products (tenant_id, name, description, type, billing_cycle, price, setup_fee, currency, taxable, metadata, status)
  VALUES (
    v_tenant_id,
    'CDN',
    'CDN acceleration for the primary domain on this hosting or VPS service.',
    'addon',
    'monthly',
    5.99,
    0,
    'USD',
    true,
    '{"addon_code": "ADDON_CDN", "applicableTo": ["HOSTING", "VPS"], "stackable": false, "provisioning": {"enableCdn": true}}'::jsonb,
    'active'
  )
  ON CONFLICT DO NOTHING;

  -- Insert Monitoring add-on
  INSERT INTO products (tenant_id, name, description, type, billing_cycle, price, setup_fee, currency, taxable, metadata, status)
  VALUES (
    v_tenant_id,
    'Monitoring',
    '24/7 uptime monitoring with instant alerts via email (and later SMS/WhatsApp).',
    'addon',
    'monthly',
    3.99,
    0,
    'USD',
    true,
    '{"addon_code": "ADDON_MONITORING", "applicableTo": ["HOSTING", "VPS"], "stackable": false, "provisioning": {"enableMonitoring": true}}'::jsonb,
    'active'
  )
  ON CONFLICT DO NOTHING;

END $$;

-- ============================================================================
-- Create function to get active add-ons for a subscription
-- ============================================================================
CREATE OR REPLACE FUNCTION get_subscription_addons(p_subscription_id UUID)
RETURNS TABLE (
  addon_code VARCHAR(100),
  units INT,
  unit_price_usd DECIMAL(10,2),
  billing_period VARCHAR(20),
  next_billing_date TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sa.addon_code,
    sa.units,
    sa.unit_price_usd,
    sa.billing_period,
    sa.next_billing_date,
    sa.status
  FROM subscription_addons sa
  WHERE sa.subscription_id = p_subscription_id
    AND sa.status = 'active';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Create function to calculate total add-on cost for a subscription
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_subscription_addon_totals(p_subscription_id UUID)
RETURNS TABLE (
  monthly_total DECIMAL(10,2),
  yearly_total DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(CASE WHEN billing_period = 'MONTHLY' THEN unit_price_usd * units ELSE 0 END), 0)::DECIMAL(10,2) as monthly_total,
    COALESCE(SUM(CASE WHEN billing_period = 'YEARLY' THEN unit_price_usd * units ELSE 0 END), 0)::DECIMAL(10,2) as yearly_total
  FROM subscription_addons
  WHERE subscription_id = p_subscription_id
    AND status = 'active';
END;
$$ LANGUAGE plpgsql;
