import React, { useState } from 'react';
import { PlusIcon, ServerIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';

export default function Servers() {
  const [servers] = useState([
    { 
      id: 1, 
      name: 'Web Server 01', 
      hostname: 'web01.mpanel.com',
      ipAddress: '192.168.1.100',
      location: 'US-East',
      provider: 'Contabo',
      os: 'Ubuntu 22.04',
      role: 'web',
      status: 'active',
      cpuCores: 8,
      ramMb: 16384,
      diskGb: 500,
      agentLastSeen: new Date()
    },
    { 
      id: 2, 
      name: 'Database Server', 
      hostname: 'db01.mpanel.com',
      ipAddress: '192.168.1.101',
      location: 'US-East',
      provider: 'Contabo',
      os: 'Ubuntu 22.04',
      role: 'database',
      status: 'active',
      cpuCores: 16,
      ramMb: 32768,
      diskGb: 1000,
      agentLastSeen: new Date()
    },
  ]);

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      maintenance: 'bg-yellow-100 text-yellow-800',
      offline: 'bg-red-100 text-red-800',
    };
    return colors[status] || colors.active;
  };

  const getStatusIcon = (status) => {
    return status === 'active' ? (
      <CheckCircleIcon className="h-5 w-5 text-green-600" />
    ) : (
      <ExclamationCircleIcon className="h-5 w-5 text-red-600" />
    );
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Servers</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage your infrastructure servers and nodes
          </p>
        </div>
        <button className="btn-primary flex items-center">
          <PlusIcon className="h-5 w-5 mr-2" />
          Add Server
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {servers.map((server) => (
          <div key={server.id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="p-3 bg-primary-100 rounded-lg">
                  <ServerIcon className="h-8 w-8 text-primary-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900">{server.name}</h3>
                  <p className="text-sm text-gray-500">{server.hostname}</p>
                </div>
              </div>
              {getStatusIcon(server.status)}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">IP Address</p>
                <p className="text-sm font-medium text-gray-900">{server.ipAddress}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Location</p>
                <p className="text-sm font-medium text-gray-900">{server.location}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Provider</p>
                <p className="text-sm font-medium text-gray-900">{server.provider}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">OS</p>
                <p className="text-sm font-medium text-gray-900">{server.os}</p>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 mt-4">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-4">
                  <span className="text-gray-600">
                    <span className="font-medium">{server.cpuCores}</span> CPU
                  </span>
                  <span className="text-gray-600">
                    <span className="font-medium">{server.ramMb / 1024}GB</span> RAM
                  </span>
                  <span className="text-gray-600">
                    <span className="font-medium">{server.diskGb}GB</span> Disk
                  </span>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(server.status)}`}>
                  {server.status}
                </span>
              </div>
            </div>

            <div className="mt-4 flex space-x-2">
              <button className="flex-1 text-sm text-primary-600 hover:text-primary-900 font-medium">
                View Metrics
              </button>
              <button className="flex-1 text-sm text-primary-600 hover:text-primary-900 font-medium">
                Manage
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
