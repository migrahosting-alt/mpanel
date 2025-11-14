import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  UsersIcon, 
  ServerIcon, 
  CurrencyDollarIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCustomers: 0,
    totalRevenue: 0,
    totalServers: 0,
    activeSubscriptions: 0,
    systemHealth: 'Healthy'
  });

  useEffect(() => {
    // TODO: Fetch real admin stats from API
    setStats({
      totalUsers: 156,
      totalCustomers: 2345,
      totalRevenue: 45231,
      totalServers: 12,
      activeSubscriptions: 3421,
      systemHealth: 'Healthy'
    });
  }, []);

  const statCards = [
    {
      name: 'Total Users',
      value: stats.totalUsers,
      icon: UsersIcon,
      color: 'bg-blue-500',
      link: '/admin/users'
    },
    {
      name: 'Total Customers',
      value: stats.totalCustomers.toLocaleString(),
      icon: ShieldCheckIcon,
      color: 'bg-green-500',
      link: '/admin/customers'
    },
    {
      name: 'Monthly Revenue',
      value: `$${stats.totalRevenue.toLocaleString()}`,
      icon: CurrencyDollarIcon,
      color: 'bg-purple-500',
      link: '/invoices'
    },
    {
      name: 'Active Servers',
      value: stats.totalServers,
      icon: ServerIcon,
      color: 'bg-orange-500',
      link: '/servers'
    },
    {
      name: 'Active Subscriptions',
      value: stats.activeSubscriptions.toLocaleString(),
      icon: ChartBarIcon,
      color: 'bg-pink-500',
      link: '/subscriptions'
    },
    {
      name: 'System Health',
      value: stats.systemHealth,
      icon: GlobeAltIcon,
      color: 'bg-teal-500',
      link: '/admin/system'
    }
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Admin Dashboard</h1>
        <p className="mt-2 text-sm text-gray-700">
          System-wide overview and management
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {statCards.map((stat) => (
          <Link
            key={stat.name}
            to={stat.link}
            className="relative overflow-hidden rounded-lg bg-white px-4 py-5 shadow hover:shadow-lg transition-shadow sm:px-6 sm:pt-6"
          >
            <dt>
              <div className={`absolute rounded-md ${stat.color} p-3`}>
                <stat.icon className="h-6 w-6 text-white" aria-hidden="true" />
              </div>
              <p className="ml-16 truncate text-sm font-medium text-gray-500">{stat.name}</p>
            </dt>
            <dd className="ml-16 flex items-baseline">
              <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
            </dd>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            to="/admin/users/new"
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            Create User
          </Link>
          <Link
            to="/products/new"
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            Add Product
          </Link>
          <Link
            to="/servers/new"
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            Add Server
          </Link>
          <Link
            to="/admin/system"
            className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            System Settings
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h2>
        <div className="flow-root">
          <ul className="-mb-8">
            {[
              { user: 'john@example.com', action: 'New signup', time: '2 minutes ago' },
              { user: 'jane@example.com', action: 'Upgraded to Premium', time: '15 minutes ago' },
              { user: 'bob@example.com', action: 'Payment received', time: '1 hour ago' },
              { user: 'alice@example.com', action: 'Created new website', time: '2 hours ago' }
            ].map((activity, idx) => (
              <li key={idx}>
                <div className="relative pb-8">
                  {idx < 3 && (
                    <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                  )}
                  <div className="relative flex space-x-3">
                    <div>
                      <span className="h-8 w-8 rounded-full bg-primary-500 flex items-center justify-center ring-8 ring-white">
                        <UsersIcon className="h-5 w-5 text-white" aria-hidden="true" />
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                      <div>
                        <p className="text-sm text-gray-500">
                          <span className="font-medium text-gray-900">{activity.user}</span> {activity.action}
                        </p>
                      </div>
                      <div className="whitespace-nowrap text-right text-sm text-gray-500">
                        {activity.time}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
