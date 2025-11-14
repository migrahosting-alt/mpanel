-- RBAC System Migration
-- Multi-level role and permission system

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  level INTEGER NOT NULL DEFAULT 0, -- Hierarchy level (0=highest/super_admin, 10=lowest/customer)
  is_admin BOOLEAN DEFAULT false,
  is_client BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  resource VARCHAR(50) NOT NULL, -- e.g., 'servers', 'users', 'billing', 'deployments'
  action VARCHAR(50) NOT NULL, -- e.g., 'create', 'read', 'update', 'delete', 'deploy'
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create role_permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role_id, permission_id)
);

-- Add role_id to users table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='users' AND column_name='role_id') THEN
    ALTER TABLE users ADD COLUMN role_id UUID REFERENCES roles(id);
  END IF;
END $$;

-- Create deployments table for tracking one-click deployments
CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  tenant_id UUID REFERENCES tenants(id),
  type VARCHAR(50) NOT NULL, -- 'database', 'user', 'table', 'api', 'website', 'form'
  name VARCHAR(255) NOT NULL,
  server_id UUID REFERENCES servers(id),
  config JSONB, -- Deployment configuration
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'deploying', 'completed', 'failed'
  result JSONB, -- Deployment result (credentials, URLs, etc.)
  error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_deployments_user ON deployments(user_id);
CREATE INDEX IF NOT EXISTS idx_deployments_tenant ON deployments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);
CREATE INDEX IF NOT EXISTS idx_deployments_type ON deployments(type);

-- Insert default roles
INSERT INTO roles (name, display_name, description, level, is_admin, is_client) VALUES
  ('super_admin', 'Super Administrator', 'Full system access - can do everything', 0, true, false),
  ('admin', 'Administrator', 'Full administrative access - manage all resources', 1, true, false),
  ('editor', 'Editor', 'Can edit content and manage resources but not users', 2, true, false),
  ('contributor', 'Contributor', 'Can create and edit own content', 3, true, false),
  ('sales', 'Sales Team', 'Can manage customers, products, and invoices', 4, true, false),
  ('support', 'Support Team', 'Can view and respond to tickets, manage customer services', 5, true, false),
  ('customer_service', 'Customer Service', 'Can view customer data and assist with basic tasks', 6, true, false),
  ('client', 'Client', 'Standard customer account', 10, false, true)
ON CONFLICT (name) DO NOTHING;

-- Insert all permissions
INSERT INTO permissions (name, resource, action, description) VALUES
  -- Server permissions
  ('servers.create', 'servers', 'create', 'Create new servers'),
  ('servers.read', 'servers', 'read', 'View servers'),
  ('servers.update', 'servers', 'update', 'Edit server configuration'),
  ('servers.delete', 'servers', 'delete', 'Delete servers'),
  ('servers.deploy', 'servers', 'deploy', 'Deploy resources to servers'),
  
  -- User permissions
  ('users.create', 'users', 'create', 'Create new users'),
  ('users.read', 'users', 'read', 'View users'),
  ('users.update', 'users', 'update', 'Edit user details'),
  ('users.delete', 'users', 'delete', 'Delete users'),
  ('users.manage_roles', 'users', 'manage_roles', 'Assign roles to users'),
  
  -- Customer permissions
  ('customers.create', 'customers', 'create', 'Create new customers'),
  ('customers.read', 'customers', 'read', 'View customers'),
  ('customers.update', 'customers', 'update', 'Edit customer details'),
  ('customers.delete', 'customers', 'delete', 'Delete customers'),
  
  -- Billing permissions
  ('billing.read', 'billing', 'read', 'View invoices and subscriptions'),
  ('billing.create', 'billing', 'create', 'Create invoices'),
  ('billing.update', 'billing', 'update', 'Edit billing information'),
  ('billing.refund', 'billing', 'refund', 'Process refunds'),
  
  -- Deployment permissions
  ('deployments.database', 'deployments', 'database', 'Deploy databases'),
  ('deployments.user', 'deployments', 'user', 'Deploy users'),
  ('deployments.table', 'deployments', 'table', 'Deploy tables'),
  ('deployments.api', 'deployments', 'api', 'Deploy APIs'),
  ('deployments.website', 'deployments', 'website', 'Deploy websites'),
  ('deployments.form', 'deployments', 'form', 'Deploy forms'),
  ('deployments.read', 'deployments', 'read', 'View deployments'),
  ('deployments.delete', 'deployments', 'delete', 'Delete deployments'),
  
  -- Website permissions
  ('websites.create', 'websites', 'create', 'Create websites'),
  ('websites.read', 'websites', 'read', 'View websites'),
  ('websites.update', 'websites', 'update', 'Edit websites'),
  ('websites.delete', 'websites', 'delete', 'Delete websites'),
  
  -- DNS permissions
  ('dns.create', 'dns', 'create', 'Create DNS zones'),
  ('dns.read', 'dns', 'read', 'View DNS zones'),
  ('dns.update', 'dns', 'update', 'Edit DNS records'),
  ('dns.delete', 'dns', 'delete', 'Delete DNS zones'),
  
  -- Email permissions
  ('email.create', 'email', 'create', 'Create email accounts'),
  ('email.read', 'email', 'read', 'View email accounts'),
  ('email.update', 'email', 'update', 'Edit email accounts'),
  ('email.delete', 'email', 'delete', 'Delete email accounts'),
  
  -- Database permissions
  ('databases.create', 'databases', 'create', 'Create databases'),
  ('databases.read', 'databases', 'read', 'View databases'),
  ('databases.update', 'databases', 'update', 'Edit databases'),
  ('databases.delete', 'databases', 'delete', 'Delete databases'),
  
  -- Support permissions
  ('support.create', 'support', 'create', 'Create support tickets'),
  ('support.read', 'support', 'read', 'View support tickets'),
  ('support.update', 'support', 'update', 'Respond to tickets'),
  ('support.delete', 'support', 'delete', 'Delete tickets'),
  
  -- Role management permissions
  ('roles.create', 'roles', 'create', 'Create roles'),
  ('roles.read', 'roles', 'read', 'View roles'),
  ('roles.update', 'roles', 'update', 'Edit roles'),
  ('roles.delete', 'roles', 'delete', 'Delete roles'),
  ('roles.assign_permissions', 'roles', 'assign_permissions', 'Assign permissions to roles'),
  
  -- Provisioning permissions
  ('provisioning.read', 'provisioning', 'read', 'View provisioning queue'),
  ('provisioning.retry', 'provisioning', 'retry', 'Retry failed provisioning'),
  ('provisioning.manual', 'provisioning', 'manual', 'Trigger manual provisioning')
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to super_admin (all permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to admin (all except role management)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin' AND p.name NOT LIKE 'roles.%'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to editor
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'editor' AND p.name IN (
  'servers.read', 'servers.update', 'servers.deploy',
  'websites.create', 'websites.read', 'websites.update',
  'dns.create', 'dns.read', 'dns.update',
  'email.create', 'email.read', 'email.update',
  'databases.create', 'databases.read', 'databases.update',
  'deployments.database', 'deployments.website', 'deployments.read',
  'customers.read', 'customers.update'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to contributor
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'contributor' AND p.name IN (
  'websites.create', 'websites.read', 'websites.update',
  'dns.read', 'dns.create',
  'deployments.read', 'deployments.website'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to sales
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'sales' AND p.name IN (
  'customers.create', 'customers.read', 'customers.update',
  'billing.read', 'billing.create', 'billing.update',
  'websites.read', 'websites.create'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to support
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'support' AND p.name IN (
  'customers.read', 'customers.update',
  'support.create', 'support.read', 'support.update',
  'websites.read', 'websites.update',
  'dns.read', 'email.read', 'databases.read',
  'billing.read'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to customer_service
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'customer_service' AND p.name IN (
  'customers.read',
  'support.read', 'support.update',
  'websites.read',
  'billing.read'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to client (limited access)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'client' AND p.name IN (
  'websites.read',
  'dns.read',
  'email.read',
  'databases.read',
  'billing.read',
  'support.create', 'support.read'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Update existing admin users to have super_admin role
DO $$
DECLARE
  super_admin_role_id UUID;
BEGIN
  SELECT id INTO super_admin_role_id FROM roles WHERE name = 'super_admin';
  
  IF super_admin_role_id IS NOT NULL THEN
    UPDATE users 
    SET role_id = super_admin_role_id 
    WHERE role = 'admin' AND role_id IS NULL;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON TABLE roles IS 'User roles with hierarchical levels';
COMMENT ON TABLE permissions IS 'Granular permissions for resources and actions';
COMMENT ON TABLE role_permissions IS 'Junction table mapping roles to permissions';
COMMENT ON TABLE deployments IS 'One-click deployment tracking for databases, APIs, websites, etc.';

COMMENT ON COLUMN roles.level IS 'Hierarchy level: 0=highest (super_admin), 10=lowest (client)';
COMMENT ON COLUMN roles.is_admin IS 'Whether this role has admin portal access';
COMMENT ON COLUMN roles.is_client IS 'Whether this role has client portal access';
COMMENT ON COLUMN deployments.type IS 'Type: database, user, table, api, website, form';
COMMENT ON COLUMN deployments.config IS 'JSONB configuration for the deployment';
COMMENT ON COLUMN deployments.result IS 'JSONB result with credentials, URLs, etc.';
