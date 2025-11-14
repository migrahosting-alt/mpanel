-- Create ssl_certificates table
CREATE TABLE IF NOT EXISTS ssl_certificates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain VARCHAR(255) NOT NULL,
  type VARCHAR(50) DEFAULT 'letsencrypt', -- 'letsencrypt' or 'custom'
  certificate TEXT NOT NULL,
  private_key TEXT NOT NULL,
  chain TEXT,
  issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'expiring', 'expired', 'revoked', 'renewing'
  auto_renew BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_ssl_certs_user_id ON ssl_certificates(user_id);
CREATE INDEX idx_ssl_certs_domain ON ssl_certificates(domain);
CREATE INDEX idx_ssl_certs_status ON ssl_certificates(status);
CREATE INDEX idx_ssl_certs_expires_at ON ssl_certificates(expires_at);

-- Add comments
COMMENT ON TABLE ssl_certificates IS 'SSL/TLS certificates for domains';
COMMENT ON COLUMN ssl_certificates.type IS 'Certificate type: letsencrypt (auto-issued) or custom (user-uploaded)';
COMMENT ON COLUMN ssl_certificates.status IS 'Certificate status: active, expiring, expired, revoked, renewing';
COMMENT ON COLUMN ssl_certificates.auto_renew IS 'Automatically renew certificate before expiry (Let''s Encrypt only)';
