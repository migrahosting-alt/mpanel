import { useState, useEffect } from 'react';
import {
  ServerIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const ClientServices = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, active, suspended

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/client/services', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setServices(data.services || mockServices);
      } else {
        setServices(mockServices);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching services:', error);
      setServices(mockServices);
      setLoading(false);
    }
  };

  const mockServices = [
    {
      id: 1,
      name: 'Shared Hosting - Business',
      type: 'Shared Hosting',
      status: 'active',
      price: 19.99,
      renewDate: '2025-12-12',
      domain: 'example.com',
      diskUsage: 45,
      bandwidthUsage: 60,
    },
    {
      id: 2,
      name: 'VPS Server - Premium',
      type: 'VPS',
      status: 'active',
      price: 49.99,
      renewDate: '2025-11-25',
      domain: 'myapp.com',
      diskUsage: 70,
      bandwidthUsage: 35,
    },
  ];

  const filteredServices = services.filter(
    (service) => filter === 'all' || service.status === filter
  );

  const getStatusBadge = (status) => {
    const badges = {
      active: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircleIcon },
      suspended: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: ExclamationTriangleIcon },
      cancelled: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircleIcon },
    };

    const badge = badges[status] || badges.active;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        <Icon className="mr-1 h-4 w-4" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Services</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage your hosting services and resources
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Order New Service
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <div className="sm:hidden">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
          >
            <option value="all">All Services</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
        <div className="hidden sm:block">
          <nav className="flex space-x-4" aria-label="Tabs">
            {['all', 'active', 'suspended'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-2 font-medium text-sm rounded-md ${
                  filter === tab
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Services List */}
      <div className="space-y-4">
        {filteredServices.map((service) => (
          <div key={service.id} className="bg-white shadow rounded-lg overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <ServerIcon className="h-10 w-10 text-blue-500 mr-4" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{service.name}</h3>
                    <p className="text-sm text-gray-500">{service.type}</p>
                  </div>
                </div>
                {getStatusBadge(service.status)}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500">Domain</p>
                  <p className="text-sm font-medium text-gray-900">{service.domain}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Price</p>
                  <p className="text-sm font-medium text-gray-900">${service.price}/mo</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Renews On</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(service.renewDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Actions</p>
                  <button className="text-sm text-blue-600 hover:text-blue-500 font-medium">
                    Manage →
                  </button>
                </div>
              </div>

              {/* Resource Usage */}
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Disk Usage</span>
                    <span>{service.diskUsage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        service.diskUsage > 80 ? 'bg-red-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${service.diskUsage}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Bandwidth Usage</span>
                    <span>{service.bandwidthUsage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        service.bandwidthUsage > 80 ? 'bg-red-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${service.bandwidthUsage}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center space-x-3">
                <button className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50">
                  <Cog6ToothIcon className="h-4 w-4 mr-1" />
                  Settings
                </button>
                <button className="inline-flex items-center px-3 py-1.5 border border-blue-300 shadow-sm text-xs font-medium rounded text-blue-700 bg-blue-50 hover:bg-blue-100">
                  Upgrade
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredServices.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <ServerIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No services found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {filter === 'all'
              ? "You don't have any services yet."
              : `You don't have any ${filter} services.`}
          </p>
        </div>
      )}
    </div>
  );
};

export default ClientServices;
