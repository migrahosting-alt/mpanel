import React, { useEffect, useState } from 'react';
import { PaintBrushIcon, EyeIcon } from '@heroicons/react/24/outline';
import api from '../lib/api';

export default function WhiteLabel() {
  const [config, setConfig] = useState({
    company_name: 'MigraHosting',
    primary_color: '#2563eb',
    logo_url: '',
    favicon_url: '',
    support_email: 'support@migrahosting.com'
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await api.get('/branding').catch(() => ({ data: {} }));
      if (response.data.branding) {
        setConfig({ ...config, ...response.data.branding });
      }
    } catch (err) {
      console.error('Failed to load branding:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/branding', config);
      alert('Branding updated successfully!');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update branding');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">White-Label & Reseller Platform</h1>
        <p className="mt-1 text-sm text-gray-500">
          Customize branding for your reseller business
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Form */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Branding Configuration</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Name
              </label>
              <input
                type="text"
                value={config.company_name}
                onChange={(e) => setConfig({ ...config, company_name: e.target.value })}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Primary Color
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={config.primary_color}
                  onChange={(e) => setConfig({ ...config, primary_color: e.target.value })}
                  className="h-10 w-20 border-gray-300 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={config.primary_color}
                  onChange={(e) => setConfig({ ...config, primary_color: e.target.value })}
                  className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Logo URL
              </label>
              <input
                type="url"
                value={config.logo_url}
                onChange={(e) => setConfig({ ...config, logo_url: e.target.value })}
                placeholder="https://example.com/logo.png"
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Favicon URL
              </label>
              <input
                type="url"
                value={config.favicon_url}
                onChange={(e) => setConfig({ ...config, favicon_url: e.target.value })}
                placeholder="https://example.com/favicon.ico"
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Support Email
              </label>
              <input
                type="email"
                value={config.support_email}
                onChange={(e) => setConfig({ ...config, support_email: e.target.value })}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Branding'}
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Preview</h2>
            <EyeIcon className="h-5 w-5 text-gray-400" />
          </div>
          <div className="border border-gray-200 rounded-lg p-6 space-y-4">
            <div className="text-center">
              {config.logo_url ? (
                <img src={config.logo_url} alt="Logo" className="h-16 mx-auto" />
              ) : (
                <div className="h-16 bg-gray-200 rounded flex items-center justify-center">
                  <PaintBrushIcon className="h-8 w-8 text-gray-400" />
                </div>
              )}
            </div>
            <h3 className="text-2xl font-bold text-center" style={{ color: config.primary_color }}>
              {config.company_name}
            </h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>Support: {config.support_email}</p>
              <div className="flex gap-2">
                <div
                  className="h-8 w-full rounded"
                  style={{ backgroundColor: config.primary_color }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Reseller Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border border-gray-200 rounded">
            <h3 className="font-medium text-gray-900 mb-2">Custom Branding</h3>
            <p className="text-sm text-gray-600">Full white-label capabilities with your logo and colors</p>
          </div>
          <div className="p-4 border border-gray-200 rounded">
            <h3 className="font-medium text-gray-900 mb-2">Multi-Tenant</h3>
            <p className="text-sm text-gray-600">Manage multiple client accounts seamlessly</p>
          </div>
          <div className="p-4 border border-gray-200 rounded">
            <h3 className="font-medium text-gray-900 mb-2">Pricing Control</h3>
            <p className="text-sm text-gray-600">Set your own pricing and profit margins</p>
          </div>
        </div>
      </div>
    </div>
  );
}
