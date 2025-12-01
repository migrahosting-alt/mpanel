-- Stripe Order Provisioning Integration
-- Created: 2025-11-27
-- Purpose: Track Stripe payments and convert to mPanel subscriptions

-- Stripe orders table
CREATE TABLE IF NOT EXISTS stripe_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
    amount INT NOT NULL, -- in cents
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(50) NOT NULL, -- paid, failed, refunded
    customer_email VARCHAR(255),
    cart JSONB DEFAULT '[]',
    raw_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP,
    
    -- Optional link to user if found/created
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL
);

-- Hosting subscriptions derived from Stripe orders
CREATE TABLE IF NOT EXISTS hosting_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES stripe_orders(id) ON DELETE CASCADE,
    
    -- Product info from cart
    product_code VARCHAR(100) NOT NULL, -- e.g. "starter", "vps-pro"
    product_name VARCHAR(255) NOT NULL,
    billing_cycle VARCHAR(50) NOT NULL, -- monthly, annually, triennially
    price_cents INT NOT NULL,
    quantity INT DEFAULT 1,
    
    -- Provisioning status
    status VARCHAR(50) DEFAULT 'pending', -- pending, active, cancelled, suspended
    provisioning_status VARCHAR(50) DEFAULT 'pending', -- pending, provisioning, completed, failed
    
    -- Service lifecycle
    starts_at TIMESTAMP,
    renews_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Link to actual provisioned service (once created)
    service_id VARCHAR(255), -- Future: link to websites, mailboxes, etc.
    service_type VARCHAR(50), -- hosting, email, domain, ssl, addon
    
    -- Provisioning metadata
    provisioning_data JSONB DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stripe_orders_payment_intent ON stripe_orders(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_stripe_orders_customer_email ON stripe_orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_stripe_orders_status ON stripe_orders(status);
CREATE INDEX IF NOT EXISTS idx_stripe_orders_created_at ON stripe_orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hosting_subscriptions_order_id ON hosting_subscriptions(order_id);
CREATE INDEX IF NOT EXISTS idx_hosting_subscriptions_status ON hosting_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_hosting_subscriptions_provisioning_status ON hosting_subscriptions(provisioning_status);
CREATE INDEX IF NOT EXISTS idx_hosting_subscriptions_product_code ON hosting_subscriptions(product_code);

-- Comments for documentation
COMMENT ON TABLE stripe_orders IS 'Stripe payment records from marketing website';
COMMENT ON TABLE hosting_subscriptions IS 'Hosting subscriptions created from Stripe orders, pending provisioning';
COMMENT ON COLUMN hosting_subscriptions.provisioning_status IS 'Tracks provisioning workflow: pending → provisioning → completed/failed';
COMMENT ON COLUMN hosting_subscriptions.service_id IS 'Links to actual provisioned service once created (website ID, mailbox ID, etc.)';
