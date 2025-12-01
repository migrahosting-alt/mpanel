// src/pages/ProvisioningOverview.tsx
import { useState, useEffect } from 'react';
import { api } from '../lib/apiClient';
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

type ProvisioningTask = {
  id: string;
  status: string;
  step: string;
  payload_json: any;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
  subscription: {
    id: string;
    domain?: string | null;
    status: string;
    product: {
      id: string;
      name: string;
      slug: string;
    };
    customer: {
      id: string;
      email: string;
      fullName?: string | null;
    };
  };
  server?: {
    id: string;
    name: string;
    fqdn: string;
  } | null;
};

export default function ProvisioningOverview() {
  const [tasks, setTasks] = useState<ProvisioningTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'success' | 'failed'>('all');

  useEffect(() => {
    let cancelled = false;

    async function loadTasks() {
      try {
        setError(null);
        const response = await api.get('/admin/subscriptions/tasks') as any;
        if (!cancelled) {
          setTasks(response.tasks || []);
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to load provisioning tasks');
          setLoading(false);
        }
      }
    }

    loadTasks();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(loadTasks, 10000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const filteredTasks = filter === 'all' 
    ? tasks 
    : tasks.filter(t => t.status === filter);

  const stats = {
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    success: tasks.filter(t => t.status === 'success').length,
    failed: tasks.filter(t => t.status === 'failed').length,
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <ClockIcon className="w-5 h-5 text-yellow-500" />;
      case 'in_progress':
        return <ArrowPathIcon className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      default:
        return <ClockIcon className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const classes = {
      pending: 'bg-yellow-100 text-yellow-700',
      in_progress: 'bg-blue-100 text-blue-700',
      success: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
    }[status] || 'bg-slate-100 text-slate-700';

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${classes}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  if (loading && tasks.length === 0) {
    return (
      <div className="p-6">
        <div className="text-sm text-slate-500">Loading provisioning tasks...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Automated Provisioning</h1>
        <p className="text-sm text-slate-500 mt-1">
          Real-time hosting account provisioning from Stripe orders
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 uppercase font-semibold">Pending</div>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            </div>
            <ClockIcon className="w-8 h-8 text-yellow-500 opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 uppercase font-semibold">Processing</div>
              <div className="text-2xl font-bold text-blue-600">{stats.in_progress}</div>
            </div>
            <ArrowPathIcon className="w-8 h-8 text-blue-500 opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 uppercase font-semibold">Completed</div>
              <div className="text-2xl font-bold text-green-600">{stats.success}</div>
            </div>
            <CheckCircleIcon className="w-8 h-8 text-green-500 opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 uppercase font-semibold">Failed</div>
              <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            </div>
            <XCircleIcon className="w-8 h-8 text-red-500 opacity-50" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            filter === 'all'
              ? 'bg-violet-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          All ({tasks.length})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            filter === 'pending'
              ? 'bg-yellow-500 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Pending ({stats.pending})
        </button>
        <button
          onClick={() => setFilter('failed')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            filter === 'failed'
              ? 'bg-red-500 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Failed ({stats.failed})
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Tasks Table */}
      {filteredTasks.length === 0 ? (
        <div className="border border-dashed rounded-xl p-8 text-center text-slate-500">
          {filter === 'all'
            ? 'No provisioning tasks yet. New orders from migrahosting.com will appear here automatically.'
            : `No ${filter} tasks.`}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Step</th>
                <th className="px-4 py-3 text-left font-semibold">Plan</th>
                <th className="px-4 py-3 text-left font-semibold">Domain</th>
                <th className="px-4 py-3 text-left font-semibold">Customer</th>
                <th className="px-4 py-3 text-left font-semibold">Server</th>
                <th className="px-4 py-3 text-left font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => (
                <tr key={task.id} className="border-t hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(task.status)}
                      {getStatusBadge(task.status)}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {task.step}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {task.subscription.product.name}
                  </td>
                  <td className="px-4 py-3">
                    {task.subscription.domain || (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-violet-600">
                    {task.subscription.customer.email}
                  </td>
                  <td className="px-4 py-3">
                    {task.server?.name || (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(task.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
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
