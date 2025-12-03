// frontend/src/pages/AppInstallerPage.tsx
import React, { useState, useEffect } from 'react';
import {
  RocketLaunchIcon,
  TrashIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { apiClient } from '../lib/apiClient';
import toast from 'react-hot-toast';

interface AppTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  requirements: { [key: string]: any };
  icon: string;
}

interface InstalledApp {
  id: number;
  app_type: string;
  app_name: string;
  version: string;
  domain: string;
  status: string;
  error: string;
  installed_at: string;
  created_at: string;
}

export default function AppInstallerPage() {
  const [templates, setTemplates] = useState<AppTemplate[]>([]);
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<AppTemplate | null>(null);
  const [installConfig, setInstallConfig] = useState({
    domain: '',
    db_name: '',
    db_user: '',
    db_password: '',
    app_name: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [templatesRes, appsRes] = await Promise.all([
        apiClient.get('/app-installer/templates'),
        apiClient.get('/app-installer'),
      ]);
      setTemplates(templatesRes.data.templates || []);
      setInstalledApps(appsRes.data.apps || []);
    } catch (error: any) {
      console.error('Failed to fetch app installer data:', error);
      // Don't show error toast for features not yet implemented
      if (error?.response?.status !== 404 && error?.response?.status !== 501) {
        toast.error('Failed to fetch data');
      }
      setTemplates([]);
      setInstalledApps([]);
    } finally {
      setLoading(false);
    }
  };

  const openInstallModal = (template: AppTemplate) => {
    setSelectedTemplate(template);
    setShowInstallModal(true);
    setInstallConfig({
      domain: '',
      db_name: template.id,
      db_user: template.id,
      db_password: generatePassword(),
      app_name: template.name,
    });
  };

  const installApp = async () => {
    if (!selectedTemplate) return;

    try {
      await apiClient.post('/app-installer/install', {
        app_id: selectedTemplate.id,
        domain: installConfig.domain,
        config: installConfig,
      });
      toast.success(`Installing ${selectedTemplate.name}...`);
      setShowInstallModal(false);
      setSelectedTemplate(null);
      setTimeout(fetchData, 2000); // Refresh after 2 seconds
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to install application');
    }
  };

  const uninstallApp = async (appId: number, appName: string) => {
    if (!confirm(`Are you sure you want to uninstall ${appName}? This cannot be undone.`)) {
      return;
    }

    try {
      await apiClient.delete(`/app-installer/${appId}`);
      toast.success('Application uninstalled successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to uninstall application');
    }
  };

  const generatePassword = () => {
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  };

  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: { color: string; icon: any } } = {
      installed: { color: 'bg-green-100 text-green-800', icon: CheckCircleIcon },
      installing: { color: 'bg-blue-100 text-blue-800', icon: ArrowPathIcon },
      failed: { color: 'bg-red-100 text-red-800', icon: XCircleIcon },
      uninstalling: { color: 'bg-yellow-100 text-yellow-800', icon: ClockIcon },
    };

    const badge = badges[status] || badges.installing;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="h-4 w-4 mr-1" />
        {status}
      </span>
    );
  };

  const categories = [
    { id: 'all', name: 'All Apps' },
    { id: 'cms', name: 'CMS' },
    { id: 'framework', name: 'Frameworks' },
    { id: 'lms', name: 'Learning' },
  ];

  const filteredTemplates = selectedCategory === 'all'
    ? templates
    : templates.filter(t => t.category === selectedCategory);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show "Coming Soon" state if no templates available
  if (templates.length === 0 && installedApps.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Application Installer</h1>
          <p className="text-gray-600 mt-1">One-click installation for popular applications</p>
        </div>
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <RocketLaunchIcon className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            App Installer Coming Soon
          </h3>
          <p className="text-slate-600 mb-4 max-w-md mx-auto">
            One-click application installation is not enabled yet in your environment.
          </p>
          <p className="text-sm text-slate-500">
            This module will be available in a future update.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Application Installer</h1>
        <p className="text-gray-600 mt-1">One-click installation for popular applications</p>
      </div>

      {/* Category Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`${
                selectedCategory === category.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              {category.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Available Applications */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <div key={template.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <RocketLaunchIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{template.name}</h3>
                  <p className="text-sm text-gray-500">v{template.version}</p>
                </div>
              </div>
            </div>

            <p className="text-gray-600 mt-4 text-sm">{template.description}</p>

            <div className="mt-4">
              <div className="text-xs text-gray-500 mb-2">Requirements:</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(template.requirements).map(([key, value]) => (
                  <span key={key} className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-xs text-gray-700">
                    {key} {value !== true && `≥ ${value}`}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={() => openInstallModal(template)}
              className="mt-6 w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <RocketLaunchIcon className="h-5 w-5" />
              Install {template.name}
            </button>
          </div>
        ))}
      </div>

      {/* Installed Applications */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Installed Applications</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Application</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Domain</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Version</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Installed</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {installedApps.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <RocketLaunchIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">No applications installed yet</p>
                  </td>
                </tr>
              ) : (
                installedApps.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{app.app_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{app.domain}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{app.version}</td>
                    <td className="px-4 py-3">{getStatusBadge(app.status)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {app.installed_at ? new Date(app.installed_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={() => uninstallApp(app.id, app.app_name)}
                        className="text-red-600 hover:text-red-700"
                        title="Uninstall"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Install Modal */}
      {showInstallModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Install {selectedTemplate.name}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Domain</label>
                <input
                  type="text"
                  value={installConfig.domain}
                  onChange={(e) => setInstallConfig({ ...installConfig, domain: e.target.value })}
                  placeholder="example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {['wordpress', 'laravel', 'drupal', 'moodle'].includes(selectedTemplate.id) && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Database Name</label>
                    <input
                      type="text"
                      value={installConfig.db_name}
                      onChange={(e) => setInstallConfig({ ...installConfig, db_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Database User</label>
                    <input
                      type="text"
                      value={installConfig.db_user}
                      onChange={(e) => setInstallConfig({ ...installConfig, db_user: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Database Password</label>
                    <input
                      type="text"
                      value={installConfig.db_password}
                      onChange={(e) => setInstallConfig({ ...installConfig, db_password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              {['laravel', 'nodejs', 'nextjs', 'django'].includes(selectedTemplate.id) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Application Name</label>
                  <input
                    type="text"
                    value={installConfig.app_name}
                    onChange={(e) => setInstallConfig({ ...installConfig, app_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <strong>Note:</strong> Installation may take several minutes. You'll be notified when complete.
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowInstallModal(false);
                  setSelectedTemplate(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={installApp}
                disabled={!installConfig.domain}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
              >
                Install Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
