import React from 'react';
import {
  CurrencyDollarIcon,
  UsersIcon,
  DocumentTextIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';

const stats = [
  { name: 'Total Revenue', value: '$45,231', change: '+12.5%', icon: CurrencyDollarIcon },
  { name: 'Active Customers', value: '2,345', change: '+8.2%', icon: UsersIcon },
  { name: 'Pending Invoices', value: '23', change: '-4.3%', icon: DocumentTextIcon },
  { name: 'Monthly Growth', value: '18.2%', change: '+2.1%', icon: ArrowTrendingUpIcon },
];

export default function Dashboard() {
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
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <div>
                  <p className="font-medium text-gray-900">Invoice #{2024000 + i}</p>
                  <p className="text-sm text-gray-500">Customer {i}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">${(Math.random() * 1000).toFixed(2)}</p>
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                    Paid
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Subscriptions</h2>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <div>
                  <p className="font-medium text-gray-900">Premium Hosting</p>
                  <p className="text-sm text-gray-500">Renews in {i * 10} days</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">${(29.99 * i).toFixed(2)}/mo</p>
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                    Active
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
