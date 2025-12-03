-- Client Plan Access Control System
-- Security-focused tiered access with premium tool bundles
-- Date: November 18, 2025

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. SERVICE PLANS (Hosting Plans with Access Tiers)
-- ============================================
CREATE TABLE IF NOT EXISTS service_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  
  -- Plan Information
  name VARCHAR(100) NOT NULL, -- "Starter", "Professional", "Business", "Enterprise"
  slug VARCHAR(100) NOT NULL, -- "starter", "professional", "business", "enterprise"
  description TEXT,
  plan_type VARCHAR(50) NOT NULL, -- "shared-hosting", "vps", "dedicated", "cloud"
  tier_level INTEGER NOT NULL DEFAULT 1, -- 1=Basic, 2=Standard, 3=Premium, 4=Enterprise
  
  -- Pricing
  price_monthly DECIMAL(10,2) NOT NULL,
  price_yearly DECIMAL(10,2), -- Discounted annual price
  price_biennial DECIMAL(10,2), -- 2-year discount
  price_triennial DECIMAL(10,2), -- 3-year discount
  setup_fee DECIMAL(10,2) DEFAULT 0.00,
  
  -- Resource Limits
  disk_space_gb INTEGER NOT NULL, -- Storage allocation
  bandwidth_gb INTEGER NOT NULL, -- Monthly bandwidth
  websites_limit INTEGER DEFAULT 1, -- Number of websites
  subdomains_limit INTEGER DEFAULT 10,
  email_accounts_limit INTEGER DEFAULT 10,
  databases_limit INTEGER DEFAULT 5,
  ftp_accounts_limit INTEGER DEFAULT 5,
  cron_jobs_limit INTEGER DEFAULT 5,
  
  -- Server Resources (for VPS/Dedicated)
  cpu_cores INTEGER,
  ram_gb INTEGER,
  dedicated_ip BOOLEAN DEFAULT false,
  
  -- Security Features (All plans get these basics)
  free_ssl BOOLEAN DEFAULT true,
  firewall_enabled BOOLEAN DEFAULT true,
  ddos_protection BOOLEAN DEFAULT true,
  malware_scanning BOOLEAN DEFAULT true,
  daily_backups BOOLEAN DEFAULT true,
  backup_retention_days INTEGER DEFAULT 7,
  two_factor_auth BOOLEAN DEFAULT true,
  ip_whitelist BOOLEAN DEFAULT true,
  
  -- Premium Security (Tier 3+)
  advanced_waf BOOLEAN DEFAULT false, -- Web Application Firewall
  geo_blocking BOOLEAN DEFAULT false,
  intrusion_detection BOOLEAN DEFAULT false,
  security_audit_logs BOOLEAN DEFAULT false,
  custom_security_rules BOOLEAN DEFAULT false,
  hourly_backups BOOLEAN DEFAULT false,
  backup_retention_days_extended INTEGER, -- 30/60/90 days
  
  -- Performance Features
  cdn_enabled BOOLEAN DEFAULT false,
  cdn_bandwidth_gb INTEGER,
  http2_enabled BOOLEAN DEFAULT true,
  http3_enabled BOOLEAN DEFAULT false,
  caching_enabled BOOLEAN DEFAULT true,
  advanced_caching BOOLEAN DEFAULT false, -- Redis, Memcached
  load_balancing BOOLEAN DEFAULT false,
  
  -- Developer Tools Access
  ssh_access BOOLEAN DEFAULT false,
  git_integration BOOLEAN DEFAULT false,
  staging_environments INTEGER DEFAULT 0,
  wp_cli_access BOOLEAN DEFAULT false,
  composer_access BOOLEAN DEFAULT false,
  node_js_support BOOLEAN DEFAULT false,
  python_support BOOLEAN DEFAULT false,
  ruby_support BOOLEAN DEFAULT false,
  
  -- Premium Tools (Pay extra or bundled)
  seo_tools_access BOOLEAN DEFAULT false,
  analytics_premium BOOLEAN DEFAULT false,
  uptime_monitoring BOOLEAN DEFAULT false,
  performance_monitoring BOOLEAN DEFAULT false,
  log_management BOOLEAN DEFAULT false,
  
  -- Support Level
  support_level VARCHAR(50) DEFAULT 'standard', -- "standard", "priority", "dedicated"
  support_response_sla VARCHAR(50), -- "24h", "4h", "1h", "15min"
  phone_support BOOLEAN DEFAULT false,
  chat_support BOOLEAN DEFAULT true,
  ticket_support BOOLEAN DEFAULT true,
  
  -- White Label (Enterprise only)
  white_label_enabled BOOLEAN DEFAULT false,
  custom_branding BOOLEAN DEFAULT false,
  custom_nameservers BOOLEAN DEFAULT false,
  
  -- Marketing & Integrations
  marketing_credits DECIMAL(10,2) DEFAULT 0.00, -- Google Ads, etc.
  email_marketing_contacts INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  popular_badge BOOLEAN DEFAULT false,
  
  -- Metadata
  features_summary JSONB, -- ["Unlimited websites", "Free SSL", etc.]
  restrictions JSONB, -- Custom limits/rules
  addon_compatible BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. PREMIUM TOOL BUNDLES
-- ============================================
CREATE TABLE IF NOT EXISTS premium_tool_bundles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  
  -- Bundle Information
  name VARCHAR(100) NOT NULL, -- "Security Pro", "Developer Suite", "Marketing Pack"
  slug VARCHAR(100) NOT NULL,
  description TEXT,
  bundle_type VARCHAR(50) NOT NULL, -- "security", "developer", "performance", "marketing", "analytics"
  
  -- Pricing
  price_monthly DECIMAL(10,2) NOT NULL,
  price_yearly DECIMAL(10,2),
  discount_percent DECIMAL(5,2), -- Discount vs buying tools separately
  
  -- Included Features (JSONB for flexibility)
  included_features JSONB NOT NULL,
  /* Example:
  {
    "tools": ["waf", "ids", "geo_blocking", "custom_rules"],
    "limits": {
      "security_rules": 100,
      "geo_countries": 50,
      "audit_retention_days": 90
    }
  }
  */
  
  -- Compatibility
  minimum_plan_tier INTEGER DEFAULT 1,
  compatible_plan_types TEXT[], -- ["shared-hosting", "vps"]
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  trial_days INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 3. INDIVIDUAL PREMIUM TOOLS (À la carte)
-- ============================================
CREATE TABLE IF NOT EXISTS premium_tools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  
  -- Tool Information
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,
  tool_category VARCHAR(50) NOT NULL, -- "security", "performance", "developer", "analytics", "marketing"
  
  -- Pricing
  price_monthly DECIMAL(10,2) NOT NULL,
  price_yearly DECIMAL(10,2),
  price_one_time DECIMAL(10,2), -- For one-time purchase tools
  billing_type VARCHAR(20) DEFAULT 'recurring', -- "recurring", "one_time", "usage_based"
  
  -- Usage-based pricing (optional)
  usage_metric VARCHAR(50), -- "api_calls", "storage_gb", "bandwidth_gb", "users"
  usage_price_per_unit DECIMAL(10,4),
  included_usage INTEGER, -- Free tier included
  
  -- Access Requirements
  minimum_plan_tier INTEGER DEFAULT 1,
  requires_addon BOOLEAN DEFAULT false,
  
  -- Limits & Quotas
  quota_limits JSONB,
  /* Example:
  {
    "api_requests_per_day": 10000,
    "storage_gb": 50,
    "concurrent_users": 10
  }
  */
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  trial_days INTEGER DEFAULT 7,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 4. CLIENT SERVICE SUBSCRIPTIONS (Links clients to plans)
-- ============================================
CREATE TABLE IF NOT EXISTS client_service_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  
  -- Subscription Details
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  service_plan_id UUID REFERENCES service_plans(id),
  
  -- Billing
  billing_cycle VARCHAR(20) NOT NULL, -- "monthly", "yearly", "biennial", "triennial"
  price_paid DECIMAL(10,2) NOT NULL, -- Locked-in price
  next_billing_date DATE,
  
  -- Usage Tracking
  disk_usage_gb DECIMAL(10,2) DEFAULT 0,
  bandwidth_usage_gb DECIMAL(10,2) DEFAULT 0,
  current_websites INTEGER DEFAULT 0,
  current_email_accounts INTEGER DEFAULT 0,
  current_databases INTEGER DEFAULT 0,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- "active", "suspended", "cancelled", "expired"
  suspension_reason VARCHAR(100),
  trial_end_date DATE,
  
  -- Dates
  activated_at TIMESTAMP,
  suspended_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  expires_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 5. CLIENT ADDON SUBSCRIPTIONS (Premium tools)
-- ============================================
CREATE TABLE IF NOT EXISTS client_addon_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  
  -- Subscription Details
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  service_subscription_id UUID REFERENCES client_service_subscriptions(id) ON DELETE CASCADE,
  
  -- Addon Type (bundle or individual tool)
  addon_type VARCHAR(20) NOT NULL, -- "bundle", "tool"
  bundle_id UUID REFERENCES premium_tool_bundles(id),
  tool_id UUID REFERENCES premium_tools(id),
  
  -- Billing
  billing_cycle VARCHAR(20) NOT NULL,
  price_paid DECIMAL(10,2) NOT NULL,
  next_billing_date DATE,
  
  -- Usage (for usage-based tools)
  usage_current INTEGER DEFAULT 0,
  usage_limit INTEGER,
  overage_charges DECIMAL(10,2) DEFAULT 0,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active',
  trial_end_date DATE,
  
  -- Dates
  activated_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraint: Either bundle_id OR tool_id must be set
  CHECK (
    (addon_type = 'bundle' AND bundle_id IS NOT NULL AND tool_id IS NULL) OR
    (addon_type = 'tool' AND tool_id IS NOT NULL AND bundle_id IS NULL)
  )
);

-- ============================================
-- 6. SECURITY POLICY TEMPLATES (Pre-configured security)
-- ============================================
CREATE TABLE IF NOT EXISTS security_policy_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  
  -- Template Info
  name VARCHAR(100) NOT NULL, -- "E-commerce Standard", "SaaS High Security", "Blog Basic"
  description TEXT,
  recommended_for VARCHAR(100), -- "E-commerce websites", "SaaS applications"
  
  -- Security Settings
  firewall_rules JSONB NOT NULL,
  /* Example:
  {
    "block_countries": ["CN", "RU"],
    "rate_limiting": {"requests_per_minute": 60},
    "block_known_bots": true,
    "block_tor": true
  }
  */
  
  waf_rules JSONB,
  ssl_settings JSONB,
  backup_settings JSONB,
  
  -- Minimum tier required
  minimum_tier INTEGER DEFAULT 1,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES
-- ============================================

-- Service Plans
CREATE INDEX idx_service_plans_tenant_id ON service_plans(tenant_id);
CREATE INDEX idx_service_plans_slug ON service_plans(slug);
CREATE INDEX idx_service_plans_tier_level ON service_plans(tier_level);
CREATE INDEX idx_service_plans_active ON service_plans(is_active, display_order);

-- Premium Tool Bundles
CREATE INDEX idx_premium_bundles_tenant_id ON premium_tool_bundles(tenant_id);
CREATE INDEX idx_premium_bundles_slug ON premium_tool_bundles(slug);
CREATE INDEX idx_premium_bundles_type ON premium_tool_bundles(bundle_type);
CREATE INDEX idx_premium_bundles_active ON premium_tool_bundles(is_active);

-- Premium Tools
CREATE INDEX idx_premium_tools_tenant_id ON premium_tools(tenant_id);
CREATE INDEX idx_premium_tools_slug ON premium_tools(slug);
CREATE INDEX idx_premium_tools_category ON premium_tools(tool_category);
CREATE INDEX idx_premium_tools_active ON premium_tools(is_active);

-- Client Subscriptions
CREATE INDEX idx_client_subscriptions_customer_id ON client_service_subscriptions(customer_id);
CREATE INDEX idx_client_subscriptions_tenant_id ON client_service_subscriptions(tenant_id);
CREATE INDEX idx_client_subscriptions_plan_id ON client_service_subscriptions(service_plan_id);
CREATE INDEX idx_client_subscriptions_status ON client_service_subscriptions(status);
CREATE INDEX idx_client_subscriptions_next_billing ON client_service_subscriptions(next_billing_date);

-- Client Addon Subscriptions
CREATE INDEX idx_client_addon_customer_id ON client_addon_subscriptions(customer_id);
CREATE INDEX idx_client_addon_service_id ON client_addon_subscriptions(service_subscription_id);
CREATE INDEX idx_client_addon_bundle_id ON client_addon_subscriptions(bundle_id);
CREATE INDEX idx_client_addon_tool_id ON client_addon_subscriptions(tool_id);
CREATE INDEX idx_client_addon_status ON client_addon_subscriptions(status);

-- Security Templates
CREATE INDEX idx_security_templates_tenant_id ON security_policy_templates(tenant_id);
CREATE INDEX idx_security_templates_tier ON security_policy_templates(minimum_tier);
CREATE INDEX idx_security_templates_active ON security_policy_templates(is_active);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_service_plans_updated_at
  BEFORE UPDATE ON service_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_premium_bundles_updated_at
  BEFORE UPDATE ON premium_tool_bundles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_premium_tools_updated_at
  BEFORE UPDATE ON premium_tools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_subscriptions_updated_at
  BEFORE UPDATE ON client_service_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_addon_subscriptions_updated_at
  BEFORE UPDATE ON client_addon_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_security_templates_updated_at
  BEFORE UPDATE ON security_policy_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DEFAULT PLANS (Based on industry analysis)
-- ============================================

-- Get the first tenant (or use your tenant ID)
DO $$
DECLARE
  default_tenant_id UUID;
BEGIN
  SELECT id INTO default_tenant_id FROM tenants LIMIT 1;
  
  IF default_tenant_id IS NOT NULL THEN
    
    -- TIER 1: STARTER (Security-focused basics)
    INSERT INTO service_plans (
      tenant_id, name, slug, description, plan_type, tier_level,
      price_monthly, price_yearly, price_biennial, price_triennial,
      disk_space_gb, bandwidth_gb, websites_limit, email_accounts_limit, databases_limit,
      free_ssl, firewall_enabled, ddos_protection, malware_scanning, daily_backups, backup_retention_days,
      cdn_enabled, ssh_access, git_integration, staging_environments,
      support_level, support_response_sla, display_order, features_summary
    ) VALUES (
      default_tenant_id, 'Starter', 'starter', 
      'Perfect for personal websites and blogs. All essential security included.',
      'shared-hosting', 1,
      4.99, 49.99, 89.99, 119.99,
      10, 100, 1, 5, 2,
      true, true, true, true, true, 7,
      false, false, false, 0,
      'standard', '24h', 1,
      '["1 Website", "10GB SSD Storage", "100GB Bandwidth", "Free SSL Certificate", "DDoS Protection", "Daily Backups", "Malware Scanning", "Email Support"]'::jsonb
    );
    
    -- TIER 2: PROFESSIONAL (Enhanced security + some dev tools)
    INSERT INTO service_plans (
      tenant_id, name, slug, description, plan_type, tier_level,
      price_monthly, price_yearly, price_biennial, price_triennial,
      disk_space_gb, bandwidth_gb, websites_limit, subdomains_limit, email_accounts_limit, databases_limit,
      free_ssl, firewall_enabled, ddos_protection, malware_scanning, daily_backups, backup_retention_days,
      cdn_enabled, cdn_bandwidth_gb, advanced_caching, 
      ssh_access, git_integration, staging_environments, wp_cli_access, composer_access,
      support_level, support_response_sla, chat_support, display_order, popular_badge, features_summary
    ) VALUES (
      default_tenant_id, 'Professional', 'professional',
      'For growing businesses. Enhanced security, CDN, and developer tools included.',
      'shared-hosting', 2,
      14.99, 149.99, 269.99, 359.99,
      50, 500, 5, 50, 25, 10,
      true, true, true, true, true, 14,
      true, 500, true,
      true, true, 1, true, true,
      'priority', '4h', true, 2, true,
      '["5 Websites", "50GB SSD Storage", "500GB Bandwidth + Free CDN", "Advanced Security", "SSH & Git Access", "1 Staging Environment", "14-day Backups", "Priority Support"]'::jsonb
    );
    
    -- TIER 3: BUSINESS (Advanced WAF + premium features)
    INSERT INTO service_plans (
      tenant_id, name, slug, description, plan_type, tier_level,
      price_monthly, price_yearly, price_biennial, price_triennial,
      disk_space_gb, bandwidth_gb, websites_limit, subdomains_limit, email_accounts_limit, databases_limit, dedicated_ip,
      free_ssl, firewall_enabled, ddos_protection, malware_scanning, daily_backups, backup_retention_days,
      advanced_waf, geo_blocking, intrusion_detection, security_audit_logs, custom_security_rules,
      hourly_backups, backup_retention_days_extended,
      cdn_enabled, cdn_bandwidth_gb, advanced_caching, load_balancing,
      ssh_access, git_integration, staging_environments, wp_cli_access, composer_access, node_js_support,
      seo_tools_access, uptime_monitoring, performance_monitoring,
      support_level, support_response_sla, phone_support, chat_support, display_order, features_summary
    ) VALUES (
      default_tenant_id, 'Business', 'business',
      'Enterprise-grade security with Web Application Firewall, IDS, and advanced monitoring.',
      'shared-hosting', 3,
      39.99, 399.99, 719.99, 959.99,
      200, 2000, 25, 200, 100, 50, true,
      true, true, true, true, true, 30,
      true, true, true, true, true,
      true, 60,
      true, 2000, true, true,
      true, true, 3, true, true, true,
      true, true, true,
      'priority', '1h', true, true, 3,
      '["25 Websites", "200GB SSD Storage", "2TB Bandwidth + CDN", "Dedicated IP", "Web Application Firewall", "Intrusion Detection", "Geo-Blocking", "Hourly Backups (60 days)", "3 Staging Environments", "SEO Tools", "Performance Monitoring", "1-hour SLA Support"]'::jsonb
    );
    
    -- TIER 4: ENTERPRISE (Everything + white-label)
    INSERT INTO service_plans (
      tenant_id, name, slug, description, plan_type, tier_level,
      price_monthly, price_yearly, price_biennial, price_triennial,
      disk_space_gb, bandwidth_gb, websites_limit, subdomains_limit, email_accounts_limit, databases_limit, dedicated_ip,
      free_ssl, firewall_enabled, ddos_protection, malware_scanning, daily_backups, backup_retention_days,
      advanced_waf, geo_blocking, intrusion_detection, security_audit_logs, custom_security_rules,
      hourly_backups, backup_retention_days_extended,
      cdn_enabled, cdn_bandwidth_gb, http3_enabled, advanced_caching, load_balancing,
      ssh_access, git_integration, staging_environments, wp_cli_access, composer_access, node_js_support, python_support,
      seo_tools_access, analytics_premium, uptime_monitoring, performance_monitoring, log_management,
      white_label_enabled, custom_branding, custom_nameservers,
      support_level, support_response_sla, phone_support, chat_support, is_featured, display_order, features_summary
    ) VALUES (
      default_tenant_id, 'Enterprise', 'enterprise',
      'Ultimate package with white-label options, dedicated support, and all premium tools included.',
      'cloud', 4,
      99.99, 999.99, 1799.99, 2399.99,
      999999, 999999, 999999, 999999, 999999, 999999, true,
      true, true, true, true, true, 90,
      true, true, true, true, true,
      true, 90,
      true, 999999, true, true, true,
      true, true, 10, true, true, true, true,
      true, true, true, true, true,
      true, true, true,
      'dedicated', '15min', true, true, true, 4,
      '["Unlimited Everything", "Cloud Infrastructure", "99.99% Uptime SLA", "Full WAF + IDS/IPS", "Advanced DDoS Protection", "90-day Hourly Backups", "10 Staging Environments", "White-Label Options", "All Premium Tools Included", "Dedicated Support Manager", "15-minute Response SLA", "Custom Security Rules"]'::jsonb
    );
    
  END IF;
END $$;

-- ============================================
-- DEFAULT PREMIUM BUNDLES
-- ============================================

DO $$
DECLARE
  default_tenant_id UUID;
BEGIN
  SELECT id INTO default_tenant_id FROM tenants LIMIT 1;
  
  IF default_tenant_id IS NOT NULL THEN
    
    -- Security Pro Bundle
    INSERT INTO premium_tool_bundles (
      tenant_id, name, slug, description, bundle_type,
      price_monthly, price_yearly, discount_percent, minimum_plan_tier,
      included_features, is_featured
    ) VALUES (
      default_tenant_id, 'Security Pro', 'security-pro',
      'Advanced security suite with WAF, IDS, geo-blocking, and custom firewall rules. Save 40% vs individual tools.',
      'security',
      29.99, 299.99, 40.00, 1,
      '{"tools": ["advanced_waf", "intrusion_detection", "geo_blocking", "custom_security_rules", "security_audit_logs", "hourly_backups"], "limits": {"security_rules": 100, "geo_countries": 50, "audit_retention_days": 90, "backup_retention_days": 30}}'::jsonb,
      true
    );
    
    -- Developer Suite Bundle
    INSERT INTO premium_tool_bundles (
      tenant_id, name, slug, description, bundle_type,
      price_monthly, price_yearly, discount_percent, minimum_plan_tier,
      included_features
    ) VALUES (
      default_tenant_id, 'Developer Suite', 'developer-suite',
      'Full developer toolkit: Git, SSH, staging environments, WP-CLI, Composer, Node.js, and Python support.',
      'developer',
      19.99, 199.99, 35.00, 1,
      '{"tools": ["ssh_access", "git_integration", "staging_environments", "wp_cli", "composer", "nodejs", "python"], "limits": {"staging_environments": 5, "git_repos": 50}}'::jsonb
    );
    
    -- Performance Pack Bundle
    INSERT INTO premium_tool_bundles (
      tenant_id, name, slug, description, bundle_type,
      price_monthly, price_yearly, discount_percent, minimum_plan_tier,
      included_features
    ) VALUES (
      default_tenant_id, 'Performance Pack', 'performance-pack',
      'CDN, advanced caching (Redis/Memcached), load balancing, and HTTP/3 support for lightning-fast sites.',
      'performance',
      24.99, 249.99, 30.00, 1,
      '{"tools": ["cdn", "advanced_caching", "load_balancing", "http3", "performance_monitoring"], "limits": {"cdn_bandwidth_gb": 1000, "cache_memory_gb": 2}}'::jsonb
    );
    
    -- Marketing & Analytics Bundle
    INSERT INTO premium_tool_bundles (
      tenant_id, name, slug, description, bundle_type,
      price_monthly, price_yearly, discount_percent, minimum_plan_tier,
      included_features
    ) VALUES (
      default_tenant_id, 'Marketing Master', 'marketing-master',
      'SEO tools, premium analytics, uptime monitoring, and $100 Google Ads credit monthly.',
      'marketing',
      34.99, 349.99, 25.00, 2,
      '{"tools": ["seo_tools", "analytics_premium", "uptime_monitoring", "email_marketing"], "limits": {"email_contacts": 10000, "seo_keywords": 500, "uptime_checks_per_minute": 1}, "credits": {"google_ads_monthly": 100}}'::jsonb
    );
    
  END IF;
END $$;

-- ============================================
-- DEFAULT SECURITY POLICY TEMPLATES
-- ============================================

DO $$
DECLARE
  default_tenant_id UUID;
BEGIN
  SELECT id INTO default_tenant_id FROM tenants LIMIT 1;
  
  IF default_tenant_id IS NOT NULL THEN
    
    -- Basic Security (All plans)
    INSERT INTO security_policy_templates (
      tenant_id, name, description, recommended_for, minimum_tier,
      firewall_rules, waf_rules, ssl_settings, backup_settings, is_default
    ) VALUES (
      default_tenant_id, 'Standard Protection', 
      'Baseline security for all websites. Blocks common threats and ensures data safety.',
      'Blogs, personal websites, portfolios',
      1,
      '{"block_known_bots": true, "block_tor": false, "rate_limiting": {"requests_per_minute": 60}, "block_countries": []}'::jsonb,
      '{"mode": "detection", "block_sql_injection": true, "block_xss": true, "block_file_upload": true}'::jsonb,
      '{"force_https": true, "hsts_enabled": true, "ssl_version": "TLSv1.2+"}'::jsonb,
      '{"frequency": "daily", "retention_days": 7, "incremental": true}'::jsonb,
      true
    );
    
    -- E-commerce Security (Tier 2+)
    INSERT INTO security_policy_templates (
      tenant_id, name, description, recommended_for, minimum_tier,
      firewall_rules, waf_rules, ssl_settings, backup_settings
    ) VALUES (
      default_tenant_id, 'E-commerce Standard',
      'Enhanced security for online stores. PCI-DSS compliant baseline configuration.',
      'WooCommerce, Shopify, Magento stores',
      2,
      '{"block_known_bots": true, "block_tor": true, "rate_limiting": {"requests_per_minute": 120, "checkout_limit": 10}, "block_countries": [], "geo_block_high_fraud": true}'::jsonb,
      '{"mode": "blocking", "block_sql_injection": true, "block_xss": true, "block_file_upload": true, "block_credit_card_leakage": true, "block_session_hijacking": true}'::jsonb,
      '{"force_https": true, "hsts_enabled": true, "hsts_preload": true, "ssl_version": "TLSv1.3", "cipher_suite": "strong"}'::jsonb,
      '{"frequency": "hourly", "retention_days": 30, "incremental": true, "encrypted": true}'::jsonb
    );
    
    -- SaaS High Security (Tier 3+)
    INSERT INTO security_policy_templates (
      tenant_id, name, description, recommended_for, minimum_tier,
      firewall_rules, waf_rules, ssl_settings, backup_settings
    ) VALUES (
      default_tenant_id, 'SaaS High Security',
      'Maximum protection for SaaS applications handling sensitive customer data.',
      'SaaS platforms, web applications, APIs',
      3,
      '{"block_known_bots": true, "block_tor": true, "rate_limiting": {"requests_per_minute": 300, "api_limit_per_key": 1000}, "block_countries": ["CN", "RU", "KP"], "require_captcha_on_login": true, "ip_reputation_filtering": true}'::jsonb,
      '{"mode": "blocking", "block_sql_injection": true, "block_xss": true, "block_file_upload": true, "block_api_abuse": true, "block_brute_force": true, "custom_rules": true, "zero_day_protection": true}'::jsonb,
      '{"force_https": true, "hsts_enabled": true, "hsts_preload": true, "ssl_version": "TLSv1.3", "cipher_suite": "strong", "certificate_pinning": true}'::jsonb,
      '{"frequency": "hourly", "retention_days": 90, "incremental": true, "encrypted": true, "offsite_backup": true, "versioning": true}'::jsonb
    );
    
  END IF;
END $$;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE service_plans IS 'Service plans with tiered access control and security features';
COMMENT ON TABLE premium_tool_bundles IS 'Bundled premium tools at discounted prices';
COMMENT ON TABLE premium_tools IS 'Individual premium tools available à la carte';
COMMENT ON TABLE client_service_subscriptions IS 'Client subscriptions to hosting plans';
COMMENT ON TABLE client_addon_subscriptions IS 'Client subscriptions to premium bundles/tools';
COMMENT ON TABLE security_policy_templates IS 'Pre-configured security policies for different use cases';

COMMENT ON COLUMN service_plans.tier_level IS '1=Basic, 2=Standard, 3=Premium, 4=Enterprise - determines feature access';
COMMENT ON COLUMN service_plans.advanced_waf IS 'Web Application Firewall - protects against OWASP Top 10';
COMMENT ON COLUMN service_plans.intrusion_detection IS 'Real-time IDS/IPS monitoring and blocking';
COMMENT ON COLUMN service_plans.geo_blocking IS 'Block traffic from specific countries';
COMMENT ON COLUMN service_plans.hourly_backups IS 'Hourly incremental backups instead of daily';
COMMENT ON COLUMN client_service_subscriptions.disk_usage_gb IS 'Current disk space used by client';
COMMENT ON COLUMN client_addon_subscriptions.overage_charges IS 'Additional charges for exceeding usage limits';
