-- Create email_preferences table
CREATE TABLE IF NOT EXISTS email_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invoice_emails BOOLEAN DEFAULT true,
  payment_emails BOOLEAN DEFAULT true,
  service_emails BOOLEAN DEFAULT true,
  marketing_emails BOOLEAN DEFAULT false,
  security_emails BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Create index on user_id for faster lookups
CREATE INDEX idx_email_preferences_user_id ON email_preferences(user_id);

-- Add comment
COMMENT ON TABLE email_preferences IS 'User email notification preferences';
