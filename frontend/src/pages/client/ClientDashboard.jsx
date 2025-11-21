import { useState, useEffect } from 'react';
import {
  ServerIcon,
  GlobeAltIcon,
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const ClientDashboard = () => {
  const [stats, setStats] = useState({
    activeServices: 0,
    domains: 0,
    unpaidInvoices: 0,
    openTickets: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');

      // Fetch services
      const servicesRes = await fetch('http://localhost:2271/api/client/services', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (servicesRes.ok) {
        const data = await servicesRes.json();
        setServices(data.services || []);
        setStats(prev => ({ ...prev, activeServices: data.services?.length || 0 }));
      }

      // Fetch domains
      const domainsRes = await fetch('http://localhost:2271/api/client/domains', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (domainsRes.ok) {
        const data = await domainsRes.json();
        setStats(prev => ({ ...prev, domains: data.domains?.length || 0 }));
      }

      // Fetch invoices
      const invoicesRes = await fetch('http://localhost:2271/api/client/invoices', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (invoicesRes.ok) {
        const data = await invoicesRes.json();
        const unpaid = data.invoices?.filter(inv => inv.status === 'unpaid').length || 0;
        setStats(prev => ({ ...prev, unpaidInvoices: unpaid }));
      }

      // Fetch support tickets
      const ticketsRes = await fetch('http://localhost:2271/api/client/tickets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (ticketsRes.ok) {
        const data = await ticketsRes.json();
        const open = data.tickets?.filter(t => t.status === 'open').length || 0;
        setStats(prev => ({ ...prev, openTickets: open }));
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  const statCards = [
    {
      name: 'Active Services',
      value: stats.activeServices,
      icon: ServerIcon,
      color: 'bg-blue-500',
      href: '/client/services',
    },
    {
      name: 'Domains',
      value: stats.domains,
      icon: GlobeAltIcon,
      color: 'bg-green-500',
      href: '/client/domains',
    },
    {
      name: 'Unpaid Invoices',
      value: stats.unpaidInvoices,
      icon: DocumentTextIcon,
      color: stats.unpaidInvoices > 0 ? 'bg-red-500' : 'bg-gray-500',
      href: '/client/invoices',
    },
    {
      name: 'Open Tickets',
      value: stats.openTickets,
      icon: ClockIcon,
      color: 'bg-yellow-500',
      href: '/client/support',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome to Your Dashboard</h1>
        <p className="mt-2 text-sm text-gray-700">
          Manage your services, domains, and billing all in one place.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {statCards.map((stat) => (
          <div
            key={stat.name}
            className="relative overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:px-6 sm:py-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => window.location.href = stat.href}
          >
            <div className="flex items-center">
              <div className={`flex-shrink-0 rounded-md ${stat.color} p-3`}>
                <stat.icon className="h-6 w-6 text-white" aria-hidden="true" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="truncate text-sm font-medium text-gray-500">{stat.name}</dt>
                  <dd className="text-3xl font-semibold text-gray-900">{stat.value}</dd>
                </dl>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Active Services */}
      <div className="bg-white shadow rounded-lg mb-8">
        <div className="px-4 py-5 sm:p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Active Services</h2>
          {services.length === 0 ? (
            <div className="text-center py-12">
              <ServerIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No active services</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by ordering a new hosting plan.
              </p>
              <div className="mt-6">
                <button
                  type="button"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Order New Service
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden">
              <ul role="list" className="divide-y divide-gray-200">
                {services.slice(0, 5).map((service) => (
                  <li key={service.id} className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div
                          className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                            service.status === 'active' ? 'bg-green-100' : 'bg-yellow-100'
                          }`}
                        >
                          {service.status === 'active' ? (
                            <CheckCircleIcon className="h-6 w-6 text-green-600" />
                          ) : (
                            <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
                          )}
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-900">{service.name}</p>
                          <p className="text-sm text-gray-500">{service.type}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          ${service.price}/mo
                        </p>
                        <p className="text-xs text-gray-500">
                          Renews {new Date(service.renewDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {services.length > 5 && (
                <div className="mt-4 text-center">
                  <a
                    href="/client/services"
                    className="text-sm font-medium text-blue-600 hover:text-blue-500"
                  >
                    View all services →
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <DocumentTextIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <div className="text-sm font-medium text-gray-900">View Invoices</div>
                <div className="mt-1 text-sm text-gray-500">
                  Check your billing history
                </div>
              </div>
            </div>
            <div className="mt-4">
              <a
                href="/client/invoices"
                className="text-sm font-medium text-blue-600 hover:text-blue-500"
              >
                Go to invoices →
              </a>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <div className="text-sm font-medium text-gray-900">Get Support</div>
                <div className="mt-1 text-sm text-gray-500">
                  Open a support ticket
                </div>
              </div>
            </div>
            <div className="mt-4">
              <a
                href="/client/support"
                className="text-sm font-medium text-blue-600 hover:text-blue-500"
              >
                Contact support →
              </a>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ArrowTrendingUpIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <div className="text-sm font-medium text-gray-900">Upgrade Plan</div>
                <div className="mt-1 text-sm text-gray-500">
                  Scale your resources
                </div>
              </div>
            </div>
            <div className="mt-4">
              <a
                href="/client/services"
                className="text-sm font-medium text-blue-600 hover:text-blue-500"
              >
                View upgrades →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientDashboard;
