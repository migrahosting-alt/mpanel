# CloudPods RBAC (Role-Based Access Control)

> **Status**: Spec Complete  
> **Priority**: P0 - Foundation for all enterprise features  
> **Depends On**: Base CloudPods system  

---

## 1. Overview

Fine-grained permission system for CloudPods. Not every user in a tenant should be able to nuke pods.

### Goals
- Per-tenant role definitions (owner, admin, devops, developer, viewer)
- Granular permissions (cloudpods.create, cloudpods.destroy, etc.)
- Middleware enforcement on all protected routes
- Self-service role management for tenant owners/admins

---

## 2. Database Schema

### 2.1 `tenant_roles`

Defines available roles per tenant. Some are system-default, others can be custom.

```sql
CREATE TABLE tenant_roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(50) NOT NULL,           -- 'owner', 'admin', 'devops', 'developer', 'viewer'
  display_name    VARCHAR(100),                   -- 'DevOps Engineer'
  description     TEXT,
  is_system       BOOLEAN DEFAULT false,          -- true = cannot be deleted
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_tenant_roles_tenant ON tenant_roles(tenant_id);
```

### 2.2 `tenant_user_roles`

Links users to roles within a tenant.

```sql
CREATE TABLE tenant_user_roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_name       VARCHAR(50) NOT NULL,
  assigned_by     UUID REFERENCES users(id),
  assigned_at     TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,                    -- optional role expiration
  
  UNIQUE(tenant_id, user_id, role_name),
  FOREIGN KEY (tenant_id, role_name) REFERENCES tenant_roles(tenant_id, name)
);

CREATE INDEX idx_tenant_user_roles_user ON tenant_user_roles(user_id);
CREATE INDEX idx_tenant_user_roles_tenant ON tenant_user_roles(tenant_id);
```

### 2.3 `tenant_role_permissions`

Maps roles to specific permissions.

```sql
CREATE TABLE tenant_role_permissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role_name       VARCHAR(50) NOT NULL,
  permission      VARCHAR(100) NOT NULL,          -- 'cloudpods.destroy'
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, role_name, permission),
  FOREIGN KEY (tenant_id, role_name) REFERENCES tenant_roles(tenant_id, name)
);

CREATE INDEX idx_role_permissions_tenant_role ON tenant_role_permissions(tenant_id, role_name);
```

---

## 3. Permission Definitions

### 3.1 CloudPods Permissions

| Permission | Description | Default Roles |
|------------|-------------|---------------|
| `cloudpods.view` | View pods, status, metrics | All roles |
| `cloudpods.create` | Create new pods | owner, admin, devops |
| `cloudpods.destroy` | Destroy pods | owner, admin |
| `cloudpods.scale` | Scale pods (CPU/RAM) | owner, admin, devops |
| `cloudpods.backup` | Create/restore backups | owner, admin, devops |
| `cloudpods.console` | Access pod console/SSH | owner, admin, devops, developer |
| `cloudpods.quota.view` | View quota usage | All roles |
| `cloudpods.quota.manage` | Update quota limits | owner, admin |
| `cloudpods.security.manage` | Manage security groups | owner, admin, devops |

### 3.2 Tenant Management Permissions

| Permission | Description | Default Roles |
|------------|-------------|---------------|
| `tenant.users.view` | View tenant users | owner, admin |
| `tenant.users.manage` | Add/remove users | owner, admin |
| `tenant.roles.manage` | Create/edit roles | owner |
| `tenant.billing.view` | View billing info | owner, admin |
| `tenant.billing.manage` | Update payment methods | owner |
| `tenant.settings.manage` | Tenant settings | owner, admin |

### 3.3 Default Role Hierarchy

```
owner
  └── All permissions
  └── Can assign any role
  └── Cannot be removed (only transferred)

admin
  └── All cloudpods.* permissions
  └── tenant.users.*, tenant.settings.*
  └── Can assign: devops, developer, viewer

devops
  └── cloudpods.view, create, scale, backup, console, security.manage
  └── cloudpods.quota.view

developer
  └── cloudpods.view, console
  └── cloudpods.quota.view

viewer
  └── cloudpods.view
  └── cloudpods.quota.view
```

---

## 4. Service Implementation

### 4.1 `src/services/rbacService.js`

```javascript
// src/services/rbacService.js
import { prisma } from '../config/database.js';

// Default permissions for system roles
const DEFAULT_ROLE_PERMISSIONS = {
  owner: [
    'cloudpods.*',
    'tenant.*',
  ],
  admin: [
    'cloudpods.view', 'cloudpods.create', 'cloudpods.destroy', 
    'cloudpods.scale', 'cloudpods.backup', 'cloudpods.console',
    'cloudpods.quota.view', 'cloudpods.quota.manage',
    'cloudpods.security.manage',
    'tenant.users.view', 'tenant.users.manage',
    'tenant.billing.view', 'tenant.settings.manage',
  ],
  devops: [
    'cloudpods.view', 'cloudpods.create', 'cloudpods.scale',
    'cloudpods.backup', 'cloudpods.console', 'cloudpods.quota.view',
    'cloudpods.security.manage',
  ],
  developer: [
    'cloudpods.view', 'cloudpods.console', 'cloudpods.quota.view',
  ],
  viewer: [
    'cloudpods.view', 'cloudpods.quota.view',
  ],
};

/**
 * Initialize default roles for a new tenant
 */
export async function initializeTenantRoles(tenantId) {
  const roles = Object.keys(DEFAULT_ROLE_PERMISSIONS);
  
  for (const roleName of roles) {
    // Create role
    const role = await prisma.tenantRole.create({
      data: {
        tenantId,
        name: roleName,
        displayName: roleName.charAt(0).toUpperCase() + roleName.slice(1),
        description: `Default ${roleName} role`,
        isSystem: true,
      },
    });
    
    // Create permissions
    const permissions = DEFAULT_ROLE_PERMISSIONS[roleName];
    for (const permission of permissions) {
      await prisma.tenantRolePermission.create({
        data: {
          tenantId,
          roleName,
          permission,
        },
      });
    }
  }
}

/**
 * Get all permissions for a user in a tenant
 */
export async function getUserPermissions(tenantId, userId) {
  // Get user's roles in this tenant
  const userRoles = await prisma.tenantUserRole.findMany({
    where: {
      tenantId,
      userId,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    select: { roleName: true },
  });
  
  if (userRoles.length === 0) {
    return { roles: [], permissions: new Set() };
  }
  
  const roleNames = userRoles.map(r => r.roleName);
  
  // Get all permissions for these roles
  const rolePermissions = await prisma.tenantRolePermission.findMany({
    where: {
      tenantId,
      roleName: { in: roleNames },
    },
    select: { permission: true },
  });
  
  // Expand wildcards (e.g., cloudpods.* → all cloudpods permissions)
  const permissions = new Set();
  for (const rp of rolePermissions) {
    if (rp.permission.endsWith('.*')) {
      const prefix = rp.permission.slice(0, -1); // 'cloudpods.'
      // Add all known permissions with this prefix
      ALL_PERMISSIONS
        .filter(p => p.startsWith(prefix))
        .forEach(p => permissions.add(p));
    } else {
      permissions.add(rp.permission);
    }
  }
  
  return { roles: roleNames, permissions };
}

/**
 * Check if user has a specific permission
 */
export async function hasPermission(tenantId, userId, permission) {
  const { permissions } = await getUserPermissions(tenantId, userId);
  return permissions.has(permission);
}

/**
 * Check if user has ANY of the given permissions
 */
export async function hasAnyPermission(tenantId, userId, requiredPermissions) {
  const { permissions } = await getUserPermissions(tenantId, userId);
  return requiredPermissions.some(p => permissions.has(p));
}

/**
 * Check if user has ALL of the given permissions
 */
export async function hasAllPermissions(tenantId, userId, requiredPermissions) {
  const { permissions } = await getUserPermissions(tenantId, userId);
  return requiredPermissions.every(p => permissions.has(p));
}

/**
 * Assign a role to a user
 */
export async function assignRole(tenantId, userId, roleName, assignedBy, expiresAt = null) {
  // Verify role exists
  const role = await prisma.tenantRole.findUnique({
    where: { tenantId_name: { tenantId, name: roleName } },
  });
  
  if (!role) {
    throw new Error(`Role '${roleName}' does not exist in this tenant`);
  }
  
  return prisma.tenantUserRole.upsert({
    where: {
      tenantId_userId_roleName: { tenantId, userId, roleName },
    },
    create: {
      tenantId,
      userId,
      roleName,
      assignedBy,
      expiresAt,
    },
    update: {
      assignedBy,
      assignedAt: new Date(),
      expiresAt,
    },
  });
}

/**
 * Remove a role from a user
 */
export async function removeRole(tenantId, userId, roleName) {
  // Cannot remove owner from the last owner
  if (roleName === 'owner') {
    const ownerCount = await prisma.tenantUserRole.count({
      where: { tenantId, roleName: 'owner' },
    });
    if (ownerCount <= 1) {
      throw new Error('Cannot remove the last owner from tenant');
    }
  }
  
  return prisma.tenantUserRole.delete({
    where: {
      tenantId_userId_roleName: { tenantId, userId, roleName },
    },
  });
}

/**
 * Get all users and their roles in a tenant
 */
export async function getTenantUsersWithRoles(tenantId) {
  const userRoles = await prisma.tenantUserRole.findMany({
    where: { tenantId },
    include: {
      user: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
    },
  });
  
  // Group by user
  const userMap = new Map();
  for (const ur of userRoles) {
    if (!userMap.has(ur.userId)) {
      userMap.set(ur.userId, {
        user: ur.user,
        roles: [],
      });
    }
    userMap.get(ur.userId).roles.push({
      name: ur.roleName,
      assignedAt: ur.assignedAt,
      expiresAt: ur.expiresAt,
    });
  }
  
  return Array.from(userMap.values());
}

// All known permissions for wildcard expansion
const ALL_PERMISSIONS = [
  'cloudpods.view', 'cloudpods.create', 'cloudpods.destroy',
  'cloudpods.scale', 'cloudpods.backup', 'cloudpods.console',
  'cloudpods.quota.view', 'cloudpods.quota.manage',
  'cloudpods.security.manage',
  'tenant.users.view', 'tenant.users.manage',
  'tenant.roles.manage',
  'tenant.billing.view', 'tenant.billing.manage',
  'tenant.settings.manage',
];

export { DEFAULT_ROLE_PERMISSIONS, ALL_PERMISSIONS };
```

---

## 5. Middleware

### 5.1 `src/middleware/rbac.js`

```javascript
// src/middleware/rbac.js
import { hasPermission, hasAnyPermission } from '../services/rbacService.js';
import { logAuditEvent } from '../services/auditService.js';

/**
 * Require a specific permission
 * Usage: requirePermission('cloudpods.destroy')
 */
export function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.id;
      
      if (!tenantId || !userId) {
        return res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }
      
      const allowed = await hasPermission(tenantId, userId, permission);
      
      if (!allowed) {
        // Log the denied access attempt
        await logAuditEvent({
          tenantId,
          userId,
          action: 'PERMISSION_DENIED',
          context: {
            permission,
            path: req.path,
            method: req.method,
            ip: req.ip,
          },
        });
        
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: `Permission denied: ${permission}`,
          requiredPermission: permission,
        });
      }
      
      // Attach permission info to request for logging
      req.authorizedPermission = permission;
      next();
    } catch (error) {
      console.error('[RBAC] Permission check error:', error);
      res.status(500).json({
        success: false,
        error: 'RBAC_ERROR',
        message: 'Failed to check permissions',
      });
    }
  };
}

/**
 * Require ANY of the specified permissions
 * Usage: requireAnyPermission(['cloudpods.destroy', 'cloudpods.admin'])
 */
export function requireAnyPermission(permissions) {
  return async (req, res, next) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.id;
      
      if (!tenantId || !userId) {
        return res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }
      
      const allowed = await hasAnyPermission(tenantId, userId, permissions);
      
      if (!allowed) {
        await logAuditEvent({
          tenantId,
          userId,
          action: 'PERMISSION_DENIED',
          context: {
            requiredAny: permissions,
            path: req.path,
            method: req.method,
            ip: req.ip,
          },
        });
        
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'Insufficient permissions',
          requiredAny: permissions,
        });
      }
      
      next();
    } catch (error) {
      console.error('[RBAC] Permission check error:', error);
      res.status(500).json({
        success: false,
        error: 'RBAC_ERROR',
        message: 'Failed to check permissions',
      });
    }
  };
}

/**
 * Require tenant ownership (owner role)
 */
export function requireTenantOwner() {
  return requirePermission('tenant.roles.manage');
}
```

---

## 6. API Routes

### 6.1 Role Management Routes

```javascript
// src/routes/rbacRoutes.js
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import * as rbacService from '../services/rbacService.js';
import { logAuditEvent } from '../services/auditService.js';

const router = express.Router();

/**
 * GET /api/rbac/my-permissions
 * Get current user's permissions in their tenant
 */
router.get('/my-permissions', authenticateToken, async (req, res) => {
  try {
    const { roles, permissions } = await rbacService.getUserPermissions(
      req.user.tenantId,
      req.user.id
    );
    
    res.json({
      success: true,
      roles,
      permissions: Array.from(permissions),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/rbac/roles
 * List all roles in tenant
 */
router.get('/roles', 
  authenticateToken, 
  requirePermission('tenant.users.view'),
  async (req, res) => {
    try {
      const roles = await prisma.tenantRole.findMany({
        where: { tenantId: req.user.tenantId },
        include: {
          permissions: { select: { permission: true } },
          _count: { select: { userRoles: true } },
        },
      });
      
      res.json({
        success: true,
        roles: roles.map(r => ({
          name: r.name,
          displayName: r.displayName,
          description: r.description,
          isSystem: r.isSystem,
          permissions: r.permissions.map(p => p.permission),
          userCount: r._count.userRoles,
        })),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * GET /api/rbac/users
 * List all users and their roles in tenant
 */
router.get('/users',
  authenticateToken,
  requirePermission('tenant.users.view'),
  async (req, res) => {
    try {
      const users = await rbacService.getTenantUsersWithRoles(req.user.tenantId);
      res.json({ success: true, users });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * POST /api/rbac/users/:userId/roles
 * Assign role to user
 */
router.post('/users/:userId/roles',
  authenticateToken,
  requirePermission('tenant.users.manage'),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { roleName, expiresAt } = req.body;
      
      // Check if assigner can assign this role
      const assignerPerms = await rbacService.getUserPermissions(
        req.user.tenantId,
        req.user.id
      );
      
      // Only owners can assign owner/admin roles
      if (['owner', 'admin'].includes(roleName) && !assignerPerms.roles.includes('owner')) {
        return res.status(403).json({
          success: false,
          error: 'Only tenant owners can assign owner/admin roles',
        });
      }
      
      const assignment = await rbacService.assignRole(
        req.user.tenantId,
        userId,
        roleName,
        req.user.id,
        expiresAt ? new Date(expiresAt) : null
      );
      
      await logAuditEvent({
        tenantId: req.user.tenantId,
        userId: req.user.id,
        action: 'ROLE_ASSIGNED',
        context: {
          targetUserId: userId,
          roleName,
          expiresAt,
        },
      });
      
      res.json({ success: true, assignment });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
);

/**
 * DELETE /api/rbac/users/:userId/roles/:roleName
 * Remove role from user
 */
router.delete('/users/:userId/roles/:roleName',
  authenticateToken,
  requirePermission('tenant.users.manage'),
  async (req, res) => {
    try {
      const { userId, roleName } = req.params;
      
      await rbacService.removeRole(req.user.tenantId, userId, roleName);
      
      await logAuditEvent({
        tenantId: req.user.tenantId,
        userId: req.user.id,
        action: 'ROLE_REMOVED',
        context: { targetUserId: userId, roleName },
      });
      
      res.json({ success: true, message: 'Role removed' });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
);

/**
 * POST /api/rbac/roles
 * Create custom role (owner only)
 */
router.post('/roles',
  authenticateToken,
  requirePermission('tenant.roles.manage'),
  async (req, res) => {
    try {
      const { name, displayName, description, permissions } = req.body;
      
      // Validate permissions
      const validPermissions = permissions.filter(p => 
        rbacService.ALL_PERMISSIONS.includes(p)
      );
      
      const role = await prisma.tenantRole.create({
        data: {
          tenantId: req.user.tenantId,
          name,
          displayName,
          description,
          isSystem: false,
        },
      });
      
      // Add permissions
      for (const permission of validPermissions) {
        await prisma.tenantRolePermission.create({
          data: {
            tenantId: req.user.tenantId,
            roleName: name,
            permission,
          },
        });
      }
      
      await logAuditEvent({
        tenantId: req.user.tenantId,
        userId: req.user.id,
        action: 'ROLE_CREATED',
        context: { roleName: name, permissions: validPermissions },
      });
      
      res.status(201).json({ success: true, role });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
);

export default router;
```

---

## 7. Integration with CloudPod Routes

Update `cloudPodRoutes.js` to use RBAC:

```javascript
// In cloudPodRoutes.js - add imports
import { requirePermission } from '../middleware/rbac.js';

// Update routes with permission checks:

// View pods - requires cloudpods.view
router.get('/my-pods', authenticateToken, requirePermission('cloudpods.view'), ...);

// Create pod - requires cloudpods.create
router.post('/order', authenticateToken, requirePermission('cloudpods.create'), ...);

// Destroy pod - requires cloudpods.destroy
router.post('/:vmid/destroy', authenticateToken, requirePermission('cloudpods.destroy'), ...);

// Scale pod - requires cloudpods.scale  
router.post('/:vmid/scale', authenticateToken, requirePermission('cloudpods.scale'), ...);

// Backup pod - requires cloudpods.backup
router.post('/:vmid/backup', authenticateToken, requirePermission('cloudpods.backup'), ...);

// Manage quota - requires cloudpods.quota.manage
router.post('/tenants/:tenantId/quota', authenticateToken, requirePermission('cloudpods.quota.manage'), ...);
```

---

## 8. Prisma Schema Addition

```prisma
// Add to prisma/schema.prisma

model TenantRole {
  id          String   @id @default(uuid())
  tenantId    String   @map("tenant_id")
  name        String
  displayName String?  @map("display_name")
  description String?
  isSystem    Boolean  @default(false) @map("is_system")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  permissions TenantRolePermission[]
  userRoles   TenantUserRole[]
  
  @@unique([tenantId, name])
  @@map("tenant_roles")
}

model TenantUserRole {
  id         String    @id @default(uuid())
  tenantId   String    @map("tenant_id")
  userId     String    @map("user_id")
  roleName   String    @map("role_name")
  assignedBy String?   @map("assigned_by")
  assignedAt DateTime  @default(now()) @map("assigned_at")
  expiresAt  DateTime? @map("expires_at")
  
  tenant     Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  role       TenantRole @relation(fields: [tenantId, roleName], references: [tenantId, name])
  assigner   User?      @relation("RoleAssigner", fields: [assignedBy], references: [id])
  
  @@unique([tenantId, userId, roleName])
  @@map("tenant_user_roles")
}

model TenantRolePermission {
  id         String   @id @default(uuid())
  tenantId   String   @map("tenant_id")
  roleName   String   @map("role_name")
  permission String
  createdAt  DateTime @default(now()) @map("created_at")
  
  tenant     Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  role       TenantRole @relation(fields: [tenantId, roleName], references: [tenantId, name])
  
  @@unique([tenantId, roleName, permission])
  @@map("tenant_role_permissions")
}
```

---

## 9. TypeScript Types

```typescript
// src/types/rbac.d.ts

export type SystemRole = 'owner' | 'admin' | 'devops' | 'developer' | 'viewer';

export type CloudPodsPermission =
  | 'cloudpods.view'
  | 'cloudpods.create'
  | 'cloudpods.destroy'
  | 'cloudpods.scale'
  | 'cloudpods.backup'
  | 'cloudpods.console'
  | 'cloudpods.quota.view'
  | 'cloudpods.quota.manage'
  | 'cloudpods.security.manage';

export type TenantPermission =
  | 'tenant.users.view'
  | 'tenant.users.manage'
  | 'tenant.roles.manage'
  | 'tenant.billing.view'
  | 'tenant.billing.manage'
  | 'tenant.settings.manage';

export type Permission = CloudPodsPermission | TenantPermission;

export interface TenantRole {
  name: string;
  displayName: string;
  description?: string;
  isSystem: boolean;
  permissions: Permission[];
}

export interface UserRoleAssignment {
  userId: string;
  roleName: string;
  assignedAt: string;
  expiresAt?: string | null;
}

export interface UserPermissions {
  roles: string[];
  permissions: Permission[];
}
```

---

## 10. Test Checklist

```bash
#!/bin/bash
# RBAC Test Checklist

BASE="http://100.97.213.11:2271"

# 1. Get my permissions
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/rbac/my-permissions" | jq

# 2. List tenant roles
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/rbac/roles" | jq

# 3. List users with roles
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/rbac/users" | jq

# 4. Assign role to user (as admin)
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"roleName": "developer"}' \
  "$BASE/api/rbac/users/USER_ID/roles" | jq

# 5. Remove role from user
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/rbac/users/USER_ID/roles/developer" | jq

# 6. Test permission denied (as viewer trying to destroy)
curl -s -X POST -H "Authorization: Bearer $VIEWER_TOKEN" \
  "$BASE/api/cloud-pods/123/destroy" | jq
# Expected: 403 FORBIDDEN

# 7. Create custom role (owner only)
curl -s -X POST -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "backup_operator",
    "displayName": "Backup Operator",
    "permissions": ["cloudpods.view", "cloudpods.backup"]
  }' \
  "$BASE/api/rbac/roles" | jq
```

---

## 11. Migration Script

```sql
-- migrations/YYYYMMDD_add_rbac_tables.sql

-- Create tenant_roles table
CREATE TABLE IF NOT EXISTS tenant_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  display_name VARCHAR(100),
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- Create tenant_user_roles table
CREATE TABLE IF NOT EXISTS tenant_user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_name VARCHAR(50) NOT NULL,
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(tenant_id, user_id, role_name)
);

-- Create tenant_role_permissions table
CREATE TABLE IF NOT EXISTS tenant_role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role_name VARCHAR(50) NOT NULL,
  permission VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, role_name, permission)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenant_roles_tenant ON tenant_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_user_roles_user ON tenant_user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_user_roles_tenant ON tenant_user_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_tenant_role ON tenant_role_permissions(tenant_id, role_name);

-- Add foreign keys for role references
ALTER TABLE tenant_user_roles 
  ADD CONSTRAINT fk_user_role_ref 
  FOREIGN KEY (tenant_id, role_name) 
  REFERENCES tenant_roles(tenant_id, name) 
  ON DELETE CASCADE;

ALTER TABLE tenant_role_permissions 
  ADD CONSTRAINT fk_permission_role_ref 
  FOREIGN KEY (tenant_id, role_name) 
  REFERENCES tenant_roles(tenant_id, name) 
  ON DELETE CASCADE;
```
