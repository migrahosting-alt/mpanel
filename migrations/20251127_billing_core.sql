-- Migration: Core billing system
-- Date: 2025-11-27
-- Description: Customer, Products, Subscriptions, Servers, and Provisioning Tasks

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  stripe_customer_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_stripe ON customers(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  billing_cycle VARCHAR(50) NOT NULL, -- 'monthly', 'yearly', 'triennial'
  stripe_price_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_stripe_price ON products(stripe_price_id) WHERE stripe_price_id IS NOT NULL;

-- Servers table
CREATE TABLE IF NOT EXISTS servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  fqdn VARCHAR(255) NOT NULL,
  ip_address INET,
  location VARCHAR(255),
  role VARCHAR(100) NOT NULL, -- 'web', 'mail', 'dns', 'all-in-one'
  api_base_url VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_servers_name ON servers(name);
CREATE INDEX idx_servers_active ON servers(is_active) WHERE is_active = TRUE;

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  status VARCHAR(50) NOT NULL, -- 'pending_provisioning', 'active', 'suspended', 'cancelled'
  stripe_subscription_id VARCHAR(255) UNIQUE,
  stripe_payment_intent VARCHAR(255),
  domain VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_customer ON subscriptions(customer_id);
CREATE INDEX idx_subscriptions_product ON subscriptions(product_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX idx_subscriptions_domain ON subscriptions(domain) WHERE domain IS NOT NULL;

-- Provisioning Tasks table
CREATE TABLE IF NOT EXISTS provisioning_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  server_id UUID REFERENCES servers(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL, -- 'pending', 'in_progress', 'success', 'failed'
  step VARCHAR(100) NOT NULL, -- 'create_account', 'sync_dns', 'issue_ssl', etc.
  payload_json JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_provisioning_tasks_subscription ON provisioning_tasks(subscription_id);
CREATE INDEX idx_provisioning_tasks_server ON provisioning_tasks(server_id) WHERE server_id IS NOT NULL;
CREATE INDEX idx_provisioning_tasks_status ON provisioning_tasks(status);
CREATE INDEX idx_provisioning_tasks_step ON provisioning_tasks(step);
CREATE INDEX idx_provisioning_tasks_created ON provisioning_tasks(created_at DESC);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_servers_updated_at BEFORE UPDATE ON servers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_provisioning_tasks_updated_at BEFORE UPDATE ON provisioning_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed initial data: Products
INSERT INTO products (slug, name, description, billing_cycle) VALUES
  ('starter', 'Starter Hosting', 'Perfect for personal sites and small projects', 'monthly'),
  ('wp-growth', 'WordPress Growth', 'Optimized WordPress hosting with premium features', 'monthly'),
  ('vps-pro', 'VPS Pro', 'Dedicated resources for high-traffic applications', 'monthly')
ON CONFLICT (slug) DO NOTHING;

-- Seed initial data: Server (srv1)
INSERT INTO servers (name, fqdn, ip_address, location, role, is_active) VALUES
  ('srv1', 'srv1.migrahosting.com', '10.1.10.10', 'Primary Datacenter', 'all-in-one', TRUE)
ON CONFLICT (name) DO NOTHING;

COMMENT ON TABLE customers IS 'Customer records from Stripe payments';
COMMENT ON TABLE products IS 'Hosting products/plans available for purchase';
COMMENT ON TABLE subscriptions IS 'Active and historical customer subscriptions';
COMMENT ON TABLE servers IS 'Infrastructure servers for hosting provisioning';
COMMENT ON TABLE provisioning_tasks IS 'Automated provisioning workflow tasks';
