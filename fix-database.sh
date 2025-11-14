#!/bin/bash

# Fix PostgreSQL Database Setup for mPanel
echo "==> Fixing PostgreSQL database setup..."

# Switch to postgres user and create database properly
sudo -u postgres psql << EOF
-- Create user if not exists
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mpanel_user') THEN
    CREATE ROLE mpanel_user WITH LOGIN PASSWORD 'secure_mpanel_password_2024';
  END IF;
END
\$\$;

-- Grant necessary privileges
ALTER ROLE mpanel_user CREATEDB;

-- Create database (outside of DO block)
DROP DATABASE IF EXISTS mpanel_db;
CREATE DATABASE mpanel_db OWNER mpanel_user;

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE mpanel_db TO mpanel_user;

-- Connect to the database and set up schema
\c mpanel_db

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO mpanel_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO mpanel_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO mpanel_user;

EOF

echo "✅ Database mpanel_db created successfully"
echo "✅ User mpanel_user configured with full privileges"
echo ""
echo "Test connection:"
echo "  sudo -u postgres psql -d mpanel_db -c 'SELECT version();'"
echo ""
echo "Connection string:"
echo "  postgresql://mpanel_user:secure_mpanel_password_2024@localhost:5432/mpanel_db"
