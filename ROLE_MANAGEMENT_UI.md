# Role Management UI - Documentation

## Overview
The Role Management UI is a comprehensive admin interface for managing the entire RBAC (Role-Based Access Control) system. Super admins can create roles, assign permissions, visualize role hierarchy, and control access across the entire platform.

## Features

### 1. Role Hierarchy Visualization
- **Visual hierarchy display** with level-based indentation
- **Color-coded badges** indicating role authority level:
  - Purple: Super Admin (Level 0)
  - Blue: Admin/Editor (Level 1-2)
  - Green: Contributor/Staff (Level 3-4)
  - Yellow: Support/Service (Level 5-6)
  - Gray: Client (Level 10)
- **Quick actions** for each role (Permissions, Delete)
- **Protected roles**: super_admin, admin, and client cannot be deleted

### 2. Create New Role
- **Role name** (unique identifier)
- **Description** (purpose and responsibilities)
- **Hierarchy level** (0-10, with system validation)
  - Reserved levels: 0 (super_admin), 1 (admin), 10 (client)
  - Custom roles can use levels 2-9
- **Auto-validation** prevents level conflicts

### 3. Permission Matrix
- **Grouped by resource** (12 categories):
  - servers, users, customers, billing
  - deployments, websites, dns, email
  - databases, support, roles, provisioning
- **Expandable/collapsible** sections for better organization
- **Bulk toggle** per resource (Add All / Remove All)
- **Individual permission toggle** with visual feedback
- **Real-time updates** with API synchronization
- **Permission counter** showing assigned vs. total permissions

### 4. Permission Details
Each permission shows:
- **Permission name** (e.g., `servers.create`)
- **Description** (what the permission allows)
- **Visual indicator** (green checkmark for assigned, gray X for unassigned)

## Technical Implementation

### Component: `RoleManagement.jsx`
**Location**: `frontend/src/pages/RoleManagement.jsx`
**Size**: 550+ lines
**Dependencies**: 
- React hooks (useState, useEffect)
- Heroicons for UI icons
- react-hot-toast for notifications

### API Integration
```javascript
// Fetch all roles
GET /api/roles
Response: { roles: [...] }

// Fetch all permissions
GET /api/roles/permissions
Response: { permissions: [...] }

// Fetch role permissions
GET /api/roles/:roleId/permissions
Response: { permissions: [...] }

// Create new role
POST /api/roles
Body: { name, description, level }

// Update role permissions
PUT /api/roles/:roleId/permissions
Body: { permissionIds: [...] }

// Delete role
DELETE /api/roles/:roleId
```

### State Management
```javascript
const [roles, setRoles] = useState([]);                    // All system roles
const [permissions, setPermissions] = useState([]);        // All permissions
const [selectedRole, setSelectedRole] = useState(null);    // Currently editing role
const [showCreateModal, setShowCreateModal] = useState(false);
const [showPermissionMatrix, setShowPermissionMatrix] = useState(false);
const [expandedResources, setExpandedResources] = useState({}); // UI state
```

## User Interface

### Main Screen
```
┌─────────────────────────────────────────────────────┐
│ Role Management              [+ Create Role] Button │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Role Hierarchy                                       │
│                                                      │
│ ┌─[Level 0] super_admin                             │
│ │  Super Administrator - Full system access         │
│ │                      [Permissions] [Protected]    │
│ │                                                    │
│ │  ┌─[Level 1] admin                                │
│ │  │  Administrator - Manage users and system       │
│ │  │                 [Permissions] [Protected]      │
│ │  │                                                 │
│ │  │  ┌─[Level 2] editor                            │
│ │  │  │  Editor - Content management                │
│ │  │  │         [Permissions] [Delete]              │
│ │  │  │                                              │
│ │  │  │  ┌─[Level 3] contributor                    │
│ │  │  │  │  Contributor - Create content            │
│ │  │  │  │             [Permissions] [Delete]       │
└─────────────────────────────────────────────────────┘
```

### Permission Matrix Modal
```
┌────────────────────────────────────────────────┐
│ Permissions for editor                    [X]  │
│ 12 of 54 permissions assigned                  │
├────────────────────────────────────────────────┤
│                                                 │
│ ▼ servers (7)                    [Add All]     │
│   ☑ servers.view                               │
│   ☑ servers.create                             │
│   ☐ servers.edit                               │
│   ☐ servers.delete                             │
│   ☑ servers.metrics                            │
│   ☐ servers.configure                          │
│   ☐ servers.restart                            │
│                                                 │
│ ▶ databases (5)                  [Add All]     │
│                                                 │
│ ▼ deployments (9)                [Remove All]  │
│   ☑ deployments.view                           │
│   ☑ deployments.create                         │
│   ☑ deployments.deploy_database                │
│   ...                                           │
│                                                 │
├────────────────────────────────────────────────┤
│                    [Done]                       │
└────────────────────────────────────────────────┘
```

## Use Cases

### 1. Create Custom Role
**Scenario**: Company needs a "DevOps Engineer" role with specific permissions

**Steps**:
1. Click **Create Role**
2. Enter name: `devops_engineer`
3. Enter description: `DevOps Engineer - Deploy and monitor infrastructure`
4. Set level: `3` (between editor and contributor)
5. Click **Create Role**
6. Click **Permissions** on the new role
7. Toggle on: servers.*, deployments.*, databases.*, dns.*
8. Click **Done**

### 2. Modify Existing Role Permissions
**Scenario**: Grant sales team access to customer billing data

**Steps**:
1. Find **sales** role in hierarchy
2. Click **Permissions**
3. Expand **billing** section
4. Click **Add All** for billing permissions
5. Expand **customers** section
6. Toggle on: customers.view, customers.invoices
7. Click **Done**

### 3. Bulk Permission Management
**Scenario**: Remove all DNS permissions from contributor role

**Steps**:
1. Click **Permissions** on contributor role
2. Scroll to **dns** section
3. Click **Remove All**
4. Confirm changes are saved automatically

### 4. Delete Obsolete Role
**Scenario**: Remove old "tester" role

**Steps**:
1. Locate **tester** role in hierarchy
2. Click **Delete** (trash icon)
3. Confirm deletion in modal
4. Role removed (users reassigned to default)

## Security Features

### Access Control
- **Super admin only**: Only users with `roles.read` permission can access
- **Protected roles**: System roles cannot be deleted
- **Level validation**: Prevents creating roles with reserved levels
- **JWT authentication**: All API calls require valid token

### Permission Validation
- **Server-side checks**: All permission changes validated by backend
- **Atomic updates**: Permission changes applied transactionally
- **Audit logging**: All role/permission changes logged (backend)
- **Real-time sync**: UI reflects server state immediately

## Best Practices

### Role Design
1. **Principle of least privilege**: Grant minimum necessary permissions
2. **Role hierarchy**: Use levels to establish clear authority chains
3. **Descriptive names**: Use clear, consistent naming (e.g., `support_team`, not `team1`)
4. **Document purpose**: Write detailed descriptions for each role

### Permission Assignment
1. **Group by function**: Assign related permissions together
2. **Use bulk toggles**: For resource-based permissions (all servers.*)
3. **Test thoroughly**: Verify role permissions in staging first
4. **Regular audits**: Review permissions quarterly

### Hierarchy Levels
```
Level 0: super_admin         (Reserved - God mode)
Level 1: admin               (Reserved - Full admin)
Level 2: editor              (Content management)
Level 3: contributor         (Content creation)
Level 4: sales               (Sales operations)
Level 5: support             (Support tickets)
Level 6: customer_service    (Customer interaction)
Level 7-9: Custom roles      (Available for expansion)
Level 10: client             (Reserved - End users)
```

## UI Components

### Modals
1. **Create Role Modal**
   - Form with name, description, level
   - Validation for required fields
   - Level guidance text

2. **Permission Matrix Modal**
   - Scrollable resource groups
   - Expand/collapse sections
   - Bulk and individual toggles
   - Real-time permission counter

3. **Delete Confirmation Modal**
   - Warning message
   - Cannot be undone notice
   - Affected users warning

### Visual Indicators
- **Level badges**: Color-coded hierarchy visualization
- **Permission checkmarks**: Green ✓ for assigned, gray ✗ for unassigned
- **Indentation**: Visual hierarchy depth
- **Badges**: "Deploy", "Auto", "RBAC" for special features

## Integration

### Routes
```javascript
// Route definition (App.jsx)
<Route 
  path="/admin/roles" 
  element={<ProtectedRoute><RoleManagement /></ProtectedRoute>} 
/>
```

### Navigation (Layout.jsx)
```javascript
{ 
  name: 'Role Management', 
  href: '/admin/roles', 
  icon: UserGroupIcon, 
  section: 'admin', 
  badge: 'RBAC' 
}
```

### Backend RBAC Service
All operations call `src/services/rbacService.js`:
- `getAllRoles()`
- `getAllPermissions()`
- `getRolePermissions(roleId)`
- `createRole(name, description, level)`
- `assignPermissions(roleId, permissionIds)`
- `deleteRole(roleId)`

## Testing Checklist

- [ ] Create new role with valid data
- [ ] Create role with duplicate name (should fail)
- [ ] Create role with reserved level (should fail)
- [ ] Assign permissions individually
- [ ] Bulk add all permissions for a resource
- [ ] Bulk remove all permissions for a resource
- [ ] Toggle permissions on/off repeatedly
- [ ] Delete custom role
- [ ] Try to delete protected role (should fail)
- [ ] View role hierarchy sorted by level
- [ ] Verify permission counter updates correctly
- [ ] Test with non-super-admin user (should 403)

## Future Enhancements

### Planned Features
1. **User assignment UI**: Assign roles directly from this page
2. **Permission search**: Filter permissions by keyword
3. **Role templates**: Pre-configured role sets for common use cases
4. **Permission history**: View changelog for each role
5. **Role cloning**: Duplicate existing role as template
6. **Batch operations**: Create multiple roles from CSV
7. **Visual permissions**: Graphical representation of permission scope
8. **Role comparison**: Side-by-side permission comparison

### Performance Optimizations
1. **Lazy loading**: Load permissions on-demand
2. **Caching**: Client-side cache for role/permission data
3. **Pagination**: For large permission sets
4. **Debouncing**: Batch permission updates

## Troubleshooting

### Common Issues

**Issue**: Cannot access Role Management page
- **Solution**: Verify user has `roles.read` permission (super_admin only by default)

**Issue**: Permission changes don't persist
- **Solution**: Check network tab for API errors, verify token validity

**Issue**: Cannot delete role
- **Solution**: Check if role is protected (super_admin, admin, client) or has assigned users

**Issue**: Level validation error
- **Solution**: Avoid levels 0, 1, 10 (reserved for system roles)

### Debug Mode
Enable detailed logging:
```javascript
// In RoleManagement.jsx
useEffect(() => {
  console.log('Roles:', roles);
  console.log('Permissions:', permissions);
  console.log('Selected Role:', selectedRole);
}, [roles, permissions, selectedRole]);
```

## Support

For issues or questions:
1. Check backend logs: `mpanel-main/logs/`
2. Review RBAC service: `src/services/rbacService.js`
3. Verify database state: `SELECT * FROM roles; SELECT * FROM role_permissions;`
4. Test API directly: Use Postman/curl with JWT token

---

**Built with**: React 18, Tailwind CSS, Heroicons, react-hot-toast  
**Backend**: Express.js, PostgreSQL, JWT  
**Version**: 1.0.0  
**Last Updated**: November 12, 2025
