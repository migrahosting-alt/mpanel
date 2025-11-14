import { useState, useEffect } from 'react';
import {
  GlobeAltIcon,
  CheckCircleIcon,
  ClockIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const ClientDomains = () => {
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDomains();
  }, []);

  const fetchDomains = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/client/domains', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setDomains(data.domains || mockDomains);
      } else {
        setDomains(mockDomains);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching domains:', error);
      setDomains(mockDomains);
      setLoading(false);
    }
  };

  const mockDomains = [
    {
      id: 1,
      name: 'example.com',
      registrar: 'MigraHosting',
      registrationDate: '2024-01-15',
      expiryDate: '2026-01-15',
      status: 'active',
      autoRenew: true,
    },
    {
      id: 2,
      name: 'myapp.com',
      registrar: 'MigraHosting',
      registrationDate: '2024-06-20',
      expiryDate: '2025-06-20',
      status: 'active',
      autoRenew: false,
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
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Domains</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage your domain names and DNS settings
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
            <PlusIcon className="h-5 w-5 mr-2" />
            Register Domain
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <ul role="list" className="divide-y divide-gray-200">
          {domains.map((domain) => (
            <li key={domain.id} className="p-6 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center flex-1">
                  <GlobeAltIcon className="h-10 w-10 text-blue-500 mr-4" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-gray-900">{domain.name}</h3>
                      {domain.status === 'active' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircleIcon className="mr-1 h-4 w-4" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <ClockIcon className="mr-1 h-4 w-4" />
                          Pending
                        </span>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Registered</p>
                        <p className="text-gray-900 font-medium">
                          {new Date(domain.registrationDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Expires</p>
                        <p className="text-gray-900 font-medium">
                          {new Date(domain.expiryDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Auto-Renew</p>
                        <p className="text-gray-900 font-medium">
                          {domain.autoRenew ? 'Enabled' : 'Disabled'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex space-x-3">
                      <button className="text-sm text-blue-600 hover:text-blue-500 font-medium">
                        Manage DNS →
                      </button>
                      <button className="text-sm text-blue-600 hover:text-blue-500 font-medium">
                        Settings →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {domains.length === 0 && (
          <div className="text-center py-12">
            <GlobeAltIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No domains</h3>
            <p className="mt-1 text-sm text-gray-500">
              Register your first domain to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientDomains;
