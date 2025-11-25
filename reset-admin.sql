DELETE FROM users WHERE email = 'admin@migrahosting.com';

INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role, status, email_verified, created_at, updated_at)
VALUES (
  NULL,
  'admin@migrahosting.com',
  '$2b$10$UzQldFjeViIIwzBRkxuSh.4/F0.k87RnvmBuLpGGXNs8dVvIv09R6',
  'Admin',
  'User',
  'admin',
  'active',
  TRUE,
  NOW(),
  NOW()
);

SELECT email, role, LENGTH(password_hash) as hash_length FROM users WHERE email = 'admin@migrahosting.com';
