import { useAuth } from '../context/AuthContext';

/**
 * PermissionGuard - Component to conditionally render children based on permissions
 * 
 * @param {string} permission - Single permission name (e.g., 'users.create')
 * @param {string[]} anyOf - Array of permissions, renders if user has ANY
 * @param {string[]} allOf - Array of permissions, renders if user has ALL
 * @param {ReactNode} fallback - Component to render if permission check fails
 * @param {ReactNode} children - Content to render if permission check passes
 */
export const PermissionGuard = ({ 
  permission, 
  anyOf, 
  allOf, 
  fallback = null, 
  children 
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isSuperAdmin } = useAuth();

  // Super admin bypasses all permission checks
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  // Check single permission
  if (permission) {
    return hasPermission(permission) ? <>{children}</> : <>{fallback}</>;
  }

  // Check if user has ANY of the permissions
  if (anyOf && anyOf.length > 0) {
    return hasAnyPermission(anyOf) ? <>{children}</> : <>{fallback}</>;
  }

  // Check if user has ALL of the permissions
  if (allOf && allOf.length > 0) {
    return hasAllPermissions(allOf) ? <>{children}</> : <>{fallback}</>;
  }

  // No permission specified, render children by default
  return <>{children}</>;
};

/**
 * RoleGuard - Component to conditionally render children based on role
 * 
 * @param {string} role - Single role name (e.g., 'admin')
 * @param {string[]} anyOf - Array of roles, renders if user has ANY
 * @param {boolean} requireAdmin - Shortcut for admin or super_admin
 * @param {boolean} requireSuperAdmin - Only super_admin can see
 * @param {ReactNode} fallback - Component to render if role check fails
 * @param {ReactNode} children - Content to render if role check passes
 */
export const RoleGuard = ({ 
  role, 
  anyOf, 
  requireAdmin = false,
  requireSuperAdmin = false,
  fallback = null, 
  children 
}) => {
  const { userRole, isAdmin, isSuperAdmin } = useAuth();

  // Check super admin requirement
  if (requireSuperAdmin) {
    return isSuperAdmin ? <>{children}</> : <>{fallback}</>;
  }

  // Check admin requirement (admin or super_admin)
  if (requireAdmin) {
    return isAdmin ? <>{children}</> : <>{fallback}</>;
  }

  // Check specific role
  if (role) {
    return userRole?.name === role ? <>{children}</> : <>{fallback}</>;
  }

  // Check if user has ANY of the roles
  if (anyOf && anyOf.length > 0) {
    const hasRole = anyOf.includes(userRole?.name);
    return hasRole ? <>{children}</> : <>{fallback}</>;
  }

  // No role specified, render children by default
  return <>{children}</>;
};

/**
 * usePermission - Hook to check permissions programmatically
 * 
 * @returns {object} Permission checking functions
 */
export const usePermission = () => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isSuperAdmin } = useAuth();

  return {
    hasPermission: (permission) => isSuperAdmin || hasPermission(permission),
    hasAnyPermission: (permissions) => isSuperAdmin || hasAnyPermission(permissions),
    hasAllPermissions: (permissions) => isSuperAdmin || hasAllPermissions(permissions),
  };
};

/**
 * useRole - Hook to check roles programmatically
 * 
 * @returns {object} Role checking functions
 */
export const useRole = () => {
  const { userRole, isAdmin, isSuperAdmin, isClient } = useAuth();

  return {
    userRole,
    isAdmin,
    isSuperAdmin,
    isClient,
    hasRole: (roleName) => userRole?.name === roleName,
    hasAnyRole: (roleNames) => roleNames.includes(userRole?.name),
  };
};

export default PermissionGuard;
