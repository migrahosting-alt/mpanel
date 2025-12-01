// src/pages/admin/UsersPage.tsx
// Enterprise User Management - MigraHosting mPanel
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useCrudResource } from '../hooks/useCrudResource';
import { api } from '../lib/apiClient';

type User = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: 'admin' | 'customer' | string;
  status: string;
  two_factor_enabled?: boolean;
  last_login_at?: string;
  created_at?: string;
};

type UserCreate = {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role: string;
  customerId?: string;
  createCustomer?: boolean;
  companyName?: string;
};

type UserUpdate = {
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role: string;
  customerId?: string;
  createCustomer?: boolean;
  companyName?: string;
};

type UserStats = {
  total: number;
  by_role: Record<string, number>;
  by_status: Record<string, number>;
  new_this_month: number;
  active_today: number;
  two_fa_enabled: number;
};

type LoginHistoryEntry = {
  id: string;
  ip_address: string;
  user_agent: string;
  device_type?: string;
  browser?: string;
  os?: string;
  location?: string;
  success: boolean;
  failure_reason?: string;
  created_at: string;
};

const config = {
  listPath: '/users',
  listKey: 'users',
  createPath: '/users',
  updatePath: (id: string) => `/users/${id}`,
  deletePath: (id: string) => `/users/${id}`,
  mapCreateInput: (i: UserCreate) => ({
    email: i.email,
    password: i.password,
    first_name: i.firstName,
    last_name: i.lastName,
    role: i.role,
  }),
  mapUpdateInput: (i: UserUpdate) => {
    const payload: any = {
      email: i.email,
      first_name: i.firstName,
      last_name: i.lastName,
      role: i.role,
    };
    if (i.password && i.password.trim()) {
      payload.password = i.password;
    }
    return payload;
  },
};

function UsersPage() {
  const { items, loading, error, createItem, updateItem, deleteItem, refetch } =
    useCrudResource<User, UserCreate, UserUpdate>(config);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [form, setForm] = useState<UserCreate>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'customer',
    customerId: '',
    createCustomer: false,
    companyName: '',
  });

  // Enterprise Features State
  const [stats, setStats] = useState<UserStats | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [showLoginHistory, setShowLoginHistory] = useState<string | null>(null);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/users/stats/summary') as any;
        if (response.success) {
          setStats(response.stats);
        }
      } catch (err) {
        console.error('Failed to fetch user stats:', err);
      }
    };
    fetchStats();
  }, [items]);

  // Fetch customers list for dropdown
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await api.get('/customers') as any;
        setCustomers(response.customers || response.data || []);
      } catch (err) {
        console.error('Failed to fetch customers:', err);
      }
    };
    fetchCustomers();
  }, []);

  // Fetch login history
  const fetchLoginHistory = async (userId: string) => {
    setLoadingHistory(true);
    try {
      const response = await api.get(`/users/${userId}/login-history`) as any;
      setLoginHistory(response.history || []);
    } catch (err) {
      console.error('Failed to fetch login history:', err);
      toast.error('Failed to load login history');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Export users
  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await fetch(`${(api as any).baseURL || '/api'}/users/export?format=csv`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Users exported successfully');
    } catch (err) {
      toast.error('Failed to export users');
    } finally {
      setExporting(false);
    }
  };

  // Bulk actions
  const handleBulkAction = async () => {
    if (!bulkAction || selectedUsers.size === 0) return;
    
    try {
      await api.post('/users/bulk-action', {
        action: bulkAction,
        user_ids: Array.from(selectedUsers),
      });
      toast.success(`${selectedUsers.size} users ${bulkAction}d successfully`);
      setSelectedUsers(new Set());
      setBulkAction('');
      refetch?.();
    } catch (err) {
      toast.error(`Failed to ${bulkAction} users`);
    }
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === filteredItems.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredItems.map(u => u.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedUsers);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedUsers(newSet);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      role: 'customer',
      customerId: '',
      createCustomer: false,
      companyName: '',
    });
    setModalOpen(true);
  };

  const openEdit = (u: User) => {
    setEditing(u);
    setForm({
      email: u.email,
      password: '',
      firstName: u.first_name ?? '',
      lastName: u.last_name ?? '',
      role: u.role,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.email || (!editing && !form.password)) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (form.password && form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    try {
      if (editing) {
        await updateItem(editing.id, form);
        toast.success('User updated successfully');
      } else {
        await createItem(form);
        toast.success('User created successfully');
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(editing ? 'Failed to update user' : 'Failed to create user');
    }
  };

  const handleDelete = async (u: User) => {
    setDeleteConfirm(u);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    
    try {
      await deleteItem(deleteConfirm.id);
      toast.success('User deleted successfully');
      setDeleteConfirm(null);
    } catch (err) {
      toast.error('Failed to delete user');
    }
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      super_admin: 'bg-red-100 text-red-700',
      admin: 'bg-purple-100 text-purple-700',
      manager: 'bg-indigo-100 text-indigo-700',
      editor: 'bg-cyan-100 text-cyan-700',
      sales: 'bg-amber-100 text-amber-700',
      support: 'bg-teal-100 text-teal-700',
      billing: 'bg-orange-100 text-orange-700',
      customer: 'bg-blue-100 text-blue-700',
      client: 'bg-blue-100 text-blue-700',
    };
    return colors[role] || 'bg-gray-100 text-gray-700';
  };

  const formatRole = (role: string): string => {
    const roleLabels: Record<string, string> = {
      super_admin: 'Super Admin',
      admin: 'Admin',
      manager: 'Manager',
      editor: 'Editor',
      sales: 'Sales',
      support: 'Support',
      billing: 'Billing',
      customer: 'Customer',
      client: 'Client',
    };
    return roleLabels[role] || role;
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-gray-100 text-gray-700',
      suspended: 'bg-red-100 text-red-700',
      deleted: 'bg-slate-100 text-slate-500',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  // Filter items
  const filteredItems = items.filter(u => {
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    const matchesSearch = !searchQuery || 
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.last_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRole && matchesStatus && matchesSearch;
  });

  return (
    <div className="p-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-bold text-violet-600">{stats.total}</div>
            <div className="text-xs text-slate-500">Total Users</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-bold text-green-600">{stats.by_status?.active || 0}</div>
            <div className="text-xs text-slate-500">Active</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-bold text-blue-600">{stats.new_this_month}</div>
            <div className="text-xs text-slate-500">New This Month</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-bold text-amber-600">{stats.active_today}</div>
            <div className="text-xs text-slate-500">Active Today</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-bold text-teal-600">{stats.two_fa_enabled}</div>
            <div className="text-xs text-slate-500">2FA Enabled</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-bold text-purple-600">{stats.by_role?.admin || 0}</div>
            <div className="text-xs text-slate-500">Admins</div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-slate-500">
            Manage panel users, admins, and customer logins.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            {exporting ? '⏳ Exporting...' : '📥 Export CSV'}
          </button>
          <button
            onClick={openCreate}
            className="px-4 py-2 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700"
          >
            + Add User
          </button>
        </div>
      </div>

      {/* Filters & Bulk Actions */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search users..."
            className="w-full border rounded-lg px-4 py-2 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="border rounded-lg px-4 py-2 text-sm bg-white"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="all">All Roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="support">Support</option>
          <option value="billing">Billing</option>
          <option value="customer">Customer</option>
        </select>
        <select
          className="border rounded-lg px-4 py-2 text-sm bg-white"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="inactive">Inactive</option>
        </select>

        {/* Bulk Actions */}
        {selectedUsers.size > 0 && (
          <div className="flex items-center gap-2 bg-violet-50 rounded-lg px-3 py-1">
            <span className="text-sm text-violet-700 font-medium">
              {selectedUsers.size} selected
            </span>
            <select
              className="border rounded-lg px-2 py-1 text-sm bg-white"
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value)}
            >
              <option value="">Bulk Action...</option>
              <option value="activate">Activate</option>
              <option value="suspend">Suspend</option>
              <option value="delete">Delete</option>
              <option value="force-password-change">Force Password Change</option>
            </select>
            <button
              onClick={handleBulkAction}
              disabled={!bulkAction}
              className="px-3 py-1 text-sm bg-violet-600 text-white rounded-lg disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-500">Loading users…</div>
      ) : filteredItems.length === 0 ? (
        <div className="border border-dashed rounded-xl p-8 text-center text-slate-500">
          {searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
            ? 'No users match your filters.'
            : 'No users yet. Click "Add User" to create one.'
          }
        </div>
      ) : (
        <table className="min-w-full text-sm bg-white rounded-xl shadow-sm overflow-hidden">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={selectedUsers.size === filteredItems.length && filteredItems.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-300"
                />
              </th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">2FA</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((u) => (
              <tr key={u.id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedUsers.has(u.id)}
                    onChange={() => toggleSelect(u.id)}
                    className="rounded border-slate-300"
                  />
                </td>
                <td className="px-4 py-3 font-medium">{u.email}</td>
                <td className="px-4 py-3">
                  {[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRoleBadge(u.role)}`}>
                    {formatRole(u.role)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full capitalize ${getStatusBadge(u.status || 'active')}`}>
                    {u.status || 'active'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.two_factor_enabled ? (
                    <span className="text-green-600">✓</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    onClick={() => {
                      setShowLoginHistory(u.id);
                      fetchLoginHistory(u.id);
                    }}
                    className="text-xs px-3 py-1 rounded-full border border-slate-200 hover:bg-slate-50"
                    title="Login History"
                  >
                    📋
                  </button>
                  <button
                    onClick={() => openEdit(u)}
                    className="text-xs px-3 py-1 rounded-full border border-slate-200 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(u)}
                    className="text-xs px-3 py-1 rounded-full border border-red-100 text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Summary */}
      <div className="mt-4 text-sm text-slate-500">
        Showing {filteredItems.length} of {items.length} users
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {editing ? 'Edit User' : 'Add User'}
              </h2>
              <button onClick={() => setModalOpen(false)}>✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Email</label>
                <input
                  type="email"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Password {editing && <span className="text-slate-400 font-normal">(leave blank to keep current)</span>}
                </label>
                <input
                  type="password"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder={editing ? '••••••••' : 'Minimum 8 characters'}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">First Name</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Last Name</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Role</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                >
                  <option value="super_admin">Super Admin</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="editor">Editor</option>
                  <option value="sales">Sales</option>
                  <option value="support">Support</option>
                  <option value="billing">Billing</option>
                  <option value="customer">Customer</option>
                </select>
              </div>

              {!editing && form.role === 'customer' && (
                <div className="border-t pt-4">
                  <label className="block text-xs font-semibold mb-2">Customer Profile</label>
                  <div className="space-y-3">
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        checked={!!form.customerId}
                        onChange={() => setForm(f => ({ ...f, customerId: customers[0]?.id || '', createCustomer: false }))}
                        className="text-violet-600"
                      />
                      <span className="text-sm">Link to existing customer</span>
                    </label>

                    {form.customerId && (
                      <select
                        className="w-full border rounded-lg px-3 py-2 text-sm ml-6"
                        value={form.customerId}
                        onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}
                      >
                        <option value="">Select a customer...</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.company_name || c.id}
                          </option>
                        ))}
                      </select>
                    )}

                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        checked={form.createCustomer}
                        onChange={() => setForm(f => ({ ...f, customerId: '', createCustomer: true }))}
                        className="text-violet-600"
                      />
                      <span className="text-sm">Create new customer profile</span>
                    </label>

                    {form.createCustomer && (
                      <input
                        className="w-full border rounded-lg px-3 py-2 text-sm ml-6"
                        placeholder="Company Name"
                        value={form.companyName}
                        onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                      />
                    )}

                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        checked={!form.customerId && !form.createCustomer}
                        onChange={() => setForm(f => ({ ...f, customerId: '', createCustomer: false, companyName: '' }))}
                        className="text-violet-600"
                      />
                      <span className="text-sm">No customer profile</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end space-x-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium"
              >
                {editing ? 'Save Changes' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-2">Delete User?</h2>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to delete <strong>{deleteConfirm.email}</strong>? This action can be undone by an administrator.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login History Modal */}
      {showLoginHistory && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Login History</h2>
              <button onClick={() => setShowLoginHistory(null)}>✕</button>
            </div>

            {loadingHistory ? (
              <div className="text-sm text-slate-500 py-8 text-center">Loading history...</div>
            ) : loginHistory.length === 0 ? (
              <div className="text-sm text-slate-500 py-8 text-center">No login history found.</div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Date/Time</th>
                    <th className="px-3 py-2 text-left">IP Address</th>
                    <th className="px-3 py-2 text-left">Browser</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loginHistory.map((entry) => (
                    <tr key={entry.id} className="border-t">
                      <td className="px-3 py-2">
                        {new Date(entry.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{entry.ip_address}</td>
                      <td className="px-3 py-2 text-xs">
                        {entry.browser || entry.user_agent?.substring(0, 30) || '—'}
                      </td>
                      <td className="px-3 py-2">
                        {entry.success ? (
                          <span className="text-green-600 text-xs">✓ Success</span>
                        ) : (
                          <span className="text-red-600 text-xs">✗ Failed: {entry.failure_reason}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowLoginHistory(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsersPage;
