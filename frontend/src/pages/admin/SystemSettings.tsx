// Enterprise System Settings Module
import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../lib/apiClient';
import {
  Cog6ToothIcon,
  GlobeAltIcon,
  EnvelopeIcon,
  BellIcon,
  ShieldCheckIcon,
  CurrencyDollarIcon,
  CloudIcon,
  ServerStackIcon,
  KeyIcon,
  PaintBrushIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

interface SystemSettings {
  general: {
    siteName: string;
    siteUrl: string;
    adminEmail: string;
    timezone: string;
    dateFormat: string;
    currency: string;
  };
  email: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpSecure: boolean;
    fromName: string;
    fromEmail: string;
  };
  billing: {
    stripeEnabled: boolean;
    paypalEnabled: boolean;
    taxRate: number;
    invoicePrefix: string;
    gracePeriodDays: number;
  };
  provisioning: {
    autoProvision: boolean;
    defaultCpuCores: number;
    defaultMemoryMb: number;
    defaultDiskGb: number;
    maxPodsPerCustomer: number;
  };
  security: {
    twoFactorRequired: boolean;
    sessionTimeoutMinutes: number;
    maxLoginAttempts: number;
    ipWhitelist: string[];
  };
  notifications: {
    emailOnNewCustomer: boolean;
    emailOnNewOrder: boolean;
    emailOnServerAlert: boolean;
    slackWebhook: string;
  };
}

const TABS = [
  { key: 'general', label: 'General', icon: Cog6ToothIcon },
  { key: 'email', label: 'Email', icon: EnvelopeIcon },
  { key: 'billing', label: 'Billing', icon: CurrencyDollarIcon },
  { key: 'provisioning', label: 'Provisioning', icon: CloudIcon },
  { key: 'security', label: 'Security', icon: ShieldCheckIcon },
  { key: 'notifications', label: 'Notifications', icon: BellIcon },
  { key: 'branding', label: 'Branding', icon: PaintBrushIcon },
  { key: 'api', label: 'API Keys', icon: KeyIcon },
];

const defaultSettings: SystemSettings = {
  general: {
    siteName: 'MigraHosting',
    siteUrl: 'https://migrapanel.com',
    adminEmail: 'admin@migrahosting.com',
    timezone: 'America/New_York',
    dateFormat: 'MM/DD/YYYY',
    currency: 'USD',
  },
  email: {
    smtpHost: 'smtp.mailgun.org',
    smtpPort: 587,
    smtpUser: '',
    smtpSecure: true,
    fromName: 'MigraHosting',
    fromEmail: 'noreply@migrahosting.com',
  },
  billing: {
    stripeEnabled: true,
    paypalEnabled: false,
    taxRate: 0,
    invoicePrefix: 'INV-',
    gracePeriodDays: 7,
  },
  provisioning: {
    autoProvision: true,
    defaultCpuCores: 1,
    defaultMemoryMb: 512,
    defaultDiskGb: 10,
    maxPodsPerCustomer: 10,
  },
  security: {
    twoFactorRequired: false,
    sessionTimeoutMinutes: 60,
    maxLoginAttempts: 5,
    ipWhitelist: [],
  },
  notifications: {
    emailOnNewCustomer: true,
    emailOnNewOrder: true,
    emailOnServerAlert: true,
    slackWebhook: '',
  },
};

export default function SystemSettings() {
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      // Try to load from localStorage first (fallback)
      const savedSettings = localStorage.getItem('mpanel_system_settings');
      if (savedSettings) {
        setSettings({ ...defaultSettings, ...JSON.parse(savedSettings) });
      }
      
      // Try API
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSettings({ ...defaultSettings, ...data.settings });
      }
    } catch (err) {
      console.log('Using local settings (API unavailable)');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ settings }),
      });
      if (!response.ok) throw new Error('API unavailable');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      // Fallback: save to localStorage
      localStorage.setItem('mpanel_system_settings', JSON.stringify(settings));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      console.log('Settings saved to localStorage (API unavailable)');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (section: keyof SystemSettings, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
            <p className="mt-1 text-sm text-gray-500">
              Configure global platform settings and preferences
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {saved && (
              <span className="inline-flex items-center text-sm text-green-600">
                <CheckCircleIcon className="h-5 w-5 mr-1" />
                Settings saved
              </span>
            )}
            {error && (
              <span className="inline-flex items-center text-sm text-red-600">
                <ExclamationTriangleIcon className="h-5 w-5 mr-1" />
                {error}
              </span>
            )}
            <button
              onClick={saveSettings}
              disabled={saving}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <nav className="space-y-1">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab.key
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="h-5 w-5 mr-3" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <>
              {/* General Settings */}
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900">General Settings</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Site Name</label>
                      <input
                        type="text"
                        value={settings.general.siteName}
                        onChange={e => updateSetting('general', 'siteName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Site URL</label>
                      <input
                        type="url"
                        value={settings.general.siteUrl}
                        onChange={e => updateSetting('general', 'siteUrl', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
                      <input
                        type="email"
                        value={settings.general.adminEmail}
                        onChange={e => updateSetting('general', 'adminEmail', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                      <select
                        value={settings.general.timezone}
                        onChange={e => updateSetting('general', 'timezone', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="America/New_York">Eastern Time</option>
                        <option value="America/Chicago">Central Time</option>
                        <option value="America/Denver">Mountain Time</option>
                        <option value="America/Los_Angeles">Pacific Time</option>
                        <option value="UTC">UTC</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date Format</label>
                      <select
                        value={settings.general.dateFormat}
                        onChange={e => updateSetting('general', 'dateFormat', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                      <select
                        value={settings.general.currency}
                        onChange={e => updateSetting('general', 'currency', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Email Settings */}
              {activeTab === 'email' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900">Email Configuration</h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center">
                      <InformationCircleIcon className="h-5 w-5 text-blue-500 mr-2" />
                      <span className="text-sm text-blue-700">Configure SMTP settings for transactional emails</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
                      <input
                        type="text"
                        value={settings.email.smtpHost}
                        onChange={e => updateSetting('email', 'smtpHost', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Port</label>
                      <input
                        type="number"
                        value={settings.email.smtpPort}
                        onChange={e => updateSetting('email', 'smtpPort', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Username</label>
                      <input
                        type="text"
                        value={settings.email.smtpUser}
                        onChange={e => updateSetting('email', 'smtpUser', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Use TLS</label>
                      <label className="flex items-center mt-2">
                        <input
                          type="checkbox"
                          checked={settings.email.smtpSecure}
                          onChange={e => updateSetting('email', 'smtpSecure', e.target.checked)}
                          className="h-4 w-4 text-indigo-600 rounded border-gray-300"
                        />
                        <span className="ml-2 text-sm text-gray-600">Enable TLS/SSL encryption</span>
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">From Name</label>
                      <input
                        type="text"
                        value={settings.email.fromName}
                        onChange={e => updateSetting('email', 'fromName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
                      <input
                        type="email"
                        value={settings.email.fromEmail}
                        onChange={e => updateSetting('email', 'fromEmail', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                    <EnvelopeIcon className="h-4 w-4 mr-2" />
                    Send Test Email
                  </button>
                </div>
              )}

              {/* Billing Settings */}
              {activeTab === 'billing' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900">Billing & Payments</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center">
                        <div className="p-2 bg-indigo-100 rounded-lg mr-3">
                          <CurrencyDollarIcon className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">Stripe</h4>
                          <p className="text-sm text-gray-500">Accept credit card payments</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.billing.stripeEnabled}
                          onChange={e => updateSetting('billing', 'stripeEnabled', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center">
                        <div className="p-2 bg-blue-100 rounded-lg mr-3">
                          <GlobeAltIcon className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">PayPal</h4>
                          <p className="text-sm text-gray-500">Accept PayPal payments</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.billing.paypalEnabled}
                          onChange={e => updateSetting('billing', 'paypalEnabled', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6 pt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
                      <input
                        type="number"
                        value={settings.billing.taxRate}
                        onChange={e => updateSetting('billing', 'taxRate', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        step="0.01"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Prefix</label>
                      <input
                        type="text"
                        value={settings.billing.invoicePrefix}
                        onChange={e => updateSetting('billing', 'invoicePrefix', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Grace Period (days)</label>
                      <input
                        type="number"
                        value={settings.billing.gracePeriodDays}
                        onChange={e => updateSetting('billing', 'gracePeriodDays', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Provisioning Settings */}
              {activeTab === 'provisioning' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900">Provisioning Configuration</h3>
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">Auto-Provision CloudPods</h4>
                      <p className="text-sm text-gray-500">Automatically create CloudPods when subscriptions are activated</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.provisioning.autoProvision}
                        onChange={e => updateSetting('provisioning', 'autoProvision', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-6 pt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Default CPU Cores</label>
                      <select
                        value={settings.provisioning.defaultCpuCores}
                        onChange={e => updateSetting('provisioning', 'defaultCpuCores', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      >
                        {[1, 2, 4, 8].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Default Memory (MB)</label>
                      <select
                        value={settings.provisioning.defaultMemoryMb}
                        onChange={e => updateSetting('provisioning', 'defaultMemoryMb', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      >
                        {[256, 512, 1024, 2048, 4096].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Default Disk (GB)</label>
                      <select
                        value={settings.provisioning.defaultDiskGb}
                        onChange={e => updateSetting('provisioning', 'defaultDiskGb', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      >
                        {[5, 10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Pods Per Customer</label>
                      <input
                        type="number"
                        value={settings.provisioning.maxPodsPerCustomer}
                        onChange={e => updateSetting('provisioning', 'maxPodsPerCustomer', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        min="1"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Security Settings */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900">Security Settings</h3>
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">Require Two-Factor Authentication</h4>
                      <p className="text-sm text-gray-500">Force all admin users to enable 2FA</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.security.twoFactorRequired}
                        onChange={e => updateSetting('security', 'twoFactorRequired', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-6 pt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Session Timeout (minutes)</label>
                      <input
                        type="number"
                        value={settings.security.sessionTimeoutMinutes}
                        onChange={e => updateSetting('security', 'sessionTimeoutMinutes', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        min="5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Login Attempts</label>
                      <input
                        type="number"
                        value={settings.security.maxLoginAttempts}
                        onChange={e => updateSetting('security', 'maxLoginAttempts', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        min="1"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Notifications Settings */}
              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900">Notification Preferences</h3>
                  <div className="space-y-4">
                    {[
                      { key: 'emailOnNewCustomer', label: 'New Customer Signup', desc: 'Get notified when a new customer registers' },
                      { key: 'emailOnNewOrder', label: 'New Order', desc: 'Get notified when a new order is placed' },
                      { key: 'emailOnServerAlert', label: 'Server Alerts', desc: 'Get notified on server health issues' },
                    ].map(item => (
                      <div key={item.key} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div>
                          <h4 className="font-medium text-gray-900">{item.label}</h4>
                          <p className="text-sm text-gray-500">{item.desc}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.notifications[item.key as keyof typeof settings.notifications] as boolean}
                            onChange={e => updateSetting('notifications', item.key, e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                  <div className="pt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Slack Webhook URL</label>
                    <input
                      type="url"
                      value={settings.notifications.slackWebhook}
                      onChange={e => updateSetting('notifications', 'slackWebhook', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="https://hooks.slack.com/services/..."
                    />
                  </div>
                </div>
              )}

              {/* Branding */}
              {activeTab === 'branding' && (
                <BrandingSettings />
              )}

              {/* API Keys */}
              {activeTab === 'api' && (
                <APIKeysSettings />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Branding Settings Component
function BrandingSettings() {
  const [branding, setBranding] = useState({
    primaryColor: '#6366f1',
    secondaryColor: '#8b5cf6',
    accentColor: '#10b981',
    logoUrl: '',
    faviconUrl: '',
    companyName: 'MigraHosting',
    supportEmail: 'support@migrahosting.com',
    supportPhone: '',
    footerText: '© 2024 MigraHosting. All rights reserved.',
    customCss: '',
    hideFooterBranding: false,
  });

  useEffect(() => {
    const saved = localStorage.getItem('mpanel_branding');
    if (saved) setBranding(JSON.parse(saved));
  }, []);

  const saveBranding = () => {
    localStorage.setItem('mpanel_branding', JSON.stringify(branding));
    alert('Branding settings saved!');
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Branding & White Label</h3>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center">
          <InformationCircleIcon className="h-5 w-5 text-blue-500 mr-2" />
          <span className="text-sm text-blue-700">Customize the look and feel of your hosting panel</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
          <input
            type="text"
            value={branding.companyName}
            onChange={e => setBranding({ ...branding, companyName: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Support Email</label>
          <input
            type="email"
            value={branding.supportEmail}
            onChange={e => setBranding({ ...branding, supportEmail: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Support Phone</label>
          <input
            type="tel"
            value={branding.supportPhone}
            onChange={e => setBranding({ ...branding, supportPhone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            placeholder="+1 (555) 123-4567"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
          <input
            type="url"
            value={branding.logoUrl}
            onChange={e => setBranding({ ...branding, logoUrl: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            placeholder="https://..."
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={branding.primaryColor}
              onChange={e => setBranding({ ...branding, primaryColor: e.target.value })}
              className="h-10 w-16 rounded cursor-pointer"
            />
            <input
              type="text"
              value={branding.primaryColor}
              onChange={e => setBranding({ ...branding, primaryColor: e.target.value })}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={branding.secondaryColor}
              onChange={e => setBranding({ ...branding, secondaryColor: e.target.value })}
              className="h-10 w-16 rounded cursor-pointer"
            />
            <input
              type="text"
              value={branding.secondaryColor}
              onChange={e => setBranding({ ...branding, secondaryColor: e.target.value })}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Accent Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={branding.accentColor}
              onChange={e => setBranding({ ...branding, accentColor: e.target.value })}
              className="h-10 w-16 rounded cursor-pointer"
            />
            <input
              type="text"
              value={branding.accentColor}
              onChange={e => setBranding({ ...branding, accentColor: e.target.value })}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Footer Text</label>
        <input
          type="text"
          value={branding.footerText}
          onChange={e => setBranding({ ...branding, footerText: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Custom CSS</label>
        <textarea
          value={branding.customCss}
          onChange={e => setBranding({ ...branding, customCss: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
          rows={4}
          placeholder="/* Add custom styles here */"
        />
      </div>

      <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
        <div>
          <h4 className="font-medium text-gray-900">Hide Footer Branding</h4>
          <p className="text-sm text-gray-500">Remove "Powered by MigraPanel" from footer</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={branding.hideFooterBranding}
            onChange={e => setBranding({ ...branding, hideFooterBranding: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
        </label>
      </div>

      <div className="flex justify-end">
        <button
          onClick={saveBranding}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          <CheckCircleIcon className="h-4 w-4 mr-2" />
          Save Branding
        </button>
      </div>
    </div>
  );
}

// API Keys Settings Component
function APIKeysSettings() {
  const [apiKeys, setApiKeys] = useState<Array<{
    id: string;
    name: string;
    key: string;
    scopes: string[];
    lastUsed: string | null;
    createdAt: string;
    expiresAt: string | null;
  }>>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['read']);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('mpanel_api_keys');
    if (saved) setApiKeys(JSON.parse(saved));
  }, []);

  const saveKeys = (keys: typeof apiKeys) => {
    localStorage.setItem('mpanel_api_keys', JSON.stringify(keys));
    setApiKeys(keys);
  };

  const generateKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = 'mk_live_';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  };

  const createKey = () => {
    if (!newKeyName) return;
    const key = generateKey();
    const newKey = {
      id: `key_${Date.now()}`,
      name: newKeyName,
      key: key,
      scopes: newKeyScopes,
      lastUsed: null,
      createdAt: new Date().toISOString(),
      expiresAt: null,
    };
    saveKeys([...apiKeys, newKey]);
    setGeneratedKey(key);
    setNewKeyName('');
    setNewKeyScopes(['read']);
  };

  const deleteKey = (id: string) => {
    if (!confirm('Are you sure? This cannot be undone.')) return;
    saveKeys(apiKeys.filter(k => k.id !== id));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const availableScopes = [
    { value: 'read', label: 'Read', desc: 'Read access to all resources' },
    { value: 'write', label: 'Write', desc: 'Create and update resources' },
    { value: 'delete', label: 'Delete', desc: 'Delete resources' },
    { value: 'admin', label: 'Admin', desc: 'Full administrative access' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">API Configuration</h3>
        <button
          onClick={() => { setShowCreateModal(true); setGeneratedKey(null); }}
          className="inline-flex items-center px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          <KeyIcon className="h-4 w-4 mr-2" />
          Generate New Key
        </button>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center">
          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 mr-2" />
          <span className="text-sm text-yellow-700">Keep API keys secure. Never share them publicly or commit to version control.</span>
        </div>
      </div>

      {apiKeys.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <KeyIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No API keys created yet</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Create your first API key
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {apiKeys.map(apiKey => (
            <div key={apiKey.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">{apiKey.name}</h4>
                <p className="text-sm text-gray-500 font-mono">{apiKey.key.substring(0, 12)}...{apiKey.key.substring(apiKey.key.length - 4)}</p>
                <div className="flex items-center gap-2 mt-2">
                  {apiKey.scopes.map(scope => (
                    <span key={scope} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">{scope}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(apiKey.key)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  Copy
                </button>
                <button
                  onClick={() => deleteKey(apiKey.id)}
                  className="px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50"
                >
                  Revoke
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowCreateModal(false)}></div>
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {generatedKey ? 'API Key Created' : 'Generate API Key'}
              </h2>
              
              {generatedKey ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-700 mb-2">Your API key has been generated. Copy it now - you won't be able to see it again!</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white px-3 py-2 rounded border text-sm break-all">{generatedKey}</code>
                      <button
                        onClick={() => copyToClipboard(generatedKey)}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Key Name *</label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={e => setNewKeyName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g., Production API Key"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Scopes</label>
                    <div className="space-y-2">
                      {availableScopes.map(scope => (
                        <label key={scope.value} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={newKeyScopes.includes(scope.value)}
                            onChange={e => {
                              if (e.target.checked) {
                                setNewKeyScopes([...newKeyScopes, scope.value]);
                              } else {
                                setNewKeyScopes(newKeyScopes.filter(s => s !== scope.value));
                              }
                            }}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{scope.label}</span>
                          <span className="ml-2 text-xs text-gray-500">- {scope.desc}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createKey}
                      disabled={!newKeyName}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      Generate Key
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
