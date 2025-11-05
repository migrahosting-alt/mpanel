import React, { useState } from 'react';
import { PlusIcon, GlobeAltIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

export default function Websites() {
  const [websites] = useState([
    { 
      id: 1, 
      name: 'Corporate Website', 
      primaryDomain: 'example.com',
      appType: 'wordpress',
      phpVersion: '8.2',
      sslEnabled: true,
      sslProvider: 'letsencrypt',
      status: 'active',
      serverName: 'Web Server 01',
      lastDeployed: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    },
    { 
      id: 2, 
      name: 'E-commerce Store', 
      primaryDomain: 'shop.example.com',
      appType: 'php',
      phpVersion: '8.1',
      sslEnabled: true,
      sslProvider: 'letsencrypt',
      status: 'active',
      serverName: 'Web Server 01',
      lastDeployed: new Date(Date.now() - 5 * 60 * 60 * 1000)
    },
  ]);

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      deploying: 'bg-blue-100 text-blue-800',
      suspended: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800',
    };
    return colors[status] || colors.active;
  };

  const getAppTypeLabel = (appType) => {
    const labels = {
      wordpress: 'WordPress',
      php: 'PHP',
      node: 'Node.js',
      python: 'Python',
      static: 'Static',
      laravel: 'Laravel'
    };
    return labels[appType] || appType;
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Websites & Applications</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage your hosted websites and applications
          </p>
        </div>
        <button className="btn-primary flex items-center">
          <PlusIcon className="h-5 w-5 mr-2" />
          Create Website
        </button>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Website
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Domain
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Server
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SSL
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {websites.map((website) => (
                <tr key={website.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <GlobeAltIcon className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{website.name}</div>
                        <div className="text-xs text-gray-500">
                          {website.appType === 'php' || website.appType === 'wordpress' ? `PHP ${website.phpVersion}` : getAppTypeLabel(website.appType)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{website.primaryDomain}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {getAppTypeLabel(website.appType)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {website.serverName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {website.sslEnabled ? (
                      <div className="flex items-center text-green-600">
                        <ShieldCheckIcon className="h-5 w-5 mr-1" />
                        <span className="text-xs">Active</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">No SSL</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(website.status)}`}>
                      {website.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-primary-600 hover:text-primary-900 mr-4">Manage</button>
                    <button className="text-primary-600 hover:text-primary-900">Deploy</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
