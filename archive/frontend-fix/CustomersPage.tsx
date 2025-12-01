// src/pages/CustomersPage.tsx
// Enterprise Customer Management - MigraHosting mPanel
import { useState, useEffect } from 'react';
import { useCrudResource } from '../hooks/useCrudResource';
import { api } from '../lib/apiClient';

type Customer = {
  id: string;
  company_name: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  state: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  tax_id: string | null;
  currency: string;
  credit_balance: number;
  status: string;
  notes: string | null;
  user_id: string | null;
  linked_user_email?: string;
  linked_user_first_name?: string;
  linked_user_last_name?: string;
  domain_count?: number;
  active_subscriptions?: number;
  created_at: string;
  updated_at: string;
};

type CustomerForm = {
  companyName: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  city: string;
  state: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  taxId: string;
  currency: string;
  userId: string;
  notes: string;
  status: string;
  // User account creation
  createUserAccount: boolean;
  password: string;
  confirmPassword: string;
};

const emptyForm: CustomerForm = {
  companyName: '',
  email: '',
  firstName: '',
  lastName: '',
  phone: '',
  country: 'US',
  city: '',
  state: '',
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  taxId: '',
  currency: 'USD',
  userId: '',
  notes: '',
  status: 'active',
  createUserAccount: false,
  password: '',
  confirmPassword: '',
};

const config = {
  listPath: '/customers',
  listKey: 'customers',
  createPath: '/customers',
  updatePath: (id: string) => `/customers/${id}`,
  deletePath: (id: string) => `/customers/${id}`,
  mapCreateInput: (input: CustomerForm) => ({
    company_name: input.companyName || null,
    email: input.email || null,
    first_name: input.firstName || null,
    last_name: input.lastName || null,
    phone: input.phone || null,
    country: input.country || null,
    city: input.city || null,
    state: input.state || null,
    address_line1: input.addressLine1 || null,
    address_line2: input.addressLine2 || null,
    postal_code: input.postalCode || null,
    tax_id: input.taxId || null,
    currency: input.currency || 'USD',
    user_id: input.userId || null,
    notes: input.notes || null,
    status: input.status || 'active',
    create_user_account: input.createUserAccount,
    password: input.password || null,
  }),
  mapUpdateInput: (input: CustomerForm) => ({
    company_name: input.companyName || null,
    email: input.email || null,
    first_name: input.firstName || null,
    last_name: input.lastName || null,
    phone: input.phone || null,
    country: input.country || null,
    city: input.city || null,
    state: input.state || null,
    address_line1: input.addressLine1 || null,
    address_line2: input.addressLine2 || null,
    postal_code: input.postalCode || null,
    tax_id: input.taxId || null,
    currency: input.currency || 'USD',
    user_id: input.userId || null,
    notes: input.notes || null,
    status: input.status,
  }),
};

// Country list
const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'AU', name: 'Australia' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'IN', name: 'India' },
  { code: 'JP', name: 'Japan' },
  { code: 'CN', name: 'China' },
  { code: 'KR', name: 'South Korea' },
  { code: 'SG', name: 'Singapore' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'OTHER', name: 'Other' },
];

// US States
const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

export function CustomersPage() {
  const { items, loading, error, createItem, updateItem, deleteItem, refetch } =
    useCrudResource<Customer, CustomerForm, CustomerForm>(config);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [submitting, setSubmitting] = useState(false);

  // Fetch users list for dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await api.get('/users') as any;
        setUsers(response.users || response.data || []);
      } catch (err) {
        console.error('Failed to fetch users:', err);
      }
    };
    fetchUsers();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      companyName: c.company_name ?? '',
      email: c.email ?? '',
      firstName: c.first_name ?? '',
      lastName: c.last_name ?? '',
      phone: c.phone ?? '',
      country: c.country ?? 'US',
      city: c.city ?? '',
      state: c.state ?? '',
      addressLine1: c.address_line1 ?? '',
      addressLine2: c.address_line2 ?? '',
      postalCode: c.postal_code ?? '',
      taxId: c.tax_id ?? '',
      currency: c.currency ?? 'USD',
      userId: c.user_id ?? '',
      notes: c.notes ?? '',
      status: c.status ?? 'active',
      createUserAccount: false,
      password: '',
      confirmPassword: '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    // Validation
    if (!form.companyName?.trim() && !form.email?.trim()) {
      alert('Either Company Name or Email is required');
      return;
    }

    // Email validation
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      alert('Please enter a valid email address');
      return;
    }

    // Password validation if creating user account
    if (form.createUserAccount && !editing) {
      if (!form.email) {
        alert('Email is required when creating a user account');
        return;
      }
      if (!form.password) {
        alert('Password is required when creating a user account');
        return;
      }
      if (form.password.length < 8) {
        alert('Password must be at least 8 characters');
        return;
      }
      if (form.password !== form.confirmPassword) {
        alert('Passwords do not match');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (editing) {
        await updateItem(editing.id, form);
      } else {
        await createItem(form);
      }
      setModalOpen(false);
      refetch?.();
    } catch (err: any) {
      alert(err.message || 'Failed to save customer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (c: Customer) => {
    if (!window.confirm(`Delete customer "${c.company_name || c.email || c.id}"?\n\nThis action can be undone by an administrator.`)) return;
    try {
      await deleteItem(c.id);
      refetch?.();
    } catch (err: any) {
      alert(err.message || 'Failed to delete customer');
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-gray-100 text-gray-700',
      suspended: 'bg-red-100 text-red-700',
      pending: 'bg-yellow-100 text-yellow-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getDisplayName = (c: Customer): string => {
    if (c.first_name || c.last_name) {
      return [c.first_name, c.last_name].filter(Boolean).join(' ');
    }
    if (c.linked_user_first_name || c.linked_user_last_name) {
      return [c.linked_user_first_name, c.linked_user_last_name].filter(Boolean).join(' ');
    }
    return '—';
  };

  const getDisplayEmail = (c: Customer): string => {
    return c.email || c.linked_user_email || '—';
  };

  // Filter items
  const filteredItems = items.filter(c => {
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesSearch = !searchQuery || 
      c.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone?.includes(searchQuery);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Customers</h1>
          <p className="text-sm text-slate-500">
            Manage MigraHosting customers and their accounts.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700 transition-colors"
        >
          + Add Customer
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search customers..."
            className="w-full border rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="border rounded-lg px-4 py-2 text-sm bg-white"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-500">Loading customers…</div>
      ) : filteredItems.length === 0 ? (
        <div className="border border-dashed rounded-xl p-8 text-center text-slate-500">
          {searchQuery || statusFilter !== 'all' 
            ? 'No customers match your filters.'
            : 'No customers yet. Click "Add Customer" to create one.'
          }
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Location</th>
                <th className="px-4 py-3 font-semibold text-center">Domains</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-slate-900">
                        {c.company_name || getDisplayName(c)}
                      </div>
                      {c.company_name && getDisplayName(c) !== '—' && (
                        <div className="text-xs text-slate-500">{getDisplayName(c)}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{getDisplayEmail(c)}</td>
                  <td className="px-4 py-3 text-slate-600">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {[c.city, c.state, c.country].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-medium">
                      {c.domain_count ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full capitalize ${getStatusBadge(c.status)}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => openEdit(c)}
                      className="text-xs px-3 py-1 rounded-full border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      className="text-xs px-3 py-1 rounded-full border border-red-100 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stats Bar */}
      <div className="mt-4 flex gap-4 text-sm text-slate-500">
        <span>Total: {items.length} customers</span>
        <span>•</span>
        <span>Active: {items.filter(c => c.status === 'active').length}</span>
        <span>•</span>
        <span>Inactive: {items.filter(c => c.status !== 'active').length}</span>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editing ? 'Edit Customer' : 'Add Customer'}
              </h2>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-xs">1</span>
                  Basic Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold mb-1">Company Name</label>
                    <input
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                      value={form.companyName}
                      onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                      placeholder="Acme Corporation"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">First Name</label>
                    <input
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                      value={form.firstName}
                      onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Last Name</label>
                    <input
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                      value={form.lastName}
                      onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                      placeholder="Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="john@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Phone</label>
                    <input
                      type="tel"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>
              </div>

              {/* Address Information */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-xs">2</span>
                  Address
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold mb-1">Address Line 1</label>
                    <input
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                      value={form.addressLine1}
                      onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))}
                      placeholder="123 Main Street"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold mb-1">Address Line 2</label>
                    <input
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                      value={form.addressLine2}
                      onChange={(e) => setForm((f) => ({ ...f, addressLine2: e.target.value }))}
                      placeholder="Suite 100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">City</label>
                    <input
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                      value={form.city}
                      onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                      placeholder="Miami"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">State/Province</label>
                    {form.country === 'US' ? (
                      <select
                        className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                        value={form.state}
                        onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                      >
                        <option value="">Select State</option>
                        {US_STATES.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                        value={form.state}
                        onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                        placeholder="State/Province"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Postal Code</label>
                    <input
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                      value={form.postalCode}
                      onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
                      placeholder="33101"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Country</label>
                    <select
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                      value={form.country}
                      onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Billing & Account */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-xs">3</span>
                  Billing & Account
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Tax ID / VAT</label>
                    <input
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                      value={form.taxId}
                      onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))}
                      placeholder="XX-XXXXXXX"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Currency</label>
                    <select
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                      value={form.currency}
                      onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                    >
                      <option value="USD">USD - US Dollar</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="GBP">GBP - British Pound</option>
                      <option value="CAD">CAD - Canadian Dollar</option>
                      <option value="AUD">AUD - Australian Dollar</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Status</label>
                    <select
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                      value={form.status}
                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Link to User Account</label>
                    <select
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                      value={form.userId}
                      onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value, createUserAccount: false }))}
                      disabled={form.createUserAccount}
                    >
                      <option value="">No user linked</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.email} {u.first_name ? `(${u.first_name} ${u.last_name || ''})` : ''} [{u.role}]
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">
                      Link to an existing user account for login access
                    </p>
                  </div>
                </div>
              </div>

              {/* Create User Account - Only show when creating new customer */}
              {!editing && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs">+</span>
                    Create User Account (Optional)
                  </h3>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <label className="flex items-center gap-3 mb-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.createUserAccount}
                        onChange={(e) => setForm((f) => ({ 
                          ...f, 
                          createUserAccount: e.target.checked,
                          userId: e.target.checked ? '' : f.userId 
                        }))}
                        className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                        disabled={!!form.userId}
                      />
                      <span className="text-sm font-medium text-slate-700">
                        Create a login account for this customer
                      </span>
                    </label>
                    {form.createUserAccount && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold mb-1">
                            Password <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="password"
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                            value={form.password}
                            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                            placeholder="Minimum 8 characters"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1">
                            Confirm Password <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="password"
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                            value={form.confirmPassword}
                            onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                            placeholder="Confirm password"
                          />
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-slate-500">
                            A user account with role "Customer" will be created using the email above.
                            The customer can use these credentials to log in to the portal.
                          </p>
                        </div>
                      </div>
                    )}
                    {form.userId && (
                      <p className="text-xs text-amber-600">
                        Cannot create new account when linking to existing user.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-xs">4</span>
                  Notes
                </h3>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-sm h-24 resize-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Internal notes about this customer..."
                />
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end space-x-3">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || (!form.companyName?.trim() && !form.email?.trim())}
                className="px-6 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-violet-700 transition-colors"
              >
                {submitting ? 'Saving...' : editing ? 'Save Changes' : 'Create Customer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
