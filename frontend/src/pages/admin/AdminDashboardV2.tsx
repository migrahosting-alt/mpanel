import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE } from '../../lib/apiClient';
import {
  UsersIcon,
  ServerStackIcon,
  CurrencyDollarIcon,
  CloudIcon,
  HeartIcon,
  CpuChipIcon,
  BoltIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  Cog6ToothIcon,
  PlusIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';

// Types
type SystemHealth = 'healthy' | 'degraded' | 'down';

interface AdminDashboardResponse {
  stats: {
    totalUsers: number;
    totalCustomers: number;
    monthlyRecurringRevenue: number;
    activeServers: number;
    activeCloudPods: number;
    systemHealth: SystemHealth;
  };
  operations: {
    pendingJobs: number;
    failedJobs24h: number;
    workersOnline: number;
    averageQueueDelaySeconds: number;
  };
  cloud: {
    totalPods: number;
    runningPods: number;
    errorPods: number;
    unhealthyPods: number;
    autoHealEvents24h: number;
  };
  revenue: {
    currentMrr: number;
    currency: string;
    changePercentMonth: number;
    history: { date: string; amount: number }[];
  };
  tenants: {
    tenantId: string;
    name: string;
    pods: number;
    cpuCores: number;
    memoryMb: number;
    diskGb: number;
  }[];
  recentActivity: {
    id: string;
    timestamp: string;
    relativeTime: string;
    actor?: string;
    description: string;
    category: string;
    href?: string;
  }[];
  systemEvents: {
    id: string;
    timestamp: string;
    level: 'info' | 'warn' | 'error';
    service: string;
    message: string;
  }[];
}

// Stat Card Component
interface StatCardProps {
  label: string;
  value: string;
  subLabel?: string;
  icon: React.ElementType;
  status?: SystemHealth | 'ok' | 'warn' | 'error';
  trend?: 'up' | 'down' | 'flat';
  href?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, subLabel, icon: Icon, status, trend, href }) => {
  const navigate = useNavigate();
  const clickable = !!href;

  const statusColor =
    status === 'down' || status === 'error'
      ? 'bg-red-100 text-red-700'
      : status === 'degraded' || status === 'warn'
      ? 'bg-amber-100 text-amber-700'
      : status === 'healthy' || status === 'ok'
      ? 'bg-emerald-100 text-emerald-700'
      : '';

  const statusText =
    status === 'healthy' ? 'Healthy' :
    status === 'degraded' ? 'Degraded' :
    status === 'down' ? 'Down' :
    status === 'ok' ? 'OK' :
    status === 'warn' ? 'Warning' :
    status === 'error' ? 'Error' : '';

  return (
    <div
      onClick={() => href && navigate(href)}
      className={`
        flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200
        ${clickable ? 'cursor-pointer hover:shadow-md hover:border-violet-300 hover:ring-1 hover:ring-violet-200' : 'cursor-default'}
      `}
    >
      <div className="flex items-start justify-between">
        <div className="rounded-lg bg-violet-100 p-2.5">
          <Icon className="h-5 w-5 text-violet-600" />
        </div>
        {trend && (
          <div className={`flex items-center text-xs font-medium ${trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-600' : 'text-slate-500'}`}>
            {trend === 'up' && <ArrowTrendingUpIcon className="h-4 w-4 mr-0.5" />}
            {trend === 'down' && <ArrowTrendingDownIcon className="h-4 w-4 mr-0.5" />}
          </div>
        )}
      </div>
      <div className="mt-4">
        <div className="text-sm font-medium text-slate-500">{label}</div>
        <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
        {subLabel && (
          <div className="mt-1 text-xs text-slate-500">{subLabel}</div>
        )}
        {status && (
          <div className="mt-3">
            <span className={`${statusColor} inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium`}>
              {status === 'healthy' || status === 'ok' ? <CheckCircleIcon className="h-3.5 w-3.5 mr-1" /> : null}
              {status === 'degraded' || status === 'warn' ? <ExclamationTriangleIcon className="h-3.5 w-3.5 mr-1" /> : null}
              {status === 'down' || status === 'error' ? <XCircleIcon className="h-3.5 w-3.5 mr-1" /> : null}
              {statusText}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// Section Card Component
interface SectionCardProps {
  title: string;
  children: React.ReactNode;
  rightAction?: React.ReactNode;
  className?: string;
}

const SectionCard: React.FC<SectionCardProps> = ({ title, children, rightAction, className = '' }) => (
  <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {rightAction}
    </div>
    {children}
  </div>
);

// Skeleton Loader
const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`animate-pulse rounded-lg bg-slate-100 ${className ?? ''}`} />
);

// Format currency helper
const formatCurrency = (amount: number, currency: string = 'USD') => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(0)}`;
  }
};

// Category icon mapping
const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'user': return UsersIcon;
    case 'customer': return BuildingOfficeIcon;
    case 'cloudpods': return CloudIcon;
    case 'billing': return CurrencyDollarIcon;
    case 'security': return ShieldCheckIcon;
    default: return BoltIcon;
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'user': return 'bg-blue-100 text-blue-700';
    case 'customer': return 'bg-green-100 text-green-700';
    case 'cloudpods': return 'bg-violet-100 text-violet-700';
    case 'billing': return 'bg-amber-100 text-amber-700';
    case 'security': return 'bg-red-100 text-red-700';
    default: return 'bg-slate-100 text-slate-700';
  }
};

// Main Component
export default function AdminDashboardV2() {
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        
        const res = await fetch(`${API_BASE}/admin/dashboard`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!res.ok) {
          throw new Error(`Failed to load dashboard (${res.status})`);
        }
        
        const json = await res.json();
        
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('Dashboard load error:', err);
          setError(err?.message ?? 'Failed to load dashboard');
          // Load fallback data for demo
          setData(getFallbackData());
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadDashboard();

    // Refresh every 30 seconds
    const interval = setInterval(loadDashboard, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Fallback data for demo/development
  const getFallbackData = (): AdminDashboardResponse => ({
    stats: {
      totalUsers: 47,
      totalCustomers: 23,
      monthlyRecurringRevenue: 2847,
      activeServers: 4,
      activeCloudPods: 156,
      systemHealth: 'healthy'
    },
    operations: {
      pendingJobs: 12,
      failedJobs24h: 3,
      workersOnline: 4,
      averageQueueDelaySeconds: 2.4
    },
    cloud: {
      totalPods: 156,
      runningPods: 142,
      errorPods: 2,
      unhealthyPods: 5,
      autoHealEvents24h: 8
    },
    revenue: {
      currentMrr: 2847,
      currency: 'USD',
      changePercentMonth: 12.5,
      history: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 86400000).toISOString(),
        amount: 80 + Math.random() * 40
      }))
    },
    tenants: [
      { tenantId: '1', name: 'Acme Corp', pods: 24, cpuCores: 48, memoryMb: 98304, diskGb: 480 },
      { tenantId: '2', name: 'TechStart Inc', pods: 18, cpuCores: 36, memoryMb: 73728, diskGb: 360 },
      { tenantId: '3', name: 'CloudNine LLC', pods: 12, cpuCores: 24, memoryMb: 49152, diskGb: 240 },
      { tenantId: '4', name: 'DevOps Pro', pods: 8, cpuCores: 16, memoryMb: 32768, diskGb: 160 },
      { tenantId: '5', name: 'Startup Hub', pods: 6, cpuCores: 12, memoryMb: 24576, diskGb: 120 },
    ],
    recentActivity: [
      { id: '1', timestamp: new Date().toISOString(), relativeTime: '2 minutes ago', actor: 'admin@migrahosting.com', description: 'Created CloudPod "prod-api-01"', category: 'cloudpods', href: '/admin/cloudpods/1' },
      { id: '2', timestamp: new Date().toISOString(), relativeTime: '15 minutes ago', description: 'New customer signup: TechStart Inc', category: 'customer', href: '/admin/customers/2' },
      { id: '3', timestamp: new Date().toISOString(), relativeTime: '1 hour ago', actor: 'system', description: 'Backup completed for 23 CloudPods', category: 'system' },
      { id: '4', timestamp: new Date().toISOString(), relativeTime: '2 hours ago', description: 'Invoice #1234 paid - $149.99', category: 'billing', href: '/admin/invoices/1234' },
      { id: '5', timestamp: new Date().toISOString(), relativeTime: '3 hours ago', actor: 'john@example.com', description: 'New user registered', category: 'user', href: '/admin/users/5' },
    ],
    systemEvents: [
      { id: '1', timestamp: new Date().toISOString(), level: 'info', service: 'cloudpods-worker', message: 'Worker node-01 healthy, processing 12 jobs' },
      { id: '2', timestamp: new Date().toISOString(), level: 'warn', service: 'api', message: 'High API latency detected (avg 450ms)' },
      { id: '3', timestamp: new Date().toISOString(), level: 'info', service: 'billing', message: 'Stripe webhook processed successfully' },
      { id: '4', timestamp: new Date().toISOString(), level: 'error', service: 'dns-worker', message: 'Failed to update DNS record for example.com' },
      { id: '5', timestamp: new Date().toISOString(), level: 'info', service: 'ssl-worker', message: 'Auto-renewed 5 SSL certificates' },
    ]
  });

  return (
    <div className="space-y-6 pb-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            System-wide overview of users, infrastructure, and CloudPods activity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
            <span className="mr-1.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Live
          </span>
        </div>
      </div>

      {/* Top Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {loading || !data ? (
          <>
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </>
        ) : (
          <>
            <StatCard
              label="Total Users"
              value={data.stats.totalUsers.toString()}
              subLabel="All panel users"
              icon={UsersIcon}
              href="/admin/users"
              trend="up"
            />
            <StatCard
              label="Total Customers"
              value={data.stats.totalCustomers.toString()}
              subLabel="Active accounts"
              icon={BuildingOfficeIcon}
              href="/admin/customers"
              trend="up"
            />
            <StatCard
              label="Monthly Revenue"
              value={formatCurrency(data.stats.monthlyRecurringRevenue, data.revenue.currency)}
              subLabel={`${data.revenue.changePercentMonth >= 0 ? '+' : ''}${data.revenue.changePercentMonth.toFixed(1)}% vs last month`}
              icon={CurrencyDollarIcon}
              href="/invoices"
              trend={data.revenue.changePercentMonth >= 0 ? 'up' : 'down'}
            />
            <StatCard
              label="Active Servers"
              value={data.stats.activeServers.toString()}
              subLabel="Provisioned servers"
              icon={ServerStackIcon}
              href="/servers"
            />
            <StatCard
              label="Active CloudPods"
              value={data.stats.activeCloudPods.toString()}
              subLabel="Running pods"
              icon={CloudIcon}
              href="/admin/cloudpods"
              trend="up"
            />
            <StatCard
              label="System Health"
              value={data.stats.systemHealth === 'healthy' ? 'Healthy' : data.stats.systemHealth === 'degraded' ? 'Degraded' : 'Issues'}
              subLabel="Click for details"
              icon={HeartIcon}
              status={data.stats.systemHealth}
              href="/admin/system-health"
            />
          </>
        )}
      </div>

      {/* Quick Actions */}
      <SectionCard title="Quick Actions">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/admin/users?action=create')}
            className="inline-flex items-center rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 transition-colors"
          >
            <PlusIcon className="h-4 w-4 mr-1.5" />
            Create User
          </button>
          <button
            onClick={() => navigate('/products?action=create')}
            className="inline-flex items-center rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 transition-colors"
          >
            <PlusIcon className="h-4 w-4 mr-1.5" />
            Add Product
          </button>
          <button
            onClick={() => navigate('/admin/servers?action=create')}
            className="inline-flex items-center rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 transition-colors"
          >
            <PlusIcon className="h-4 w-4 mr-1.5" />
            Add Server
          </button>
          <button
            onClick={() => navigate('/admin/cloudpods?action=create')}
            className="inline-flex items-center rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 transition-colors"
          >
            <PlusIcon className="h-4 w-4 mr-1.5" />
            Create CloudPod
          </button>
          <button
            onClick={() => navigate('/admin/settings')}
            className="inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 transition-colors"
          >
            <Cog6ToothIcon className="h-4 w-4 mr-1.5" />
            System Settings
          </button>
        </div>
      </SectionCard>

      {/* Operations + Cloud Infrastructure */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Operations Pulse"
          rightAction={
            <Link to="/admin/jobs" className="text-xs font-medium text-violet-600 hover:text-violet-700">
              View jobs →
            </Link>
          }
        >
          {loading || !data ? (
            <Skeleton className="h-32" />
          ) : (
            <dl className="grid grid-cols-2 gap-6">
              <div className="rounded-lg bg-slate-50 p-4">
                <dt className="flex items-center text-sm text-slate-500">
                  <ClockIcon className="h-4 w-4 mr-1.5 text-slate-400" />
                  Jobs pending
                </dt>
                <dd className="mt-2 text-2xl font-semibold text-slate-900">
                  {data.operations.pendingJobs}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <dt className="flex items-center text-sm text-slate-500">
                  <ExclamationTriangleIcon className="h-4 w-4 mr-1.5 text-red-400" />
                  Failed (24h)
                </dt>
                <dd className={`mt-2 text-2xl font-semibold ${data.operations.failedJobs24h > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {data.operations.failedJobs24h}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <dt className="flex items-center text-sm text-slate-500">
                  <CpuChipIcon className="h-4 w-4 mr-1.5 text-emerald-400" />
                  Workers online
                </dt>
                <dd className="mt-2 text-2xl font-semibold text-emerald-600">
                  {data.operations.workersOnline}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <dt className="flex items-center text-sm text-slate-500">
                  <BoltIcon className="h-4 w-4 mr-1.5 text-amber-400" />
                  Avg queue delay
                </dt>
                <dd className="mt-2 text-2xl font-semibold text-slate-900">
                  {data.operations.averageQueueDelaySeconds.toFixed(1)}s
                </dd>
              </div>
            </dl>
          )}
        </SectionCard>

        <SectionCard
          title="Cloud Infrastructure"
          rightAction={
            <Link to="/admin/cloudpods" className="text-xs font-medium text-violet-600 hover:text-violet-700">
              View all pods →
            </Link>
          }
        >
          {loading || !data ? (
            <Skeleton className="h-32" />
          ) : (
            <dl className="grid grid-cols-2 gap-6">
              <div className="rounded-lg bg-slate-50 p-4">
                <dt className="flex items-center text-sm text-slate-500">
                  <CloudIcon className="h-4 w-4 mr-1.5 text-violet-400" />
                  Total pods
                </dt>
                <dd className="mt-2 text-2xl font-semibold text-slate-900">
                  {data.cloud.totalPods}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <dt className="flex items-center text-sm text-slate-500">
                  <CheckCircleIcon className="h-4 w-4 mr-1.5 text-emerald-400" />
                  Running
                </dt>
                <dd className="mt-2 text-2xl font-semibold text-emerald-600">
                  {data.cloud.runningPods}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <dt className="flex items-center text-sm text-slate-500">
                  <XCircleIcon className="h-4 w-4 mr-1.5 text-red-400" />
                  Errors
                </dt>
                <dd className={`mt-2 text-2xl font-semibold ${data.cloud.errorPods > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {data.cloud.errorPods}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <dt className="flex items-center text-sm text-slate-500">
                  <HeartIcon className="h-4 w-4 mr-1.5 text-amber-400" />
                  Auto-healed (24h)
                </dt>
                <dd className="mt-2 text-2xl font-semibold text-slate-900">
                  {data.cloud.autoHealEvents24h}
                </dd>
              </div>
            </dl>
          )}
        </SectionCard>
      </div>

      {/* Revenue + Tenant Usage */}
      <div className="grid gap-4 lg:grid-cols-5">
        <SectionCard
          title="Revenue & Billing"
          className="lg:col-span-2"
          rightAction={
            <Link to="/invoices" className="text-xs font-medium text-violet-600 hover:text-violet-700">
              View billing →
            </Link>
          }
        >
          {loading || !data ? (
            <Skeleton className="h-40" />
          ) : (
            <div className="space-y-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Current MRR
                  </div>
                  <div className="mt-1 text-3xl font-bold text-slate-900">
                    {formatCurrency(data.revenue.currentMrr, data.revenue.currency)}
                  </div>
                </div>
                <div
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    data.revenue.changePercentMonth >= 0
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-red-50 text-red-700'
                  }`}
                >
                  {data.revenue.changePercentMonth >= 0 ? '▲' : '▼'}{' '}
                  {Math.abs(data.revenue.changePercentMonth).toFixed(1)}%
                </div>
              </div>
              {/* Mini bar chart */}
              <div className="mt-4 flex h-24 items-end gap-0.5 rounded-lg bg-slate-50 px-3 py-3">
                {data.revenue.history.slice(-30).map((point, i) => {
                  const maxAmount = Math.max(...data.revenue.history.map((p) => p.amount || 0), 1);
                  const height = Math.max(8, (point.amount / maxAmount) * 64);
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-t bg-violet-400 hover:bg-violet-500 transition-colors"
                      style={{ height: `${height}px` }}
                      title={`${point.date}: ${formatCurrency(point.amount, data.revenue.currency)}`}
                    />
                  );
                })}
              </div>
              <div className="text-xs text-slate-500 text-center">Last 30 days</div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Top Tenants by Usage"
          className="lg:col-span-3"
          rightAction={
            <Link to="/admin/customers" className="text-xs font-medium text-violet-600 hover:text-violet-700">
              View all tenants →
            </Link>
          }
        >
          {loading || !data ? (
            <Skeleton className="h-40" />
          ) : data.tenants.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">No tenants with CloudPods usage yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-2 pr-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Tenant</th>
                    <th className="py-2 pr-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Pods</th>
                    <th className="py-2 pr-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">vCPU</th>
                    <th className="py-2 pr-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">RAM</th>
                    <th className="py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Disk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.tenants.slice(0, 5).map((tenant) => (
                    <tr
                      key={tenant.tenantId}
                      onClick={() => navigate(`/admin/customers/${tenant.tenantId}`)}
                      className="cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-3 pr-4 text-sm font-medium text-slate-900">{tenant.name}</td>
                      <td className="py-3 pr-4 text-sm text-slate-600">{tenant.pods}</td>
                      <td className="py-3 pr-4 text-sm text-slate-600">{tenant.cpuCores}</td>
                      <td className="py-3 pr-4 text-sm text-slate-600">{(tenant.memoryMb / 1024).toFixed(0)} GB</td>
                      <td className="py-3 text-sm text-slate-600">{tenant.diskGb} GB</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Recent Activity + System Events */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Recent Activity"
          rightAction={
            <Link to="/admin/audit" className="text-xs font-medium text-violet-600 hover:text-violet-700">
              View audit log →
            </Link>
          }
        >
          {loading || !data ? (
            <Skeleton className="h-48" />
          ) : data.recentActivity.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">No recent activity.</p>
          ) : (
            <ul className="space-y-3">
              {data.recentActivity.slice(0, 6).map((item) => {
                const IconComponent = getCategoryIcon(item.category);
                const colorClass = getCategoryColor(item.category);
                return (
                  <li
                    key={item.id}
                    onClick={() => item.href && navigate(item.href)}
                    className={`flex items-start gap-3 rounded-lg p-2 transition-colors ${item.href ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                  >
                    <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${colorClass}`}>
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 truncate">{item.description}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {item.actor && <span className="font-medium">{item.actor}</span>}
                        {item.actor && ' • '}
                        {item.relativeTime}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="System Events"
          rightAction={
            <Link to="/admin/system-events" className="text-xs font-medium text-violet-600 hover:text-violet-700">
              View all events →
            </Link>
          }
        >
          {loading || !data ? (
            <Skeleton className="h-48" />
          ) : data.systemEvents.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">No recent system events.</p>
          ) : (
            <ul className="space-y-2">
              {data.systemEvents.slice(0, 6).map((event) => {
                const levelStyles = {
                  info: 'bg-slate-100 text-slate-600',
                  warn: 'bg-amber-100 text-amber-700',
                  error: 'bg-red-100 text-red-700',
                };

                return (
                  <li
                    key={event.id}
                    className="flex items-start justify-between gap-3 rounded-lg p-2 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${levelStyles[event.level]}`}>
                          {event.level}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">{event.service}</span>
                      </div>
                      <p className={`mt-1 text-sm truncate ${event.level === 'error' ? 'text-red-700' : event.level === 'warn' ? 'text-amber-700' : 'text-slate-700'}`}>
                        {event.message}
                      </p>
                    </div>
                    <div className="text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
            <p className="text-sm text-amber-800">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
