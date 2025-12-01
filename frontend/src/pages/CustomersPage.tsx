// src/pages/CustomersPage.tsx
import { useState, useEffect } from 'react';
import { api } from '../lib/apiClient';

type Subscription = {
  id: string;
  status: string;
  domain?: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

type Customer = {
  id: string;
  email: string;
  full_name?: string | null;
  stripe_customer_id?: string | null;
  created_at: string;
  updated_at: string;
  subscriptions: Subscription[];
};

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCustomers() {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get('/admin/customers') as any;
        if (!cancelled) {
          setCustomers(response.customers || []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to load customers');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadCustomers();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadCustomers, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading && customers.length === 0) {
    return (
      <div className="p-6">
        <div className="text-sm text-slate-500">Loading customers...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Customers</h1>
          <p className="text-sm text-slate-500">
            {customers.length} customer{customers.length !== 1 ? 's' : ''} from Stripe payments
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {customers.length === 0 ? (
        <div className="border border-dashed rounded-xl p-8 text-center text-slate-500">
          No customers yet. Orders from migrahosting.com will appear here automatically.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Subscriptions</th>
                <th className="px-4 py-3 font-semibold">Stripe ID</th>
                <th className="px-4 py-3 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="border-t hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-violet-600">
                    {customer.email}
                  </td>
                  <td className="px-4 py-3">
                    {customer.full_name || <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {customer.subscriptions.length === 0 ? (
                      <span className="text-slate-400">None</span>
                    ) : (
                      <div className="space-y-1">
                        {customer.subscriptions.map((sub) => (
                          <div key={sub.id} className="text-xs">
                            <span className="font-medium">{sub.product?.name || 'Plan'}</span>
                            {sub.domain && (
                              <span className="text-slate-500"> → {sub.domain}</span>
                            )}
                            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                              sub.status === 'active' ? 'bg-green-100 text-green-700' :
                              sub.status === 'pending_provisioning' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {sub.status.replace('_', ' ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-500">
                    {customer.stripe_customer_id || <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(customer.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

