import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/apiClient';

interface Permission {
  id: number;
  name: string;
  resource: string;
  description: string;
}

interface Role {
  id: number;
  name: string;
  level: number;
  description: string;
}

interface User {
  id: number;
  email: string;
  name?: string;
  role?: string;
  customer_id?: number;
}

interface AuthContextType {
  user: User | null;
  userRole: Role | null;
  permissions: Permission[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  hasPermission: (permissionName: string) => boolean;
  hasAnyPermission: (permissionNames: string[]) => boolean;
  hasAllPermissions: (permissionNames: string[]) => boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isClient: boolean;
}

const AuthContext = createContext(undefined as AuthContextType | undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: any }) => {
  const [user, setUser] = useState(null as User | null);
  const [userRole, setUserRole] = useState(null as Role | null);
  const [permissions, setPermissions] = useState([] as Permission[]);
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/auth/me') as any;
      setUser(response.user);
      
      // Fetch user's role and permissions
      if (response.user) {
        await fetchUserPermissions(response.user.id);
      }
    } catch (error) {
      // Not authenticated or session expired
      setUser(null);
      setUserRole(null);
      setPermissions([]);
      // Clear any stale localStorage tokens
      localStorage.removeItem('token');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserPermissions = async (userId: number) => {
    try {
      // Fetch user's role and permissions from backend
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/auth/permissions', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUserRole(data.role || null);
        setPermissions(data.permissions || []);
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
      setUserRole(null);
      setPermissions([]);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', {
        email,
        password,
      }) as any;
      
      setUser(response.user);
      
      // Store token if provided (for backward compatibility)
      if (response.token) {
        localStorage.setItem('token', response.token);
      }

      // Fetch permissions after successful login
      if (response.user) {
        await fetchUserPermissions(response.user.id);
      }
    } catch (error: any) {
      // Re-throw with user-friendly message
      throw new Error(error.message || 'Login failed. Please check your credentials.');
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout', {});
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear state regardless of API response
      setUser(null);
      setUserRole(null);
      setPermissions([]);
      localStorage.removeItem('token');
      
      // Redirect to login page
      window.location.href = '/login';
    }
  };

  // Permission checking helpers
  const hasPermission = (permissionName: string): boolean => {
    if (!permissions.length) return false;
    return permissions.some(p => p.name === permissionName);
  };

  const hasAnyPermission = (permissionNames: string[]): boolean => {
    if (!permissions.length) return false;
    return permissionNames.some(name => hasPermission(name));
  };

  const hasAllPermissions = (permissionNames: string[]): boolean => {
    if (!permissions.length) return false;
    return permissionNames.every(name => hasPermission(name));
  };

  // Role helpers
  const isAdmin = userRole?.name === 'admin' || userRole?.name === 'super_admin';
  const isSuperAdmin = userRole?.name === 'super_admin';
  const isClient = userRole?.name === 'client';

  const value = {
    user,
    userRole,
    permissions,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    checkAuth,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isAdmin,
    isSuperAdmin,
    isClient,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
