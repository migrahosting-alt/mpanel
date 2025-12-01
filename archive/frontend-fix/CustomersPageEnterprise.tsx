// src/pages/CustomersPage.tsx
// Enterprise Customer Management - MigraHosting mPanel
import { useState, useEffect } from 'react';
import { useCrudResource } from '../hooks/useCrudResource';
import { api } from '../lib/apiClient';
import toast from 'react-hot-toast';

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
  createUserAccount: boolean;
  password: string;
  confirmPassword: string;
};

type CustomerStats = {
  total: number;
  by_status: Record<string, number>;
  new_this_month: number;
  new_last_month: number;
  growth_rate: number;
  by_country: Array<{ country: string; count: number }>;
  total_credit_balance: number;
};

type CreditTransaction = {
  id: string;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  balance_after: number;
  created_at: string;
  created_by_email?: string;
};

type ActivityEntry = {
  id: string;
  action: string;
  entity_type: string;
  changes: any;
  ip_address: string;
  created_at: string;
  performed_by: string;
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

  // Enterprise Features State
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [exporting, setExporting] = useState(false);
  
  // Customer Detail Modal
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [detailTab, setDetailTab] = useState<'credits' | 'activity'>('credits');
  const [creditBalance, setCreditBalance] = useState(0);
  const [creditTransactions, setCreditTransactions] = useState<CreditTransaction[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  // Credit Modal
  const [creditModal, setCreditModal] = useState(false);
  const [creditForm, setCreditForm] = useState({ amount: '', type: 'credit' as 'credit' | 'debit', description: '' });

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/customers/stats/overview') as any;
        if (response.success) {
          setStats(response.stats);
        }
      } catch (err) {
        console.error('Failed to fetch customer stats:', err);
      }
    };
    fetchStats();
  }, [items]);

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

  // Fetch customer details (credits & activity)
  const fetchCustomerDetails = async (customerId: string) => {
    setLoadingDetail(true);
    try {
      const [creditsRes, activityRes] = await Promise.all([
        api.get(`/customers/${customerId}/credits`) as Promise<any>,
        api.get(`/customers/${customerId}/activity`) as Promise<any>,
      ]);
      
      setCreditBalance(creditsRes.balance || 0);
      setCreditTransactions(creditsRes.transactions || []);
      setActivity(activityRes.activity || []);
    } catch (err) {
      console.error('Failed to fetch customer details:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Export customers
  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await fetch(`${(api as any).baseURL || '/api'}/customers/export?format=csv`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customers_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Customers exported successfully');
    } catch (err) {
      toast.error('Failed to export customers');
    } finally {
      setExporting(false);
    }
  };

  // Bulk actions
  const handleBulkAction = async () => {
    if (!bulkAction || selectedCustomers.size === 0) return;
    
    try {
      await api.post('/customers/bulk-action', {
        action: bulkAction,
        customer_ids: Array.from(selectedCustomers),
      });
      toast.success(`${selectedCustomers.size} customers ${bulkAction}d successfully`);
      setSelectedCustomers(new Set());
      setBulkAction('');
      refetch?.();
    } catch (err) {
      toast.error(`Failed to ${bulkAction} customers`);
    }
  };

  // Add credit
  const handleAddCredit = async () => {
    if (!detailCustomer || !creditForm.amount) return;
    
    try {
      await api.post(`/customers/${detailCustomer.id}/credits`, {
        amount: parseFloat(creditForm.amount),
        type: creditForm.type,
        description: creditForm.description || `Manual ${creditForm.type}`,
      });
      toast.success(`Credit ${creditForm.type}ed successfully`);
      setCreditModal(false);
      setCreditForm({ amount: '', type: 'credit', description: '' });
      fetchCustomerDetails(detailCustomer.id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add credit');
    }
  };

  const toggleSelectAll = () => {
    if (selectedCustomers.size === filteredItems.length) {
      setSelectedCustomers(new Set());
    } else {
      setSelectedCustomers(new Set(filteredItems.map(c => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedCustomers);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedCustomers(newSet);
  };

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

  const openDetails = (c: Customer) => {
    setDetailCustomer(c);
    setDetailTab('credits');
    fetchCustomerDetails(c.id);
  };

  const handleSubmit = async () => {
    if (!form.companyName?.trim() && !form.email?.trim()) {
      toast.error('Either Company Name or Email is required');
      return;
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (form.createUserAccount && !editing) {
      if (!form.email) {
        toast.error('Email is required when creating a user account');
        return;
      }
      if (!form.password || form.password.length < 8) {
        toast.error('Password must be at least 8 characters');
        return;
      }
      if (form.password !== form.confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (editing) {
        await updateItem(editing.id, form);
        toast.success('Customer updated');
      } else {
        await createItem(form);
        toast.success('Customer created');
      }
      setModalOpen(false);
      refetch?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save customer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (c: Customer) => {
    if (!window.confirm(`Delete customer "${c.company_name || c.email || c.id}"?`)) return;
    try {
      await deleteItem(c.id);
      toast.success('Customer deleted');
      refetch?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete customer');
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
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-bold text-violet-600">{stats.total}</div>
            <div className="text-xs text-slate-500">Total Customers</div>
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
            <div className={`text-2xl font-bold ${stats.growth_rate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {stats.growth_rate >= 0 ? '+' : ''}{stats.growth_rate}%
            </div>
            <div className="text-xs text-slate-500">Growth Rate</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-bold text-amber-600">${stats.total_credit_balance.toFixed(2)}</div>
            <div className="text-xs text-slate-500">Total Credits</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-bold text-red-600">{stats.by_status?.suspended || 0}</div>
            <div className="text-xs text-slate-500">Suspended</div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Customers</h1>
          <p className="text-sm text-slate-500">
            Manage MigraHosting customers and their accounts.
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
            className="px-4 py-2 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700 transition-colors"
          >
            + Add Customer
          </button>
        </div>
      </div>

      {/* Filters & Bulk Actions */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search customers..."
            className="w-full border rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-violet-500"
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

        {/* Bulk Actions */}
        {selectedCustomers.size > 0 && (
          <div className="flex items-center gap-2 bg-violet-50 rounded-lg px-3 py-1">
            <span className="text-sm text-violet-700 font-medium">
              {selectedCustomers.size} selected
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
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedCustomers.size === filteredItems.length && filteredItems.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300"
                  />
                </th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Location</th>
                <th className="px-4 py-3 font-semibold text-right">Credit</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedCustomers.has(c.id)}
                      onChange={() => toggleSelect(c.id)}
                      className="rounded border-slate-300"
                    />
                  </td>
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
                  <td className="px-4 py-3 text-slate-600">
                    {[c.city, c.state, c.country].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    ${(c.credit_balance || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full capitalize ${getStatusBadge(c.status)}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => openDetails(c)}
                      className="text-xs px-3 py-1 rounded-full border border-violet-200 text-violet-600 hover:bg-violet-50"
                      title="View Details"
                    >
                      📊
                    </button>
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

      {/* Summary */}
      <div className="mt-4 text-sm text-slate-500">
        Showing {filteredItems.length} of {items.length} customers
      </div>

      {/* Customer Details Modal */}
      {detailCustomer && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {detailCustomer.company_name || getDisplayName(detailCustomer)}
                </h2>
                <p className="text-sm text-slate-500">{getDisplayEmail(detailCustomer)}</p>
              </div>
              <button onClick={() => setDetailCustomer(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {/* Tabs */}
            <div className="border-b px-6">
              <div className="flex gap-4">
                <button
                  onClick={() => setDetailTab('credits')}
                  className={`py-3 text-sm font-medium border-b-2 ${detailTab === 'credits' ? 'border-violet-600 text-violet-600' : 'border-transparent text-slate-500'}`}
                >
                  💰 Credits
                </button>
                <button
                  onClick={() => setDetailTab('activity')}
                  className={`py-3 text-sm font-medium border-b-2 ${detailTab === 'activity' ? 'border-violet-600 text-violet-600' : 'border-transparent text-slate-500'}`}
                >
                  📋 Activity
                </button>
              </div>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {loadingDetail ? (
                <div className="text-center py-8 text-slate-500">Loading...</div>
              ) : detailTab === 'credits' ? (
                <div>
                  {/* Credit Balance */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <div className="text-3xl font-bold text-violet-600">${creditBalance.toFixed(2)}</div>
                      <div className="text-sm text-slate-500">Current Balance</div>
                    </div>
                    <button
                      onClick={() => setCreditModal(true)}
                      className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700"
                    >
                      + Add Credit
                    </button>
                  </div>

                  {/* Credit Transactions */}
                  <h4 className="font-semibold text-sm mb-3">Recent Transactions</h4>
                  {creditTransactions.length === 0 ? (
                    <div className="text-sm text-slate-500 py-4 text-center">No transactions yet</div>
                  ) : (
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left">Type</th>
                          <th className="px-3 py-2 text-left">Description</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                          <th className="px-3 py-2 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {creditTransactions.map((t) => (
                          <tr key={t.id} className="border-t">
                            <td className="px-3 py-2">{new Date(t.created_at).toLocaleDateString()}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded text-xs ${t.type === 'credit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {t.type}
                              </span>
                            </td>
                            <td className="px-3 py-2">{t.description}</td>
                            <td className={`px-3 py-2 text-right font-medium ${t.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {t.amount >= 0 ? '+' : ''}${Math.abs(t.amount).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right">${t.balance_after.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : (
                <div>
                  <h4 className="font-semibold text-sm mb-3">Activity Timeline</h4>
                  {activity.length === 0 ? (
                    <div className="text-sm text-slate-500 py-4 text-center">No activity recorded</div>
                  ) : (
                    <div className="space-y-3">
                      {activity.map((a) => (
                        <div key={a.id} className="flex gap-3 p-3 bg-slate-50 rounded-lg">
                          <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 text-sm">
                            📝
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium">{a.action.replace(/_/g, ' ')}</div>
                            <div className="text-xs text-slate-500">
                              {a.performed_by} • {new Date(a.created_at).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Credit Modal */}
      {creditModal && detailCustomer && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Add Credit</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Type</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={creditForm.type}
                  onChange={(e) => setCreditForm(f => ({ ...f, type: e.target.value as 'credit' | 'debit' }))}
                >
                  <option value="credit">Credit (Add)</option>
                  <option value="debit">Debit (Subtract)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={creditForm.amount}
                  onChange={(e) => setCreditForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Description</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={creditForm.description}
                  onChange={(e) => setCreditForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Reason for adjustment..."
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setCreditModal(false)}
                className="px-4 py-2 rounded-xl border text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCredit}
                disabled={!creditForm.amount}
                className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal - keeping original form structure */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editing ? 'Edit Customer' : 'Add Customer'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
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
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={form.companyName}
                      onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                      placeholder="Acme Corporation"
                    />
                  </div>
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
                    <label className="block text-xs font-semibold mb-1">Phone</label>
                    <input
                      type="tel"
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-xs">2</span>
                  Address
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold mb-1">Address Line 1</label>
                    <input
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={form.addressLine1}
                      onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold mb-1">Address Line 2</label>
                    <input
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={form.addressLine2}
                      onChange={(e) => setForm((f) => ({ ...f, addressLine2: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">City</label>
                    <input
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={form.city}
                      onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">State</label>
                    {form.country === 'US' ? (
                      <select
                        className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                        value={form.state}
                        onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                      >
                        <option value="">Select State</option>
                        {US_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
                      </select>
                    ) : (
                      <input
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        value={form.state}
                        onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Postal Code</label>
                    <input
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={form.postalCode}
                      onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Country</label>
                    <select
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                      value={form.country}
                      onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                    >
                      {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Billing */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-xs">3</span>
                  Billing & Account
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Tax ID</label>
                    <input
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={form.taxId}
                      onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Currency</label>
                    <select
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                      value={form.currency}
                      onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="CAD">CAD</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Status</label>
                    <select
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
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
                    <label className="block text-xs font-semibold mb-1">Link to User</label>
                    <select
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                      value={form.userId}
                      onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value, createUserAccount: false }))}
                      disabled={form.createUserAccount}
                    >
                      <option value="">No user linked</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.email} [{u.role}]
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Create User Account */}
              {!editing && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs">+</span>
                    Create User Account
                  </h3>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <label className="flex items-center gap-3 mb-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.createUserAccount}
                        onChange={(e) => setForm((f) => ({ ...f, createUserAccount: e.target.checked, userId: '' }))}
                        disabled={!!form.userId}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm">Create login account for this customer</span>
                    </label>
                    {form.createUserAccount && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold mb-1">Password</label>
                          <input
                            type="password"
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                            value={form.password}
                            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                            placeholder="Min 8 characters"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1">Confirm Password</label>
                          <input
                            type="password"
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                            value={form.confirmPassword}
                            onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold mb-1">Notes</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-sm h-20"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl border text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium disabled:opacity-50"
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
