import React, { useState } from 'react';
import { PlusIcon, CircleStackIcon } from '@heroicons/react/24/outline';

export default function Databases() {
  const [databases] = useState([
    { 
      id: 1, 
      name: 'wp_corporate',
      dbType: 'mysql',
      dbUser: 'wp_user',
      sizeMb: 128,
      serverName: 'Database Server',
      websiteName: 'Corporate Website',
      status: 'active',
      connectionString: 'mysql://wp_user:***@localhost:3306/wp_corporate'
    },
    { 
      id: 2, 
      name: 'shop_db',
      dbType: 'postgresql',
      dbUser: 'shop_user',
      sizeMb: 256,
      serverName: 'Database Server',
      websiteName: 'E-commerce Store',
      status: 'active',
      connectionString: 'postgresql://shop_user:***@localhost:5432/shop_db'
    },
    { 
      id: 3, 
      name: 'analytics_db',
      dbType: 'postgresql',
      dbUser: 'analytics',
      sizeMb: 512,
      serverName: 'Database Server',
      websiteName: null,
      status: 'active',
      connectionString: 'postgresql://analytics:***@localhost:5432/analytics_db'
    },
  ]);

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      suspended: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800',
    };
    return colors[status] || colors.active;
  };

  const getDbTypeLabel = (dbType) => {
    const labels = {
      postgresql: 'PostgreSQL',
      mysql: 'MySQL',
      mariadb: 'MariaDB'
    };
    return labels[dbType] || dbType.toUpperCase();
  };

  const getDbTypeColor = (dbType) => {
    const colors = {
      postgresql: 'bg-blue-100 text-blue-800',
      mysql: 'bg-orange-100 text-orange-800',
      mariadb: 'bg-purple-100 text-purple-800'
    };
    return colors[dbType] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Databases</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage PostgreSQL and MySQL databases
          </p>
        </div>
        <button className="btn-primary flex items-center">
          <PlusIcon className="h-5 w-5 mr-2" />
          Create Database
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-primary-100 rounded-lg">
              <CircleStackIcon className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Databases</p>
              <p className="text-2xl font-bold text-gray-900">{databases.length}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <CircleStackIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">PostgreSQL</p>
              <p className="text-2xl font-bold text-gray-900">
                {databases.filter(d => d.dbType === 'postgresql').length}
              </p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-orange-100 rounded-lg">
              <CircleStackIcon className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">MySQL</p>
              <p className="text-2xl font-bold text-gray-900">
                {databases.filter(d => d.dbType === 'mysql').length}
              </p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <CircleStackIcon className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Size</p>
              <p className="text-2xl font-bold text-gray-900">
                {(databases.reduce((sum, d) => sum + d.sizeMb, 0) / 1024).toFixed(1)} GB
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Databases Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Database Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Server
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Website
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Size
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
              {databases.map((database) => (
                <tr key={database.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <CircleStackIcon className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{database.name}</div>
                        <div className="text-xs text-gray-500 font-mono">{database.dbUser}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDbTypeColor(database.dbType)}`}>
                      {getDbTypeLabel(database.dbType)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {database.dbUser}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {database.serverName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {database.websiteName || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {database.sizeMb} MB
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(database.status)}`}>
                      {database.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-primary-600 hover:text-primary-900 mr-4">Manage</button>
                    <button className="text-primary-600 hover:text-primary-900">Connection</button>
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
