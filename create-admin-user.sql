-- Create admin user for mPanel
-- Password: admin123
-- Hash generated with bcrypt rounds=10

INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role, status, email_verified, created_at, updated_at)
VALUES (
  NULL,
  'admin@migrahosting.com',
  '$2b$10$CPYNCyCGsjzRxJYaAGNG8OHUOT0tYEf3KpBuyiVrG5lZnbkTCIIRC',
  'Admin',
  'User',
  'admin',
  'active',
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;
