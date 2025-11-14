# Permission-Based UI Rendering - Documentation

## Overview
The permission-based UI rendering system dynamically shows/hides navigation items, buttons, and entire features based on the authenticated user's role and specific permissions. This ensures users only see functionality they're authorized to access.

## Architecture

### Data Flow
```
1. User logs in
2. Backend returns JWT token + user data
3. Frontend fetches permissions via /api/auth/permissions
4. AuthContext stores: user, role, permissions
5. Components check permissions before rendering
6. Navigation automatically filtered
7. Features conditionally displayed
```

## Core Components

### 1. Enhanced AuthContext
**File**: `frontend/src/context/AuthContext.tsx`

#### New State
```typescript
interface Permission {
  id: number;
  name: string;        // e.g., "servers.create"
  resource: string;    // e.g., "servers"
  description: string;
}

interface Role {
  id: number;
  name: string;        // e.g., "admin"
  level: number;       // 0-10 hierarchy
  description: string;
}
```

#### New Context Values
```typescript
{
  // Existing
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // New
  userRole: Role | null;
  permissions: Permission[];
  
  // Permission checkers
  hasPermission: (name: string) => boolean;
  hasAnyPermission: (names: string[]) => boolean;
  hasAllPermissions: (names: string[]) => boolean;
  
  // Role helpers
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isClient: boolean;
}
```

#### Permission Checking Functions

**hasPermission(name)**
```typescript
// Check if user has a specific permission
const canCreateServers = hasPermission('servers.create');
```

**hasAnyPermission(names)**
```typescript
// Check if user has ANY of the permissions
const canAccessBilling = hasAnyPermission([
  'billing.read',
  'billing.manage',
  'billing.admin'
]);
```

**hasAllPermissions(names)**
```typescript
// Check if user has ALL of the permissions
const canManageDeployments = hasAllPermissions([
  'deployments.create',
  'servers.configure'
]);
```

### 2. PermissionGuard Component
**File**: `frontend/src/components/PermissionGuard.jsx`

#### Single Permission
```jsx
import { PermissionGuard } from '../components/PermissionGuard';

<PermissionGuard permission="users.create">
  <button>Add User</button>
</PermissionGuard>
```

#### Any Of Multiple Permissions
```jsx
<PermissionGuard anyOf={['servers.edit', 'servers.admin']}>
  <button>Edit Server</button>
</PermissionGuard>
```

#### All Of Multiple Permissions
```jsx
<PermissionGuard allOf={['deployments.create', 'servers.configure']}>
  <button>Deploy Now</button>
</PermissionGuard>
```

#### With Fallback
```jsx
<PermissionGuard 
  permission="billing.read"
  fallback={<div>Contact admin for billing access</div>}
>
  <BillingDashboard />
</PermissionGuard>
```

### 3. RoleGuard Component
**File**: `frontend/src/components/PermissionGuard.jsx`

#### Specific Role
```jsx
import { RoleGuard } from '../components/PermissionGuard';

<RoleGuard role="admin">
  <AdminPanel />
</RoleGuard>
```

#### Admin or Super Admin
```jsx
<RoleGuard requireAdmin>
  <UserManagement />
</RoleGuard>
```

#### Super Admin Only
```jsx
<RoleGuard requireSuperAdmin>
  <RoleManagement />
</RoleGuard>
```

#### Any of Multiple Roles
```jsx
<RoleGuard anyOf={['admin', 'editor', 'contributor']}>
  <ContentEditor />
</RoleGuard>
```

### 4. Permission Hooks

#### usePermission Hook
```jsx
import { usePermission } from '../components/PermissionGuard';

function MyComponent() {
  const { hasPermission, hasAnyPermission } = usePermission();
  
  const handleClick = () => {
    if (hasPermission('servers.delete')) {
      deleteServer();
    }
  };
  
  return (
    <button 
      onClick={handleClick}
      disabled={!hasPermission('servers.delete')}
    >
      Delete
    </button>
  );
}
```

#### useRole Hook
```jsx
import { useRole } from '../components/PermissionGuard';

function Dashboard() {
  const { isAdmin, isSuperAdmin, hasRole } = useRole();
  
  return (
    <div>
      {isAdmin && <AdminStats />}
      {isSuperAdmin && <SystemSettings />}
      {hasRole('sales') && <SalesMetrics />}
    </div>
  );
}
```

## Backend API

### GET /api/auth/permissions
**File**: `src/routes/authRoutes.js`

#### Request
```javascript
GET /api/auth/permissions
Headers: {
  Authorization: Bearer <JWT_TOKEN>
}
```

#### Response
```json
{
  "role": {
    "id": 2,
    "name": "admin",
    "level": 1,
    "description": "Administrator - Manage users and system"
  },
  "permissions": [
    {
      "id": 1,
      "name": "servers.view",
      "resource": "servers",
      "description": "View servers"
    },
    {
      "id": 2,
      "name": "servers.create",
      "resource": "servers",
      "description": "Create new servers"
    }
    // ... more permissions
  ]
}
```

#### Implementation
```javascript
router.get('/permissions', async (req, res) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  
  // Get user's role_id
  const userResult = await pool.query(
    'SELECT role_id FROM users WHERE id = $1',
    [decoded.userId]
  );
  
  // Get role details
  const roleResult = await pool.query(
    'SELECT id, name, level, description FROM roles WHERE id = $1',
    [roleId]
  );
  
  // Get role permissions
  const permissionsResult = await pool.query(
    `SELECT p.id, p.name, p.resource, p.description
     FROM permissions p
     INNER JOIN role_permissions rp ON p.id = rp.permission_id
     WHERE rp.role_id = $1`,
    [roleId]
  );
  
  res.json({
    role: roleResult.rows[0],
    permissions: permissionsResult.rows
  });
});
```

## Navigation Filtering

### Layout Component
**File**: `frontend/src/components/Layout.jsx`

#### Permission-Based Navigation
```javascript
const getNavigation = (isAdmin, hasPermission) => {
  const adminNav = [
    { 
      name: 'Users', 
      href: '/admin/users', 
      icon: UsersIcon, 
      permission: 'users.read'  // Required permission
    },
    { 
      name: 'Role Management', 
      href: '/admin/roles', 
      icon: UserGroupIcon, 
      permission: 'roles.read' 
    },
  ];
  
  // Filter items by permission
  const filterByPermission = (items) => {
    return items.filter(item => {
      if (!item.permission) return true;
      return hasPermission(item.permission);
    });
  };
  
  return filterByPermission(adminNav);
};
```

#### Usage in Layout
```javascript
export default function Layout({ children }) {
  const { hasPermission, isAdmin } = useAuth();
  
  const navigation = getNavigation(isAdmin, hasPermission);
  // Navigation is now automatically filtered!
}
```

### Navigation Item Permissions Map
```javascript
const navigationPermissions = {
  // Admin section
  'Users': 'users.read',
  'Customers': 'customers.read',
  'Server Management': 'deployments.read',
  'Provisioning': 'provisioning.read',
  'Role Management': 'roles.read',
  
  // Hosting section
  'Servers': 'servers.read',
  'Server Metrics': 'servers.metrics',
  'Websites': 'websites.read',
  'Domains': 'dns.read',
  'DNS': 'dns.read',
  'Email': 'email.read',
  'Databases': 'databases.read',
  
  // Billing section
  'Products': 'billing.read',
  'Invoices': 'billing.read',
  'Subscriptions': 'billing.read',
};
```

## Usage Examples

### Example 1: Conditional Button Rendering
```jsx
function ServerCard({ server }) {
  const { hasPermission } = useAuth();
  
  return (
    <div className="server-card">
      <h3>{server.name}</h3>
      
      {/* Only show edit button if user can edit */}
      {hasPermission('servers.edit') && (
        <button onClick={() => editServer(server.id)}>
          Edit
        </button>
      )}
      
      {/* Only show delete button if user can delete */}
      <PermissionGuard permission="servers.delete">
        <button onClick={() => deleteServer(server.id)}>
          Delete
        </button>
      </PermissionGuard>
    </div>
  );
}
```

### Example 2: Feature Sections
```jsx
function Dashboard() {
  return (
    <div>
      {/* Everyone sees overview */}
      <OverviewSection />
      
      {/* Only admins see user management */}
      <RoleGuard requireAdmin>
        <UserManagementSection />
      </RoleGuard>
      
      {/* Only users with billing permissions */}
      <PermissionGuard permission="billing.read">
        <BillingSection />
      </PermissionGuard>
      
      {/* Only super admin sees system settings */}
      <RoleGuard requireSuperAdmin>
        <SystemSettingsSection />
      </RoleGuard>
    </div>
  );
}
```

### Example 3: Disabled States
```jsx
function ActionButton() {
  const { hasPermission } = useAuth();
  
  const canDelete = hasPermission('servers.delete');
  
  return (
    <button
      onClick={() => canDelete && handleDelete()}
      disabled={!canDelete}
      className={!canDelete ? 'opacity-50 cursor-not-allowed' : ''}
      title={!canDelete ? 'You do not have permission to delete' : ''}
    >
      Delete Server
    </button>
  );
}
```

### Example 4: Conditional Menu Items
```jsx
function ContextMenu() {
  const { hasPermission } = useAuth();
  
  const menuItems = [
    { label: 'View', action: view, show: true },
    { label: 'Edit', action: edit, show: hasPermission('servers.edit') },
    { label: 'Delete', action: deleteItem, show: hasPermission('servers.delete') },
    { label: 'Configure', action: configure, show: hasPermission('servers.configure') },
  ];
  
  return (
    <Menu>
      {menuItems.filter(item => item.show).map(item => (
        <MenuItem key={item.label} onClick={item.action}>
          {item.label}
        </MenuItem>
      ))}
    </Menu>
  );
}
```

### Example 5: Route Protection
```jsx
function App() {
  const { hasPermission } = useAuth();
  
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      
      {/* Admin routes - only if user has permission */}
      {hasPermission('users.read') && (
        <Route path="/admin/users" element={<Users />} />
      )}
      
      {hasPermission('roles.read') && (
        <Route path="/admin/roles" element={<RoleManagement />} />
      )}
      
      {/* Fallback for unauthorized access */}
      <Route path="*" element={<NotAuthorized />} />
    </Routes>
  );
}
```

## Permission Naming Convention

### Resource.Action Pattern
```
resource.action
```

Examples:
- `servers.read` - View servers
- `servers.create` - Create new servers
- `servers.edit` - Modify existing servers
- `servers.delete` - Delete servers
- `servers.configure` - Configure server settings
- `servers.metrics` - View server metrics
- `servers.restart` - Restart servers

### Common Actions
- `read` / `view` - View/list resources
- `create` / `add` - Create new resources
- `edit` / `update` - Modify existing resources
- `delete` / `remove` - Delete resources
- `manage` - Full CRUD access
- `admin` - Administrative access

### Resource Types
```
servers, users, customers, billing,
deployments, websites, dns, email,
databases, support, roles, provisioning
```

## Super Admin Bypass

Super admins bypass ALL permission checks:

```javascript
// In PermissionGuard.jsx
if (isSuperAdmin) {
  return <>{children}</>;  // Always render
}

// In usePermission hook
hasPermission: (permission) => 
  isSuperAdmin || hasPermission(permission)
```

This ensures super admins have unrestricted access to all features.

## Performance Considerations

### Permission Caching
Permissions are fetched once on login and stored in AuthContext. No repeated API calls:

```javascript
// Fetched once on login
await fetchUserPermissions(userId);

// Stored in context
setPermissions(data.permissions);

// Checked locally (fast)
hasPermission('servers.create');
```

### Navigation Filtering
Navigation filtering happens once when Layout mounts, not on every render:

```javascript
const navigation = useMemo(
  () => getNavigation(isAdmin, hasPermission),
  [isAdmin, permissions]  // Only recalculate if permissions change
);
```

## Security Notes

### Client-Side Only for UX
Permission-based UI rendering is for **user experience only**, not security:
- Hides irrelevant features from users
- Prevents confusion and accidental access attempts
- Improves UI cleanliness

### Backend Enforcement Required
**ALWAYS validate permissions on the backend:**

```javascript
// Frontend (UX)
<PermissionGuard permission="users.delete">
  <button onClick={deleteUser}>Delete</button>
</PermissionGuard>

// Backend (SECURITY)
router.delete('/users/:id', requirePermission('users.delete'), (req, res) => {
  // Permission validated by middleware before execution
});
```

### Double Protection
```
Frontend: Prevents UI from showing unauthorized actions
Backend: Prevents API from executing unauthorized actions
```

Both layers are necessary for complete security.

## Testing

### Test Permission Checks
```javascript
describe('PermissionGuard', () => {
  it('renders children when permission granted', () => {
    const { hasPermission } = useAuth();
    hasPermission.mockReturnValue(true);
    
    render(
      <PermissionGuard permission="servers.create">
        <button>Create</button>
      </PermissionGuard>
    );
    
    expect(screen.getByText('Create')).toBeInTheDocument();
  });
  
  it('hides children when permission denied', () => {
    const { hasPermission } = useAuth();
    hasPermission.mockReturnValue(false);
    
    render(
      <PermissionGuard permission="servers.create">
        <button>Create</button>
      </PermissionGuard>
    );
    
    expect(screen.queryByText('Create')).not.toBeInTheDocument();
  });
});
```

### Test Navigation Filtering
```javascript
describe('Layout Navigation', () => {
  it('shows admin menu items for admin users', () => {
    const { isAdmin, hasPermission } = useAuth();
    isAdmin.mockReturnValue(true);
    hasPermission.mockReturnValue(true);
    
    render(<Layout />);
    
    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.getByText('Role Management')).toBeInTheDocument();
  });
  
  it('hides admin menu items for regular users', () => {
    const { isAdmin, hasPermission } = useAuth();
    isAdmin.mockReturnValue(false);
    hasPermission.mockReturnValue(false);
    
    render(<Layout />);
    
    expect(screen.queryByText('User Management')).not.toBeInTheDocument();
  });
});
```

## Troubleshooting

### Issue: Permissions not loading
**Solution**: Check AuthContext is fetching permissions on login:
```javascript
// Verify in browser console
console.log(permissions);  // Should show array of permissions
```

### Issue: Navigation not filtering
**Solution**: Ensure Layout receives `hasPermission` from context:
```javascript
const { hasPermission, isAdmin } = useAuth();
const navigation = getNavigation(isAdmin, hasPermission);
```

### Issue: Permission always denied
**Solution**: Verify permission name matches exactly (case-sensitive):
```javascript
// Database
name: 'servers.create'

// Frontend (MUST MATCH)
hasPermission('servers.create')  ✓
hasPermission('servers.Create')  ✗
hasPermission('server.create')   ✗
```

### Issue: Super admin can't access features
**Solution**: Check `isSuperAdmin` flag:
```javascript
const isSuperAdmin = userRole?.name === 'super_admin';
```

## Best Practices

### 1. Use Permission Guards for Features
```jsx
// ✓ Good
<PermissionGuard permission="servers.delete">
  <DeleteButton />
</PermissionGuard>

// ✗ Avoid
{user?.role === 'admin' && <DeleteButton />}
```

### 2. Use Role Guards for Sections
```jsx
// ✓ Good
<RoleGuard requireAdmin>
  <AdminDashboard />
</RoleGuard>

// ✗ Avoid
{hasPermission('users.read') && hasPermission('customers.read') && ...}
```

### 3. Provide Fallbacks for UX
```jsx
<PermissionGuard 
  permission="billing.admin"
  fallback={<ContactAdminMessage />}
>
  <BillingSettings />
</PermissionGuard>
```

### 4. Use Hooks for Complex Logic
```jsx
const { hasPermission } = usePermission();

const canModify = hasPermission('servers.edit') && server.status === 'active';
```

### 5. Keep Permission Names Consistent
```javascript
// ✓ Good - resource.action pattern
servers.read
servers.create
servers.edit

// ✗ Avoid - inconsistent naming
readServers
create_server
editServer
```

---

**Built with**: React 18, TypeScript, JWT  
**Backend**: Express.js, PostgreSQL, RBAC  
**Version**: 1.0.0  
**Last Updated**: November 12, 2025
