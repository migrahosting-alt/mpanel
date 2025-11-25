// src/pages/CustomersPage.tsx
import { useState, useEffect } from 'react';
import { useCrudResource } from '../hooks/useCrudResource';
import { api } from '../lib/apiClient';

type Customer = {
  id: string;
  company_name: string | null;
  email?: string;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
};

type CustomerCreate = {
  companyName: string;
  userId?: string;  // Link to existing user
  phone?: string;
  country?: string;
  city?: string;
  addressLine1?: string;
  addressLine2?: string;
  state?: string;
  postalCode?: string;
};

type CustomerUpdate = CustomerCreate;

const config = {
  listPath: '/customers',
  listKey: 'customers',
  createPath: '/customers',
  updatePath: (id: string) => `/customers/${id}`,
  deletePath: (id: string) => `/customers/${id}`,
  mapCreateInput: (input: CustomerCreate) => ({
    company_name: input.companyName,
    user_id: input.userId,
    phone: input.phone,
    country: input.country,
    city: input.city,
    address_line1: input.addressLine1,
    address_line2: input.addressLine2,
    state: input.state,
    postal_code: input.postalCode,
  }),
  mapUpdateInput: (input: CustomerUpdate) => ({
    company_name: input.companyName,
    user_id: input.userId,
    phone: input.phone,
    country: input.country,
    city: input.city,
    address_line1: input.addressLine1,
    address_line2: input.addressLine2,
    state: input.state,
    postal_code: input.postalCode,
  }),
};

export function CustomersPage() {
  const { items, loading, error, createItem, updateItem, deleteItem } =
    useCrudResource<Customer, CustomerCreate, CustomerUpdate>(config);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState<CustomerCreate>({
    companyName: '',
    userId: '',
    phone: '',
    country: '',
    city: '',
    addressLine1: '',
    addressLine2: '',
    state: '',
    postalCode: '',
  });

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
    setForm({ 
      companyName: '', 
      userId: '', 
      phone: '', 
      country: '', 
      city: '',
      addressLine1: '',
      addressLine2: '',
      state: '',
      postalCode: '',
    });
    setModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      companyName: c.company_name ?? '',
      userId: (c as any).user_id ?? '',
      phone: c.phone ?? '',
      country: c.country ?? '',
      city: c.city ?? '',
      addressLine1: (c as any).address_line1 ?? '',
      addressLine2: (c as any).address_line2 ?? '',
      state: (c as any).state ?? '',
      postalCode: (c as any).postal_code ?? '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    // Validation
    if (!form.companyName?.trim()) {
      alert('Company Name is required');
      return;
    }
    
    try {
      if (editing) {
        await updateItem(editing.id, form);
      } else {
        await createItem(form);
      }
      setModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save customer');
    }
  };

  const handleDelete = async (c: Customer) => {
    if (!window.confirm(`Delete customer ${c.company_name || c.id}?`)) return;
    await deleteItem(c.id);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Customers</h1>
          <p className="text-sm text-slate-500">
            Manage MigraHosting customers and their accounts.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700"
        >
          + Add Customer
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-500">Loading customers…</div>
      ) : items.length === 0 ? (
        <div className="border border-dashed rounded-xl p-8 text-center text-slate-500">
          No customers yet. Click{" "}
          <span className="font-semibold">"Add Customer"</span> to create one.
        </div>
      ) : (
        <table className="min-w-full text-sm bg-white rounded-xl shadow-sm overflow-hidden">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-4 py-3 font-medium">
                  {c.company_name || '—'}
                </td>
                <td className="px-4 py-3">{c.email || '—'}</td>
                <td className="px-4 py-3">{c.phone || '—'}</td>
                <td className="px-4 py-3">
                  {[c.city, c.country].filter(Boolean).join(', ') || '—'}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    onClick={() => openEdit(c)}
                    className="text-xs px-3 py-1 rounded-full border border-slate-200 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
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
                {editing ? 'Edit Customer' : 'Add Customer'}
              </h2>
              <button onClick={() => setModalOpen(false)}>✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Company Name *
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.companyName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, companyName: e.target.value }))
                  }
                  placeholder="Abbes Tech LLC"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Link to User (Optional)
                </label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.userId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, userId: e.target.value }))
                  }
                >
                  <option value="">No user linked</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.email} ({u.first_name} {u.last_name})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Link this customer to an existing user account
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Phone
                  </label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    placeholder="8776764472"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Country
                  </label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.country}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, country: e.target.value }))
                    }
                    placeholder="United States"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    City
                  </label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.city}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, city: e.target.value }))
                    }
                    placeholder="Tamarac"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    State
                  </label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.state}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, state: e.target.value }))
                    }
                    placeholder="FL"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Address Line 1
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.addressLine1}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, addressLine1: e.target.value }))
                  }
                  placeholder="123 Main St"
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Address Line 2
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.addressLine2}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, addressLine2: e.target.value }))
                  }
                  placeholder="Suite 100"
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Postal Code
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.postalCode}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, postalCode: e.target.value }))
                  }
                  placeholder="33321"
                />
              </div>
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
                disabled={loading || !form.companyName?.trim()}
                className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-violet-700"
              >
                {loading ? 'Saving...' : editing ? 'Save Changes' : 'Create Customer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
