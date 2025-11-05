import React, { useState } from 'react';
import { PlusIcon, EnvelopeIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

export default function Email() {
  const [mailboxes] = useState([
    { 
      id: 1, 
      email: 'admin@example.com',
      quotaMb: 2048,
      usedMb: 512,
      status: 'active',
      domainName: 'example.com',
      lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000)
    },
    { 
      id: 2, 
      email: 'support@example.com',
      quotaMb: 1024,
      usedMb: 256,
      status: 'active',
      domainName: 'example.com',
      lastLogin: new Date(Date.now() - 24 * 60 * 60 * 1000)
    },
    { 
      id: 3, 
      email: 'sales@shop.example.com',
      quotaMb: 1024,
      usedMb: 128,
      status: 'active',
      domainName: 'shop.example.com',
      lastLogin: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    },
  ]);

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      suspended: 'bg-yellow-100 text-yellow-800',
      deleted: 'bg-red-100 text-red-800',
    };
    return colors[status] || colors.active;
  };

  const getUsagePercentage = (used, total) => {
    return Math.round((used / total) * 100);
  };

  const getUsageColor = (percentage) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Email & Mailboxes</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage email accounts and mailboxes across your domains
          </p>
        </div>
        <button className="btn-primary flex items-center">
          <PlusIcon className="h-5 w-5 mr-2" />
          Create Mailbox
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-primary-100 rounded-lg">
              <EnvelopeIcon className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Mailboxes</p>
              <p className="text-2xl font-bold text-gray-900">{mailboxes.length}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircleIcon className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active</p>
              <p className="text-2xl font-bold text-gray-900">
                {mailboxes.filter(m => m.status === 'active').length}
              </p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <EnvelopeIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Storage Used</p>
              <p className="text-2xl font-bold text-gray-900">
                {(mailboxes.reduce((sum, m) => sum + m.usedMb, 0) / 1024).toFixed(1)} GB
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mailboxes Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Domain
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Storage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Login
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
              {mailboxes.map((mailbox) => {
                const usagePercentage = getUsagePercentage(mailbox.usedMb, mailbox.quotaMb);
                return (
                  <tr key={mailbox.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <EnvelopeIcon className="h-5 w-5 text-gray-400 mr-3" />
                        <div className="text-sm font-medium text-gray-900">{mailbox.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {mailbox.domainName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="w-32">
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                          <span>{mailbox.usedMb} MB</span>
                          <span>{mailbox.quotaMb} MB</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${getUsageColor(usagePercentage)}`}
                            style={{ width: `${usagePercentage}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{usagePercentage}% used</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {mailbox.lastLogin ? new Date(mailbox.lastLogin).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(mailbox.status)}`}>
                        {mailbox.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-primary-600 hover:text-primary-900 mr-4">Manage</button>
                      <button className="text-primary-600 hover:text-primary-900">Change Password</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
