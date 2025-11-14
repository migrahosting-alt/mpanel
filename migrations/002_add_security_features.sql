-- Migration: Add Two-Factor Authentication and Security Features
-- Created: 2025-11-11

-- Add 2FA columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP;

-- Create two_factor_backup_codes table
CREATE TABLE IF NOT EXISTS two_factor_backup_codes (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  used_at TIMESTAMP,
  UNIQUE(user_id, code_hash)
);

CREATE INDEX IF NOT EXISTS idx_backup_codes_user_id ON two_factor_backup_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_backup_codes_used ON two_factor_backup_codes(used_at) WHERE used_at IS NULL;

-- Create email_verification_tokens table
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMP,
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_email_tokens_token ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_verification_tokens(user_id);

-- Create audit_logs table for security events
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(255),
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- Create sessions table for session management
CREATE TABLE IF NOT EXISTS user_sessions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) NOT NULL UNIQUE,
  device_info JSONB,
  ip_address INET,
  user_agent TEXT,
  location VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_activity TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(expires_at, revoked_at) WHERE revoked_at IS NULL;

-- Create password_reset_tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  used_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);

-- Add comments for documentation
COMMENT ON TABLE two_factor_backup_codes IS 'Stores hashed backup codes for 2FA recovery';
COMMENT ON TABLE email_verification_tokens IS 'Stores email verification tokens';
COMMENT ON TABLE audit_logs IS 'Security and action audit trail';
COMMENT ON TABLE user_sessions IS 'Active user sessions for session management';
COMMENT ON TABLE password_reset_tokens IS 'Password reset tokens';

COMMENT ON COLUMN users.two_factor_enabled IS 'Whether 2FA is enabled for this user';
COMMENT ON COLUMN users.two_factor_secret IS 'TOTP secret for 2FA (base32 encoded)';
COMMENT ON COLUMN users.email_verified IS 'Whether email has been verified';
COMMENT ON COLUMN users.email_verified_at IS 'When email was verified';
