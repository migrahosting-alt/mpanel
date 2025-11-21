import { useState, useEffect } from 'react';
import {
  ShieldCheckIcon,
  UserGroupIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { api } from '../lib/apiClient';

const RoleManagement = () => {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPermissionMatrix, setShowPermissionMatrix] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [expandedResources, setExpandedResources] = useState({});

  // New role form state
  const [newRole, setNewRole] = useState({
    name: '',
    display_name: '',
    description: '',
    level: 5,
    is_admin: false,
    is_client: false,
  });

  // Predefined role templates
  const roleTemplates = [
    { name: 'super_admin', display_name: 'Super Admin', level: 0, description: 'Full system access - can do everything', is_admin: true },
    { name: 'admin', display_name: 'Admin', level: 1, description: 'Full administrative access - manage all resources', is_admin: true },
    { name: 'manager', display_name: 'Manager', level: 2, description: 'Can manage team and resources but not users', is_admin: false },
    { name: 'sales', display_name: 'Sales', level: 4, description: 'Can manage customers, products, and invoices', is_admin: false },
    { name: 'support', display_name: 'Support', level: 5, description: 'Can view and respond to tickets, manage customer services', is_admin: false },
    { name: 'customer_service', display_name: 'Customer Service', level: 6, description: 'Can view customer data and assist with basic tasks', is_admin: false },
    { name: 'billing', display_name: 'Billing', level: 7, description: 'Can manage invoices, payments, and billing', is_admin: false },
    { name: 'client', display_name: 'Client', level: 10, description: 'Standard customer account', is_admin: false, is_client: true },
  ];

  const handleSelectTemplate = (template) => {
    setNewRole({
      name: template.name,
      display_name: template.display_name,
      description: template.description,
      level: template.level,
      is_admin: template.is_admin || false,
      is_client: template.is_client || false,
    });
  };

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  const fetchRoles = async () => {
    try {
      const data = await api.get('/roles');
      setRoles(Array.isArray(data) ? data : data?.roles || []);
    } catch (error) {
      console.error('Error fetching roles:', error);
      toast.error('Failed to load roles');
    }
  };

  const fetchPermissions = async () => {
    try {
      const data = await api.get('/roles/permissions/all');
      setPermissions(data.permissions || data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      toast.error('Failed to load permissions');
      setLoading(false);
    }
  };

  const fetchRolePermissions = async (roleId) => {
    try {
      const role = await api.get(`/roles/${roleId}`);
      setSelectedRole({
        ...role,
        permissions: role.permissions || [],
      });
      setShowPermissionMatrix(true);
    } catch (error) {
      console.error('Error fetching role permissions:', error);
      toast.error('Failed to load role permissions');
    }
  };

  const reservedNames = ['super_admin', 'admin', 'client'];
  const reservedLevels = [0, 1, 10];
  const isDuplicateName = roles.some(r => r.name === newRole.name);
  const isReserved = reservedNames.includes(newRole.name) || reservedLevels.includes(newRole.level);
  const canCreate = newRole.name && newRole.display_name && newRole.level !== undefined && !isDuplicateName && !isReserved;

  const handleCreateRole = async (e) => {
    e.preventDefault();

    if (isDuplicateName) {
      toast.error('Role name already exists. Choose a unique name.');
      return;
    }
    if (isReserved) {
      toast.error('Cannot create reserved system roles or use reserved levels.');
      return;
    }

    try {
      await api.post('/roles', newRole);

      toast.success('Role created successfully');
      setShowCreateModal(false);
      setNewRole({ 
        name: '', 
        display_name: '', 
        description: '', 
        level: 5,
        is_admin: false,
        is_client: false,
      });
      fetchRoles();
    } catch (error) {
      console.error('Error creating role:', error);
      toast.error(error.message || 'Failed to create role');
    }
  };

  const handleDeleteRole = async (roleId) => {
    try {
      await api.delete(`/roles/${roleId}`);

      toast.success('Role deleted successfully');
      setShowDeleteConfirm(null);
      fetchRoles();
    } catch (error) {
      console.error('Error deleting role:', error);
      toast.error('Failed to delete role');
    }
  };

  const handleTogglePermission = async (permissionId) => {
    if (!selectedRole) return;

    const hasPermission = selectedRole.permissions.some(p => p.id === permissionId);
    const permissionIds = hasPermission
      ? selectedRole.permissions.filter(p => p.id !== permissionId).map(p => p.id)
      : [...selectedRole.permissions.map(p => p.id), permissionId];

    try {
      await api.put(`/roles/${selectedRole.id}/permissions`, { permission_ids: permissionIds });
      setSelectedRole({
        ...selectedRole,
        permissions: hasPermission
          ? selectedRole.permissions.filter(p => p.id !== permissionId)
          : [...selectedRole.permissions, permissions.find(p => p.id === permissionId)],
      });

      toast.success('Permission updated');
    } catch (error) {
      console.error('Error updating permission:', error);
      toast.error('Failed to update permission');
    }
  };

  const handleBulkToggleResource = async (resource) => {
    if (!selectedRole) return;

    const resourcePermissions = permissions.filter(p => p.resource === resource);
    const hasAllPermissions = resourcePermissions.every(rp =>
      selectedRole.permissions.some(sp => sp.id === rp.id)
    );

    const newPermissions = hasAllPermissions
      ? selectedRole.permissions.filter(sp => !resourcePermissions.some(rp => rp.id === sp.id))
      : [
          ...selectedRole.permissions.filter(sp => !resourcePermissions.some(rp => rp.id === sp.id)),
          ...resourcePermissions,
        ];

    try {
      await api.put(`/roles/${selectedRole.id}/permissions`, {
        permission_ids: newPermissions.map(p => p.id),
      });

      setSelectedRole({ ...selectedRole, permissions: newPermissions });
      toast.success(`${resource} permissions ${hasAllPermissions ? 'removed' : 'added'}`);
    } catch (error) {
      console.error('Error updating permissions:', error);
      toast.error('Failed to update permissions');
    }
  };

  const toggleResourceExpanded = (resource) => {
    setExpandedResources(prev => ({
      ...prev,
      [resource]: !prev[resource],
    }));
  };

  // Group permissions by resource
  const groupedPermissions = permissions.reduce((acc, permission) => {
    if (!acc[permission.resource]) {
      acc[permission.resource] = [];
    }
    acc[permission.resource].push(permission);
    return acc;
  }, {});

  const getRoleBadgeColor = (level) => {
    if (level === 0) return 'bg-purple-100 text-purple-800 border-purple-300';
    if (level <= 2) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (level <= 4) return 'bg-green-100 text-green-800 border-green-300';
    if (level <= 6) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-gray-100 text-gray-800 border-gray-300';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Role Management</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage roles, permissions, and access control for the entire system
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
            Create Role
          </button>
        </div>
      </div>

      {/* Role Hierarchy Visualization */}
      <div className="mt-8 bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <UserGroupIcon className="h-6 w-6 text-gray-400 mr-2" />
          Role Hierarchy
        </h2>
        <div className="space-y-3">
          {roles
            .sort((a, b) => a.level - b.level)
            .map((role) => (
              <div
                key={role.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                style={{ marginLeft: `${role.level * 20}px` }}
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(role.level)}`}>
                      Level {role.level}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-gray-900">{role.display_name || role.name}</h3>
                      {role.is_admin && (
                        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">Admin</span>
                      )}
                      {role.is_client && (
                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">Client</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{role.description}</p>
                    <p className="text-xs text-gray-400 mt-1">ID: {role.name}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => fetchRolePermissions(role.id)}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <ShieldCheckIcon className="h-4 w-4 mr-1" />
                    Permissions
                  </button>
                  {!['super_admin', 'admin', 'client'].includes(role.name) && (
                    <button
                      onClick={() => setShowDeleteConfirm(role.id)}
                      className="inline-flex items-center px-3 py-1.5 border border-red-300 shadow-sm text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Create Role Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Create New Role</h3>
            </div>
            <form onSubmit={handleCreateRole} className="px-6 py-4 space-y-4">
              {/* Role Templates */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select a Role Template (Optional)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {roleTemplates.map((template) => (
                    <button
                      key={template.name}
                      type="button"
                      onClick={() => handleSelectTemplate(template)}
                      className={`text-left p-3 border-2 rounded-lg transition-all ${
                        newRole.name === template.name
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 hover:border-blue-300'
                      }`}
                    >
                      <div className="font-semibold text-sm text-gray-900">
                        {template.display_name}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        Level {template.level} • {template.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Role Name (System ID)
                  </label>
                  <input
                    type="text"
                    value={newRole.name}
                    onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="super_admin"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Lowercase, underscores only</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={newRole.display_name}
                    onChange={(e) => setNewRole({ ...newRole, display_name: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Super Admin"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Shown in UI</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  value={newRole.description}
                  onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                  rows={2}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Full system access - can do everything"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Hierarchy Level (0 = highest, 10 = lowest)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={newRole.level}
                  onChange={(e) => setNewRole({ ...newRole, level: parseInt(e.target.value) })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Lower = higher authority • 0 (super_admin), 1 (admin), 10 (client)
                </p>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newRole.is_admin}
                    onChange={(e) => setNewRole({ ...newRole, is_admin: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Admin Role</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newRole.is_client}
                    onChange={(e) => setNewRole({ ...newRole, is_client: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Client Role</span>
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewRole({ 
                      name: '', 
                      display_name: '', 
                      description: '', 
                      level: 5,
                      is_admin: false,
                      is_client: false,
                    });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  disabled={!canCreate}
                >
                  Create Role
                </button>
              </div>

              {isDuplicateName && (
                <p className="text-xs text-red-500 mt-2">Role name already exists. Choose a unique name.</p>
              )}
              {isReserved && (
                <p className="text-xs text-red-500 mt-2">Cannot create reserved system roles or use reserved levels.</p>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Permission Matrix Modal */}
      {showPermissionMatrix && selectedRole && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 my-8">
            <div className="px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    Permissions for {selectedRole.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedRole.permissions.length} of {permissions.length} permissions assigned
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowPermissionMatrix(false);
                    setSelectedRole(null);
                    setExpandedResources({});
                  }}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>
            <div className="px-6 py-4 max-h-[600px] overflow-y-auto">
              <div className="space-y-4">
                {Object.entries(groupedPermissions).map(([resource, perms]) => {
                  const isExpanded = expandedResources[resource] !== false;
                  const hasAllPermissions = perms.every(p =>
                    selectedRole.permissions.some(sp => sp.id === p.id)
                  );
                  const hasSomePermissions = perms.some(p =>
                    selectedRole.permissions.some(sp => sp.id === p.id)
                  );

                  return (
                    <div key={resource} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                        <button
                          onClick={() => toggleResourceExpanded(resource)}
                          className="flex items-center space-x-2 text-sm font-medium text-gray-900 hover:text-gray-700"
                        >
                          {isExpanded ? (
                            <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                          ) : (
                            <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                          )}
                          <span className="capitalize">{resource}</span>
                          <span className="text-gray-500">({perms.length})</span>
                        </button>
                        <button
                          onClick={() => handleBulkToggleResource(resource)}
                          className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-medium ${
                            hasAllPermissions
                              ? 'bg-red-100 text-red-800 hover:bg-red-200'
                              : hasSomePermissions
                              ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                              : 'bg-green-100 text-green-800 hover:bg-green-200'
                          }`}
                        >
                          {hasAllPermissions ? 'Remove All' : 'Add All'}
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="px-4 py-3 space-y-2">
                          {perms.map((permission) => {
                            const isAssigned = selectedRole.permissions.some(
                              (p) => p.id === permission.id
                            );
                            return (
                              <div
                                key={permission.id}
                                className="flex items-center justify-between py-2 px-3 rounded hover:bg-gray-50"
                              >
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {permission.name}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {permission.description}
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleTogglePermission(permission.id)}
                                  className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${
                                    isAssigned
                                      ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                  }`}
                                >
                                  {isAssigned ? (
                                    <CheckIcon className="h-5 w-5" />
                                  ) : (
                                    <XMarkIcon className="h-5 w-5" />
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setShowPermissionMatrix(false);
                  setSelectedRole(null);
                  setExpandedResources({});
                }}
                className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4">
              <h3 className="text-lg font-medium text-gray-900">Delete Role</h3>
              <p className="mt-2 text-sm text-gray-500">
                Are you sure you want to delete this role? This action cannot be undone and will affect all users assigned to this role.
              </p>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteRole(showDeleteConfirm)}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleManagement;
