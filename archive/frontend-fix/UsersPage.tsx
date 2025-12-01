// src/pages/admin/UsersPage.tsx
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
};

type UserCreate = {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role: string;
  customerId?: string;  // Link to existing customer
  createCustomer?: boolean;  // Create customer profile
  companyName?: string;  // For new customer
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
    // Only include password if provided (for password reset)
    if (i.password && i.password.trim()) {
      payload.password = i.password;
    }
    return payload;
  },
};

function UsersPage() {
  const { items, loading, error, createItem, updateItem, deleteItem } =
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
      password: '', // don't prefill
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

    // Password validation for new users or when changing password
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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-slate-500">
            Manage panel users, admins, and customer logins.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700"
        >
          + Add User
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-500">Loading users…</div>
      ) : items.length === 0 ? (
        <div className="border border-dashed rounded-xl p-8 text-center text-slate-500">
          No users yet. Click{' '}
          <span className="font-semibold">“Add User”</span> to create one.
        </div>
      ) : (
        <table className="min-w-full text-sm bg-white rounded-xl shadow-sm overflow-hidden">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-3 font-medium">{u.email}</td>
                <td className="px-4 py-3">
                  {[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRoleBadge(
                      u.role
                    )}`}
                  >
                    {formatRole(u.role)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                    {u.status || 'active'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right space-x-2">
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

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {editing ? 'Edit User' : 'Add User'}
              </h2>
              <button onClick={() => setModalOpen(false)}>✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Email
                </label>
                <input
                  type="email"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
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
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  placeholder={editing ? '••••••••' : 'Minimum 8 characters'}
                />
                {!editing && (
                  <p className="text-xs text-slate-500 mt-1">Minimum 8 characters required</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    First Name
                  </label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.firstName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, firstName: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Last Name
                  </label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.lastName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, lastName: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Role
                </label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.role}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, role: e.target.value }))
                  }
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
                <>
                  <div className="border-t pt-4">
                    <label className="block text-xs font-semibold mb-2">
                      Customer Profile
                    </label>
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
                          onChange={(e) =>
                            setForm((f) => ({ ...f, customerId: e.target.value }))
                          }
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
                          onChange={(e) =>
                            setForm((f) => ({ ...f, companyName: e.target.value }))
                          }
                        />
                      )}

                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          checked={!form.customerId && !form.createCustomer}
                          onChange={() => setForm(f => ({ ...f, customerId: '', createCustomer: false, companyName: '' }))}
                          className="text-violet-600"
                        />
                        <span className="text-sm">No customer profile (admin/staff only)</span>
                      </label>
                    </div>
                  </div>
                </>
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
              Are you sure you want to delete <strong>{deleteConfirm.email}</strong>? This action cannot be undone.
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
    </div>
  );
}

export default UsersPage;
