import React, { useEffect, useState } from 'react';
import { PuzzlePieceIcon, PlusIcon } from '@heroicons/react/24/outline';
import api from '../lib/api';

export default function APIMarketplace() {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/integrations').catch(() => ({ data: { integrations: [] } }));
      setIntegrations(response.data.integrations || response.data.data || []);
    } catch (err) {
      console.error('Failed to load integrations:', err);
    } finally {
      setLoading(false);
    }
  };

  const availableIntegrations = [
    { name: 'Stripe', description: 'Payment processing', category: 'payments', logo: '💳' },
    { name: 'Mailgun', description: 'Email delivery', category: 'email', logo: '📧' },
    { name: 'Slack', description: 'Team notifications', category: 'communication', logo: '💬' },
    { name: 'GitHub', description: 'Code deployment', category: 'development', logo: '🐙' },
    { name: 'CloudFlare', description: 'CDN & security', category: 'infrastructure', logo: '☁️' },
    { name: 'AWS', description: 'Cloud services', category: 'infrastructure', logo: '🚀' },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">API Marketplace & Integrations</h1>
        <p className="mt-1 text-sm text-gray-500">
          Connect with third-party services and APIs
        </p>
      </div>

      {/* Active Integrations */}
      {integrations.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Integrations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.map((integration) => (
              <div key={integration.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{integration.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">{integration.description}</p>
                  </div>
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                    Active
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Integrations */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Integrations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableIntegrations.map((integration) => (
            <div key={integration.name} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="text-4xl mb-3">{integration.logo}</div>
              <h3 className="font-semibold text-gray-900 mb-2">{integration.name}</h3>
              <p className="text-sm text-gray-600 mb-4">{integration.description}</p>
              <button className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
                <PlusIcon className="h-4 w-4 inline mr-1" />
                Connect
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
