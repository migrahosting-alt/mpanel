// frontend/src/pages/DashboardPage.tsx
import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/apiClient';
import toast from 'react-hot-toast';
import {
  GlobeAltIcon,
  ServerIcon,
  CircleStackIcon,
  EnvelopeIcon,
  CreditCardIcon,
  DocumentTextIcon,
  ChartBarIcon,
  UserPlusIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  ArrowTrendingUpIcon
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';

type DashboardStats = {
  services: {
    domains: number;
    hosting: number;
    databases: number;
    email_accounts: number;
    total: number;
  };
  subscriptions: {
    total: number;
    active: number;
    canceled: number;
  };
  billing: {
    totalInvoices: number;
    paidInvoices: number;
    unpaidInvoices: number;
    amountDue: number;
    paidLast30Days: number;
  };
  recentActivity: Array<{
    type: string;
    description: string;
    created_at: string;
  }>;
};

type QuickAction = {
  id: string;
  label: string;
  icon: string;
  path: string;
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, actionsData] = await Promise.all([
        apiClient.get<DashboardStats>('/dashboard/stats'),
        apiClient.get<{ actions: QuickAction[] }>('/dashboard/quick-actions')
      ]);
      
      setStats(statsData);
      setQuickActions(actionsData.actions || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getIconComponent = (iconName: string) => {
    const icons: Record<string, any> = {
      GlobeAltIcon,
      ServerIcon,
      CircleStackIcon,
      EnvelopeIcon,
      CreditCardIcon,
      DocumentTextIcon,
      ChartBarIcon,
      UserPlusIcon
    };
    return icons[iconName] || DocumentTextIcon;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-violet-600"></div>
          <p className="mt-4 text-sm text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-6">
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
          <p className="text-slate-500">Failed to load dashboard data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Welcome back! Here's what's happening with your services.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {quickActions.map((action) => {
          const IconComponent = getIconComponent(action.icon);
          return (
            <button
              key={action.id}
              onClick={() => navigate(action.path)}
              className="p-4 bg-white rounded-xl border-2 border-slate-200 hover:border-violet-300 hover:shadow-md transition-all group"
            >
              <IconComponent className="w-8 h-8 text-violet-600 mb-2 group-hover:scale-110 transition-transform" />
              <p className="text-sm font-medium text-slate-900">{action.label}</p>
            </button>
          );
        })}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* Services Card */}
        <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <ServerIcon className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.services.total}</span>
          </div>
          <h3 className="text-sm font-medium opacity-90">Total Services</h3>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs opacity-80">
            <div>
              <GlobeAltIcon className="w-4 h-4 inline mr-1" />
              {stats.services.domains} Domains
            </div>
            <div>
              <ServerIcon className="w-4 h-4 inline mr-1" />
              {stats.services.hosting} Hosting
            </div>
            <div>
              <CircleStackIcon className="w-4 h-4 inline mr-1" />
              {stats.services.databases} DBs
            </div>
            <div>
              <EnvelopeIcon className="w-4 h-4 inline mr-1" />
              {stats.services.email_accounts} Email
            </div>
          </div>
        </div>

        {/* Subscriptions Card */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <CreditCardIcon className="w-8 h-8 text-blue-600" />
            <span className="text-3xl font-bold text-slate-900">{stats.subscriptions.active}</span>
          </div>
          <h3 className="text-sm font-medium text-slate-600">Active Subscriptions</h3>
          <div className="mt-3 flex items-center gap-2">
            <CheckCircleIcon className="w-4 h-4 text-green-500" />
            <span className="text-xs text-slate-500">
              {stats.subscriptions.total} total, {stats.subscriptions.canceled} canceled
            </span>
          </div>
        </div>

        {/* Billing Card */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <DocumentTextIcon className="w-8 h-8 text-green-600" />
            <span className="text-3xl font-bold text-slate-900">{stats.billing.totalInvoices}</span>
          </div>
          <h3 className="text-sm font-medium text-slate-600">Total Invoices</h3>
          <div className="mt-3 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Paid:</span>
              <span className="font-medium text-green-600">{stats.billing.paidInvoices}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Unpaid:</span>
              <span className="font-medium text-red-600">{stats.billing.unpaidInvoices}</span>
            </div>
          </div>
        </div>

        {/* Amount Due Card */}
        <div className={`rounded-xl p-6 shadow-lg ${
          stats.billing.amountDue > 0 
            ? 'bg-gradient-to-br from-red-500 to-red-600 text-white' 
            : 'bg-gradient-to-br from-green-500 to-green-600 text-white'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <ExclamationCircleIcon className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">${stats.billing.amountDue.toFixed(2)}</span>
          </div>
          <h3 className="text-sm font-medium opacity-90">Amount Due</h3>
          {stats.billing.amountDue > 0 && (
            <button
              onClick={() => navigate('/invoices')}
              className="mt-3 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium transition-colors"
            >
              Pay Now →
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Billing Summary */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Billing Summary</h2>
            <ChartBarIcon className="w-5 h-5 text-slate-400" />
          </div>
          
          <div className="space-y-4">
            {/* Last 30 Days */}
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Paid Last 30 Days</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    ${stats.billing.paidLast30Days.toFixed(2)}
                  </p>
                </div>
                <ArrowTrendingUpIcon className="w-8 h-8 text-green-500" />
              </div>
            </div>

            {/* Invoice Breakdown */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{stats.billing.totalInvoices}</p>
                <p className="text-xs text-blue-700 mt-1">Total</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{stats.billing.paidInvoices}</p>
                <p className="text-xs text-green-700 mt-1">Paid</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-600">{stats.billing.unpaidInvoices}</p>
                <p className="text-xs text-red-700 mt-1">Unpaid</p>
              </div>
            </div>

            {stats.billing.unpaidInvoices > 0 && (
              <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <ExclamationCircleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-900">
                    You have {stats.billing.unpaidInvoices} unpaid invoice{stats.billing.unpaidInvoices > 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-yellow-700 mt-0.5">
                    Total amount due: ${stats.billing.amountDue.toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() => navigate('/invoices')}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700"
                >
                  View Invoices
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
            <ClockIcon className="w-5 h-5 text-slate-400" />
          </div>
          
          {stats.recentActivity.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <ClockIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recentActivity.slice(0, 8).map((activity, idx) => (
                <div key={idx} className="flex gap-3 pb-3 border-b border-slate-100 last:border-0">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center">
                      <CheckCircleIcon className="w-4 h-4 text-violet-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900 font-medium truncate">
                      {activity.type}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {activity.description}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(activity.created_at).toLocaleDateString()} at{' '}
                      {new Date(activity.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Service Status Overview (if you want to add it) */}
      <div className="mt-6 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Services Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 border border-slate-200 rounded-lg">
            <GlobeAltIcon className="w-6 h-6 text-blue-600 mb-2" />
            <p className="text-2xl font-bold text-slate-900">{stats.services.domains}</p>
            <p className="text-sm text-slate-500">Domains</p>
          </div>
          <div className="p-4 border border-slate-200 rounded-lg">
            <ServerIcon className="w-6 h-6 text-green-600 mb-2" />
            <p className="text-2xl font-bold text-slate-900">{stats.services.hosting}</p>
            <p className="text-sm text-slate-500">Hosting Accounts</p>
          </div>
          <div className="p-4 border border-slate-200 rounded-lg">
            <CircleStackIcon className="w-6 h-6 text-purple-600 mb-2" />
            <p className="text-2xl font-bold text-slate-900">{stats.services.databases}</p>
            <p className="text-sm text-slate-500">Databases</p>
          </div>
          <div className="p-4 border border-slate-200 rounded-lg">
            <EnvelopeIcon className="w-6 h-6 text-orange-600 mb-2" />
            <p className="text-2xl font-bold text-slate-900">{stats.services.email_accounts}</p>
            <p className="text-sm text-slate-500">Email Accounts</p>
          </div>
        </div>
      </div>
    </div>
  );
}
