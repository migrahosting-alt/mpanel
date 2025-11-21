-- Domain Pricing Table for Automatic Price Management
-- This table stores domain TLD pricing with automatic updates from NameSilo

CREATE TABLE IF NOT EXISTS domain_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tld VARCHAR(50) UNIQUE NOT NULL,
  
  -- Cost from NameSilo (what we pay)
  cost_price DECIMAL(10, 2) NOT NULL,
  
  -- Prices we charge customers
  registration_price DECIMAL(10, 2) NOT NULL,
  renewal_price DECIMAL(10, 2) NOT NULL,
  transfer_price DECIMAL(10, 2) NOT NULL,
  
  -- Profit margin percentage
  profit_margin DECIMAL(5, 2) NOT NULL,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Pricing metadata
  last_updated TIMESTAMP,
  price_source VARCHAR(50) DEFAULT 'namesilo',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_domain_pricing_tld ON domain_pricing(tld);
CREATE INDEX IF NOT EXISTS idx_domain_pricing_active ON domain_pricing(is_active);
CREATE INDEX IF NOT EXISTS idx_domain_pricing_last_updated ON domain_pricing(last_updated);

-- Update trigger
CREATE TRIGGER update_domain_pricing_updated_at
  BEFORE UPDATE ON domain_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert some popular TLDs with placeholder pricing (will be updated by API)
INSERT INTO domain_pricing (tld, cost_price, registration_price, renewal_price, transfer_price, profit_margin, is_active)
VALUES 
  ('.com', 9.99, 11.99, 11.99, 11.99, 20.02, true),
  ('.net', 11.99, 13.99, 13.99, 13.99, 16.68, true),
  ('.org', 11.99, 13.99, 13.99, 13.99, 16.68, true),
  ('.io', 39.99, 45.99, 45.99, 45.99, 15.00, true),
  ('.co', 24.99, 28.99, 28.99, 28.99, 16.01, true),
  ('.ai', 99.99, 109.99, 109.99, 109.99, 10.00, true),
  ('.app', 14.99, 17.99, 17.99, 17.99, 20.01, true),
  ('.dev', 14.99, 17.99, 17.99, 17.99, 20.01, true)
ON CONFLICT (tld) DO NOTHING;

COMMENT ON TABLE domain_pricing IS 'Domain TLD pricing with automatic updates from NameSilo registrar';
COMMENT ON COLUMN domain_pricing.cost_price IS 'Wholesale price from NameSilo (our cost)';
COMMENT ON COLUMN domain_pricing.registration_price IS 'Price charged to customers for new registrations';
COMMENT ON COLUMN domain_pricing.profit_margin IS 'Profit margin percentage over cost';
