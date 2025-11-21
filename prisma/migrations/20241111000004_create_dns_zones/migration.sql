-- Create dns_zones table
CREATE TABLE IF NOT EXISTS dns_zones (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain VARCHAR(255) NOT NULL UNIQUE,
  default_ttl INTEGER DEFAULT 3600,
  serial BIGINT NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create dns_records table
CREATE TABLE IF NOT EXISTS dns_records (
  id SERIAL PRIMARY KEY,
  zone_id INTEGER NOT NULL REFERENCES dns_zones(id) ON DELETE CASCADE,
  type VARCHAR(10) NOT NULL, -- A, AAAA, CNAME, MX, TXT, NS, SOA, SRV, etc.
  name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  ttl INTEGER DEFAULT 3600,
  priority INTEGER, -- For MX and SRV records
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_dns_zones_user_id ON dns_zones(user_id);
CREATE INDEX idx_dns_zones_domain ON dns_zones(domain);
CREATE INDEX idx_dns_records_zone_id ON dns_records(zone_id);
CREATE INDEX idx_dns_records_type ON dns_records(type);
CREATE INDEX idx_dns_records_name ON dns_records(name);

-- Add comments
COMMENT ON TABLE dns_zones IS 'DNS zones managed by users';
COMMENT ON TABLE dns_records IS 'DNS records within zones';
COMMENT ON COLUMN dns_zones.serial IS 'Zone serial number (timestamp-based) for SOA record';
COMMENT ON COLUMN dns_records.priority IS 'Priority for MX and SRV records';
