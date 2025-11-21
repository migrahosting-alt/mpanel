-- Add Guardian permissions to RBAC system
-- Migration: 20251116_add_guardian_permissions

-- Add guardian.* permissions to permissions table
INSERT INTO permissions (resource, action, description) VALUES
  ('guardian', 'read', 'View Guardian instances and analytics'),
  ('guardian', 'create', 'Create new Guardian instances'),
  ('guardian', 'update', 'Update Guardian instance configuration'),
  ('guardian', 'delete', 'Delete Guardian instances')
ON CONFLICT (resource, action) DO NOTHING;

-- Grant guardian permissions to super_admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
AND p.resource = 'guardian'
ON CONFLICT DO NOTHING;

-- Grant guardian permissions to admin role  
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
AND p.resource = 'guardian'
ON CONFLICT DO NOTHING;

-- Grant guardian read/create/update to manager role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'manager'
AND p.resource = 'guardian'
AND p.action IN ('read', 'create', 'update')
ON CONFLICT DO NOTHING;

-- Grant guardian read to support role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'support'
AND p.resource = 'guardian'
AND p.action = 'read'
ON CONFLICT DO NOTHING;
