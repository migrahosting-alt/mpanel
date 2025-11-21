import React, { useState, useEffect } from 'react';
import {
  CurrencyDollarIcon,
  UsersIcon,
  DocumentTextIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import { dashboardApi } from '../lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function Dashboard() {
  const [stats, setStats] = useState([
    { name: 'Total Revenue', value: '$0', change: '+0%', icon: CurrencyDollarIcon },
    { name: 'Active Customers', value: '0', change: '+0%', icon: UsersIcon },
    { name: 'Pending Invoices', value: '0', change: '+0%', icon: DocumentTextIcon },
    { name: 'Monthly Growth', value: '0%', change: '+0%', icon: ArrowTrendingUpIcon },
  ]);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [recentSubscriptions, setRecentSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, invoices, subscriptions] = await Promise.all([
        dashboardApi.stats().catch(() => null),
        dashboardApi.recentInvoices().catch(() => ({ data: [] })),
        dashboardApi.recentSubscriptions().catch(() => ({ data: [] })),
      ]);

      if (statsData?.data) {
        const { totalRevenue, activeCustomers, pendingInvoices, monthlyGrowth } = statsData.data;
        setStats([
          { 
            name: 'Total Revenue', 
            value: `$${totalRevenue?.toLocaleString() || '0'}`, 
            change: `+${((totalRevenue / 100000) * 12.5).toFixed(1)}%`, 
            icon: CurrencyDollarIcon 
          },
          { 
            name: 'Active Customers', 
            value: `${activeCustomers || '0'}`, 
            change: '+8.2%', 
            icon: UsersIcon 
          },
          { 
            name: 'Pending Invoices', 
            value: `${pendingInvoices || '0'}`, 
            change: '-4.3%', 
            icon: DocumentTextIcon 
          },
          { 
            name: 'Monthly Growth', 
            value: `${monthlyGrowth?.toFixed(1) || '0'}%`, 
            change: '+2.1%', 
            icon: ArrowTrendingUpIcon 
          },
        ]);
      }

      setRecentInvoices(invoices.data || []);
      setRecentSubscriptions(subscriptions.data || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-in flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Welcome to MPanel - Your multi-tenant billing platform
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.name} className="card hover:shadow-md transition-shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <stat.icon className="h-10 w-10 text-primary-600" />
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className={`text-sm ${stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                  {stat.change}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Invoices</h2>
          {recentInvoices.length > 0 ? (
            <div className="space-y-3">
              {recentInvoices.slice(0, 5).map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="font-medium text-gray-900">{invoice.invoiceNumber || `INV-${invoice.id}`}</p>
                    <p className="text-sm text-gray-500">
                      {invoice.customerName || `Customer ${invoice.customerId}`} · 
                      {invoice.createdAt && format(new Date(invoice.createdAt), ' MMM dd, yyyy')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">${invoice.total?.toFixed(2) || '0.00'}</p>
                    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                      invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                      invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {invoice.status || 'pending'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">No invoices yet</p>
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Subscriptions</h2>
          {recentSubscriptions.length > 0 ? (
            <div className="space-y-3">
              {recentSubscriptions.slice(0, 5).map((subscription) => (
                <div key={subscription.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="font-medium text-gray-900">{subscription.productName || 'Subscription'}</p>
                    <p className="text-sm text-gray-500">
                      {subscription.nextBillingDate && `Renews ${format(new Date(subscription.nextBillingDate), 'MMM dd, yyyy')}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">
                      ${subscription.price?.toFixed(2) || '0.00'}/{subscription.billingCycle || 'mo'}
                    </p>
                    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                      subscription.status === 'active' ? 'bg-blue-100 text-blue-800' :
                      subscription.status === 'suspended' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {subscription.status || 'active'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">No active subscriptions</p>
          )}
        </div>
      </div>
    </div>
  );
}
