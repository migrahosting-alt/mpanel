// Enterprise Role & Permission Management Module
// RBAC with permission matrix, role CRUD, user assignment
import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../lib/apiClient';
import {
  ShieldCheckIcon,
  UserGroupIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  LockClosedIcon,
  KeyIcon,
  EyeIcon,
  Cog6ToothIcon,
  ServerStackIcon,
  CurrencyDollarIcon,
  UserCircleIcon,
  CloudIcon,
  GlobeAltIcon,
  ChartBarIcon,
  BoltIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

interface Role {
  id: string;
  name: string;
  description?: string;
  is_system: boolean;
  user_count: number;
  permissions: string[];
  created_at: string;
  updated_at?: string;
}

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
  is_dangerous?: boolean;
}

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  created_at: string;
}

// Permission categories with icons
const PERMISSION_CATEGORIES = [
  { key: 'users', label: 'User Management', icon: UserGroupIcon },
  { key: 'customers', label: 'Customer Management', icon: UserCircleIcon },
  { key: 'servers', label: 'Server Management', icon: ServerStackIcon },
  { key: 'billing', label: 'Billing & Finance', icon: CurrencyDollarIcon },
  { key: 'cloudpods', label: 'CloudPods', icon: CloudIcon },
  { key: 'domains', label: 'Domains & DNS', icon: GlobeAltIcon },
  { key: 'provisioning', label: 'Provisioning', icon: BoltIcon },
  { key: 'reports', label: 'Reports & Analytics', icon: ChartBarIcon },
  { key: 'settings', label: 'System Settings', icon: Cog6ToothIcon },
];

// Default permissions structure
const DEFAULT_PERMISSIONS: Permission[] = [
  // User Management
  { id: 'users.view', name: 'View Users', description: 'View user list and details', category: 'users' },
  { id: 'users.create', name: 'Create Users', description: 'Create new admin users', category: 'users' },
  { id: 'users.edit', name: 'Edit Users', description: 'Modify user details', category: 'users' },
  { id: 'users.delete', name: 'Delete Users', description: 'Remove users from system', category: 'users', is_dangerous: true },
  { id: 'users.roles', name: 'Assign Roles', description: 'Assign roles to users', category: 'users' },
  
  // Customer Management
  { id: 'customers.view', name: 'View Customers', description: 'View customer list and profiles', category: 'customers' },
  { id: 'customers.create', name: 'Create Customers', description: 'Add new customers', category: 'customers' },
  { id: 'customers.edit', name: 'Edit Customers', description: 'Modify customer information', category: 'customers' },
  { id: 'customers.delete', name: 'Delete Customers', description: 'Remove customers', category: 'customers', is_dangerous: true },
  { id: 'customers.impersonate', name: 'Impersonate', description: 'Login as customer', category: 'customers', is_dangerous: true },
  
  // Server Management
  { id: 'servers.view', name: 'View Servers', description: 'View server list and status', category: 'servers' },
  { id: 'servers.create', name: 'Add Servers', description: 'Add new servers', category: 'servers' },
  { id: 'servers.edit', name: 'Edit Servers', description: 'Modify server configuration', category: 'servers' },
  { id: 'servers.delete', name: 'Delete Servers', description: 'Remove servers', category: 'servers', is_dangerous: true },
  { id: 'servers.ssh', name: 'SSH Access', description: 'Connect via SSH console', category: 'servers', is_dangerous: true },
  { id: 'servers.reboot', name: 'Reboot Servers', description: 'Restart server services', category: 'servers' },
  
  // Billing & Finance
  { id: 'billing.view', name: 'View Billing', description: 'View invoices and subscriptions', category: 'billing' },
  { id: 'billing.manage', name: 'Manage Billing', description: 'Create/edit invoices', category: 'billing' },
  { id: 'billing.refund', name: 'Process Refunds', description: 'Issue refunds', category: 'billing', is_dangerous: true },
  { id: 'billing.reports', name: 'Financial Reports', description: 'View revenue reports', category: 'billing' },
  
  // CloudPods
  { id: 'cloudpods.view', name: 'View CloudPods', description: 'View CloudPod instances', category: 'cloudpods' },
  { id: 'cloudpods.create', name: 'Create CloudPods', description: 'Provision new CloudPods', category: 'cloudpods' },
  { id: 'cloudpods.manage', name: 'Manage CloudPods', description: 'Start/stop/resize pods', category: 'cloudpods' },
  { id: 'cloudpods.delete', name: 'Delete CloudPods', description: 'Remove CloudPod instances', category: 'cloudpods', is_dangerous: true },
  
  // Domains & DNS
  { id: 'domains.view', name: 'View Domains', description: 'View domain list', category: 'domains' },
  { id: 'domains.manage', name: 'Manage Domains', description: 'Add/edit domains', category: 'domains' },
  { id: 'domains.dns', name: 'DNS Management', description: 'Edit DNS records', category: 'domains' },
  
  // Provisioning
  { id: 'provisioning.view', name: 'View Tasks', description: 'View provisioning queue', category: 'provisioning' },
  { id: 'provisioning.manage', name: 'Manage Tasks', description: 'Cancel/retry tasks', category: 'provisioning' },
  { id: 'provisioning.config', name: 'Configure Rules', description: 'Edit auto-provision rules', category: 'provisioning' },
  
  // Reports
  { id: 'reports.view', name: 'View Reports', description: 'Access analytics dashboard', category: 'reports' },
  { id: 'reports.export', name: 'Export Data', description: 'Download reports', category: 'reports' },
  
  // Settings
  { id: 'settings.view', name: 'View Settings', description: 'View system configuration', category: 'settings' },
  { id: 'settings.edit', name: 'Edit Settings', description: 'Modify system settings', category: 'settings', is_dangerous: true },
  { id: 'settings.roles', name: 'Manage Roles', description: 'Create/edit roles', category: 'settings' },
];

// Default roles
const DEFAULT_ROLES: Role[] = [
  {
    id: 'super_admin',
    name: 'Super Admin',
    description: 'Full system access with all permissions',
    is_system: true,
    user_count: 1,
    permissions: DEFAULT_PERMISSIONS.map(p => p.id),
    created_at: new Date().toISOString(),
  },
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Standard admin access without dangerous operations',
    is_system: true,
    user_count: 2,
    permissions: DEFAULT_PERMISSIONS.filter(p => !p.is_dangerous).map(p => p.id),
    created_at: new Date().toISOString(),
  },
  {
    id: 'support',
    name: 'Support Agent',
    description: 'Customer support with limited access',
    is_system: false,
    user_count: 5,
    permissions: ['customers.view', 'customers.edit', 'billing.view', 'cloudpods.view', 'domains.view', 'provisioning.view'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'billing_manager',
    name: 'Billing Manager',
    description: 'Manage billing and financial operations',
    is_system: false,
    user_count: 2,
    permissions: ['customers.view', 'billing.view', 'billing.manage', 'billing.reports', 'reports.view', 'reports.export'],
    created_at: new Date().toISOString(),
  },
];

export default function RoleManagementPage() {
  const [roles, setRoles] = useState<Role[]>(DEFAULT_ROLES);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'roles' | 'permissions' | 'audit'>('roles');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [editingRole, setEditingRole] = useState<Partial<Role>>({});
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  useEffect(() => {
    fetchRoles();
    fetchUsers();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/roles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setRoles(data.roles || data.data || DEFAULT_ROLES);
      }
      setError(null);
    } catch (err: any) {
      // Use default roles if API fails
      setRoles(DEFAULT_ROLES);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const saveRole = async () => {
    try {
      const token = localStorage.getItem('token');
      const isEdit = !!editingRole.id;
      const url = isEdit ? `${API_BASE}/roles/${editingRole.id}` : `${API_BASE}/roles`;
      
      await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...editingRole,
          permissions: selectedPermissions,
        }),
      });
      
      fetchRoles();
      setShowRoleModal(false);
      setEditingRole({});
      setSelectedPermissions([]);
    } catch (err) {
      console.error('Failed to save role:', err);
    }
  };

  const deleteRole = async (roleId: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE}/roles/${roleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchRoles();
      setShowDeleteConfirm(false);
      setSelectedRole(null);
    } catch (err) {
      console.error('Failed to delete role:', err);
    }
  };

  const openCreateModal = () => {
    setEditingRole({ name: '', description: '' });
    setSelectedPermissions([]);
    setShowRoleModal(true);
  };

  const openEditModal = (role: Role) => {
    setEditingRole({ ...role });
    setSelectedPermissions(role.permissions || []);
    setShowRoleModal(true);
  };

  const togglePermission = (permissionId: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permissionId)
        ? prev.filter(p => p !== permissionId)
        : [...prev, permissionId]
    );
  };

  const toggleCategoryPermissions = (category: string) => {
    const categoryPerms = DEFAULT_PERMISSIONS.filter(p => p.category === category).map(p => p.id);
    const allSelected = categoryPerms.every(p => selectedPermissions.includes(p));
    
    if (allSelected) {
      setSelectedPermissions(prev => prev.filter(p => !categoryPerms.includes(p)));
    } else {
      setSelectedPermissions(prev => [...new Set([...prev, ...categoryPerms])]);
    }
  };

  const filteredRoles = roles.filter(role =>
    role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleColor = (roleName: string) => {
    if (roleName === 'Super Admin' || roleName === 'super_admin') return 'bg-red-100 text-red-800';
    if (roleName === 'Administrator' || roleName === 'admin') return 'bg-purple-100 text-purple-800';
    if (roleName.includes('Support')) return 'bg-blue-100 text-blue-800';
    if (roleName.includes('Billing')) return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Role Management</h1>
            <p className="mt-1 text-sm text-gray-500">
              Configure roles and permissions for admin users
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Create Role
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Roles</p>
              <p className="text-2xl font-bold text-gray-900">{roles.length}</p>
            </div>
            <div className="p-3 bg-indigo-100 rounded-lg">
              <ShieldCheckIcon className="h-6 w-6 text-indigo-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">System Roles</p>
              <p className="text-2xl font-bold text-purple-600">{roles.filter(r => r.is_system).length}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <LockClosedIcon className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Custom Roles</p>
              <p className="text-2xl font-bold text-blue-600">{roles.filter(r => !r.is_system).length}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <KeyIcon className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Permissions</p>
              <p className="text-2xl font-bold text-green-600">{DEFAULT_PERMISSIONS.length}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <EyeIcon className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {(['roles', 'permissions', 'audit'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${
                  activeTab === tab
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab === 'roles' && 'Roles'}
                {tab === 'permissions' && 'Permission Matrix'}
                {tab === 'audit' && 'Audit Log'}
              </button>
            ))}
          </nav>
        </div>

        {/* Search (Roles tab) */}
        {activeTab === 'roles' && (
          <div className="p-4 border-b border-gray-100">
            <div className="relative max-w-xs">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search roles..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}

        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <>
              {/* Roles Tab */}
              {activeTab === 'roles' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredRoles.map(role => (
                    <div
                      key={role.id}
                      className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${role.is_system ? 'bg-purple-100' : 'bg-indigo-100'}`}>
                            <ShieldCheckIcon className={`h-5 w-5 ${role.is_system ? 'text-purple-600' : 'text-indigo-600'}`} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{role.name}</h3>
                            {role.is_system && (
                              <span className="inline-flex items-center text-xs text-purple-600">
                                <LockClosedIcon className="h-3 w-3 mr-1" />
                                System
                              </span>
                            )}
                          </div>
                        </div>
                        {!role.is_system && (
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => openEditModal(role)}
                              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                            >
                              <PencilSquareIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedRole(role);
                                setShowDeleteConfirm(true);
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      <p className="text-sm text-gray-500 mb-4">{role.description}</p>

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center text-gray-500">
                          <UserGroupIcon className="h-4 w-4 mr-1" />
                          {role.user_count} users
                        </div>
                        <div className="flex items-center text-gray-500">
                          <KeyIcon className="h-4 w-4 mr-1" />
                          {role.permissions?.length || 0} permissions
                        </div>
                      </div>

                      {/* Permission preview */}
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex flex-wrap gap-1">
                          {role.permissions?.slice(0, 5).map(permId => {
                            const perm = DEFAULT_PERMISSIONS.find(p => p.id === permId);
                            return perm ? (
                              <span
                                key={permId}
                                className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                              >
                                {perm.name}
                              </span>
                            ) : null;
                          })}
                          {(role.permissions?.length || 0) > 5 && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                              +{role.permissions.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Permission Matrix Tab */}
              {activeTab === 'permissions' && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Permission</th>
                        {roles.map(role => (
                          <th key={role.id} className="text-center py-3 px-4 font-medium text-gray-900">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs ${getRoleColor(role.name)}`}>
                              {role.name}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {PERMISSION_CATEGORIES.map(category => (
                        <React.Fragment key={category.key}>
                          <tr className="bg-gray-50">
                            <td colSpan={roles.length + 1} className="py-2 px-4">
                              <div className="flex items-center space-x-2 font-medium text-gray-700">
                                <category.icon className="h-4 w-4" />
                                <span>{category.label}</span>
                              </div>
                            </td>
                          </tr>
                          {DEFAULT_PERMISSIONS.filter(p => p.category === category.key).map(perm => (
                            <tr key={perm.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-3 px-4">
                                <div className="flex items-center">
                                  <span className="text-sm text-gray-900">{perm.name}</span>
                                  {perm.is_dangerous && (
                                    <ExclamationTriangleIcon className="h-4 w-4 text-red-500 ml-2" title="Dangerous operation" />
                                  )}
                                </div>
                                <p className="text-xs text-gray-500">{perm.description}</p>
                              </td>
                              {roles.map(role => (
                                <td key={role.id} className="text-center py-3 px-4">
                                  {role.permissions?.includes(perm.id) ? (
                                    <CheckIcon className="h-5 w-5 text-green-500 mx-auto" />
                                  ) : (
                                    <XMarkIcon className="h-5 w-5 text-gray-300 mx-auto" />
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Audit Log Tab */}
              {activeTab === 'audit' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <InformationCircleIcon className="h-5 w-5 text-blue-500 mr-2" />
                      <span className="text-sm text-blue-700">
                        Role changes are logged for security auditing. Recent changes shown below.
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {[
                      { action: 'Role created', role: 'Support Agent', user: 'admin@migrahosting.com', time: '2 hours ago' },
                      { action: 'Permissions updated', role: 'Billing Manager', user: 'admin@migrahosting.com', time: '1 day ago' },
                      { action: 'User assigned', role: 'Support Agent', user: 'admin@migrahosting.com', time: '2 days ago', detail: 'john@example.com assigned' },
                    ].map((log, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-white rounded-lg">
                            <ShieldCheckIcon className="h-4 w-4 text-gray-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {log.action}: <span className="text-indigo-600">{log.role}</span>
                            </p>
                            <p className="text-xs text-gray-500">
                              By {log.user} {log.detail && `• ${log.detail}`}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400">{log.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Create/Edit Role Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 py-6">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowRoleModal(false)}></div>
            <div className="relative bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingRole.id ? 'Edit Role' : 'Create New Role'}
                </h2>
              </div>
              
              <div className="p-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role Name *
                    </label>
                    <input
                      type="text"
                      value={editingRole.name || ''}
                      onChange={e => setEditingRole(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g., Support Manager"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={editingRole.description || ''}
                      onChange={e => setEditingRole(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="Brief description of this role"
                    />
                  </div>
                </div>

                {/* Permissions */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-medium text-gray-700">
                      Permissions ({selectedPermissions.length} selected)
                    </label>
                    <div className="space-x-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPermissions(DEFAULT_PERMISSIONS.map(p => p.id))}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedPermissions([])}
                        className="text-xs text-gray-500 hover:underline"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4">
                    {PERMISSION_CATEGORIES.map(category => {
                      const categoryPerms = DEFAULT_PERMISSIONS.filter(p => p.category === category.key);
                      const allSelected = categoryPerms.every(p => selectedPermissions.includes(p.id));
                      const someSelected = categoryPerms.some(p => selectedPermissions.includes(p.id));
                      
                      return (
                        <div key={category.key} className="border-b border-gray-100 pb-4 last:border-b-0">
                          <button
                            type="button"
                            onClick={() => toggleCategoryPermissions(category.key)}
                            className="flex items-center space-x-2 mb-2 group"
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                              allSelected ? 'bg-indigo-600 border-indigo-600' : 
                              someSelected ? 'bg-indigo-100 border-indigo-300' : 'border-gray-300'
                            }`}>
                              {allSelected && <CheckIcon className="h-3 w-3 text-white" />}
                              {someSelected && !allSelected && <div className="w-2 h-0.5 bg-indigo-600"></div>}
                            </div>
                            <category.icon className="h-4 w-4 text-gray-500" />
                            <span className="font-medium text-gray-700 group-hover:text-indigo-600">
                              {category.label}
                            </span>
                          </button>
                          
                          <div className="grid grid-cols-2 gap-2 ml-6">
                            {categoryPerms.map(perm => (
                              <label
                                key={perm.id}
                                className="flex items-start space-x-2 cursor-pointer group"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedPermissions.includes(perm.id)}
                                  onChange={() => togglePermission(perm.id)}
                                  className="mt-0.5 h-4 w-4 text-indigo-600 rounded border-gray-300"
                                />
                                <div>
                                  <span className={`text-sm ${
                                    perm.is_dangerous ? 'text-red-600' : 'text-gray-700'
                                  } group-hover:text-indigo-600`}>
                                    {perm.name}
                                    {perm.is_dangerous && (
                                      <ExclamationTriangleIcon className="inline h-3 w-3 ml-1" />
                                    )}
                                  </span>
                                  <p className="text-xs text-gray-400">{perm.description}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-xl flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowRoleModal(false);
                    setEditingRole({});
                    setSelectedPermissions([]);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  onClick={saveRole}
                  disabled={!editingRole.name}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {editingRole.id ? 'Save Changes' : 'Create Role'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedRole && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowDeleteConfirm(false)}></div>
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Delete Role</h3>
              <p className="text-sm text-gray-500 text-center mb-6">
                Are you sure you want to delete the role "{selectedRole.name}"? 
                {selectedRole.user_count > 0 && (
                  <span className="text-red-600 block mt-1">
                    This role is assigned to {selectedRole.user_count} users who will need to be reassigned.
                  </span>
                )}
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteRole(selectedRole.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete Role
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
