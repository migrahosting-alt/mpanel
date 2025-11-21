import React, { useEffect, useState } from 'react';
import { CubeIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import api from '../lib/api';

export default function AppInstaller() {
  const [apps, setApps] = useState([]);
  const [installations, setInstallations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [appsRes, installsRes] = await Promise.all([
        api.get('/app-installer/apps'),
        api.get('/app-installer/installations')
      ]);
      setApps(appsRes.data.apps || appsRes.data.data || []);
      setInstallations(installsRes.data.installations || installsRes.data.data || []);
    } catch (err) {
      console.error('Failed to load apps:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (app) => {
    if (!window.confirm(`Install ${app.name}?`)) return;
    
    try {
      await api.post('/app-installer/install', {
        app_id: app.id,
        domain: prompt('Enter domain for installation:')
      });
      alert('Installation started!');
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to install app');
    }
  };

  const categories = ['all', 'cms', 'ecommerce', 'forum', 'blog', 'framework'];
  
  const filteredApps = apps.filter(app => {
    const matchesSearch = app.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         app.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || app.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

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
        <h1 className="text-2xl font-bold text-gray-900">App Installer</h1>
        <p className="mt-1 text-sm text-gray-500">
          One-click installation of popular applications
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow space-y-4">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search applications..."
            className="pl-10 w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Installed Apps */}
      {installations.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Installed Applications</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {installations.map((install) => (
              <div key={install.id} className="bg-white p-4 rounded-lg shadow border border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-900">{install.app_name}</h3>
                    <p className="text-xs text-gray-500 mt-1">{install.domain}</p>
                    <span className={`mt-2 inline-flex text-xs px-2 py-1 rounded-full ${
                      install.status === 'active' ? 'bg-green-100 text-green-800' :
                      install.status === 'installing' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {install.status}
                    </span>
                  </div>
                  <CubeIcon className="h-8 w-8 text-blue-500" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Apps */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Available Applications</h2>
        {filteredApps.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-lg shadow">
            <CubeIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No applications found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredApps.map((app) => (
              <div key={app.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">{app.name}</h3>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {app.version || 'Latest'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">{app.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 capitalize">{app.category}</span>
                    <button
                      onClick={() => handleInstall(app)}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
                    >
                      Install
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
