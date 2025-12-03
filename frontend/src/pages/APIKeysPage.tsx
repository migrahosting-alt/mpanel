// frontend/src/pages/APIKeysPage.tsx
import React, { useState, useEffect } from 'react';
import {
  KeyIcon,
  TrashIcon,
  PlusIcon,
  ClipboardDocumentIcon,
  LinkIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { apiClient } from '../lib/apiClient';
import toast from 'react-hot-toast';

interface APIKey {
  id: number;
  name: string;
  key_prefix: string;
  permissions: string[];
  last_used: string;
  expires_at: string;
  created_at: string;
}

interface Webhook {
  id: number;
  url: string;
  events: string[];
  enabled: boolean;
  created_at: string;
}

interface WebhookDelivery {
  id: number;
  event: string;
  status_code: number;
  success: boolean;
  created_at: string;
}

export default function APIKeysPage() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [showNewWebhookModal, setShowNewWebhookModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [newKey, setNewKey] = useState({
    name: '',
    permissions: ['read'],
    expires_at: '',
  });
  const [newWebhook, setNewWebhook] = useState({
    url: '',
    events: [] as string[],
  });

  const availableEvents = [
    'server.created',
    'server.updated',
    'server.deleted',
    'domain.created',
    'domain.updated',
    'domain.deleted',
    'backup.created',
    'backup.completed',
    'alert.triggered',
    'app.installed',
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [keysRes, webhooksRes] = await Promise.all([
        apiClient.get('/api-keys/keys'),
        apiClient.get('/api-keys/webhooks'),
      ]);
      setApiKeys(keysRes.data.keys || []);
      setWebhooks(webhooksRes.data.webhooks || []);
    } catch (error: any) {
      console.error('Failed to fetch API keys and webhooks:', error);
      // Don't show error toast for features not yet implemented
      if (error?.response?.status !== 404 && error?.response?.status !== 501) {
        toast.error('Failed to fetch API keys and webhooks');
      }
      setApiKeys([]);
      setWebhooks([]);
    } finally {
      setLoading(false);
    }
  };

  const createApiKey = async () => {
    try {
      const response = await apiClient.post('/api-keys/keys', newKey);
      setNewApiKey(response.data.api_key);
      setShowNewKeyModal(false);
      setShowKeyModal(true);
      setNewKey({
        name: '',
        permissions: ['read'],
        expires_at: '',
      });
      fetchData();
    } catch (error) {
      toast.error('Failed to create API key');
    }
  };

  const revokeApiKey = async (keyId: number, keyName: string) => {
    if (!confirm(`Are you sure you want to revoke the API key "${keyName}"?`)) {
      return;
    }

    try {
      await apiClient.delete(`/api-keys/keys/${keyId}`);
      toast.success('API key revoked successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to revoke API key');
    }
  };

  const createWebhook = async () => {
    try {
      await apiClient.post('/api-keys/webhooks', newWebhook);
      toast.success('Webhook created successfully');
      setShowNewWebhookModal(false);
      setNewWebhook({
        url: '',
        events: [],
      });
      fetchData();
    } catch (error) {
      toast.error('Failed to create webhook');
    }
  };

  const toggleWebhook = async (webhookId: number, enabled: boolean) => {
    try {
      await apiClient.put(`/api-keys/webhooks/${webhookId}`, { enabled: !enabled });
      toast.success(`Webhook ${!enabled ? 'enabled' : 'disabled'}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update webhook');
    }
  };

  const deleteWebhook = async (webhookId: number) => {
    if (!confirm('Are you sure you want to delete this webhook?')) {
      return;
    }

    try {
      await apiClient.delete(`/api-keys/webhooks/${webhookId}`);
      toast.success('Webhook deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete webhook');
    }
  };

  const viewDeliveries = async (webhook: Webhook) => {
    try {
      const response = await apiClient.get(`/api-keys/webhooks/${webhook.id}/deliveries`);
      setDeliveries(response.data.deliveries);
      setSelectedWebhook(webhook);
    } catch (error) {
      toast.error('Failed to fetch webhook deliveries');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const toggleEvent = (event: string) => {
    const events = newWebhook.events.includes(event)
      ? newWebhook.events.filter(e => e !== event)
      : [...newWebhook.events, event];
    setNewWebhook({ ...newWebhook, events });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show "Coming Soon" state if no data available
  if (apiKeys.length === 0 && webhooks.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Keys & Webhooks</h1>
          <p className="text-gray-600 mt-1">Manage API access and webhook integrations</p>
        </div>
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <KeyIcon className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            API Keys Coming Soon
          </h3>
          <p className="text-slate-600 mb-4 max-w-md mx-auto">
            API key and webhook management is not enabled yet in your environment.
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
        <h1 className="text-2xl font-bold text-gray-900">API Keys & Webhooks</h1>
        <p className="text-gray-600 mt-1">Manage API access and webhook integrations</p>
      </div>

      {/* API Keys Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="font-semibold text-gray-900">API Keys</h2>
          <button
            onClick={() => setShowNewKeyModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
          >
            <PlusIcon className="h-4 w-4" />
            New API Key
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Key</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Permissions</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Used</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {apiKeys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <KeyIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 mb-3">No API keys yet</p>
                    <button
                      onClick={() => setShowNewKeyModal(true)}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      Create your first API key
                    </button>
                  </td>
                </tr>
              ) : (
                apiKeys.map((key) => (
                  <tr key={key.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{key.name}</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-500">{key.key_prefix}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {key.permissions.map((perm: string) => (
                          <span key={perm} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            {perm}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {key.last_used ? new Date(key.last_used).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(key.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={() => revokeApiKey(key.id, key.name)}
                        className="text-red-600 hover:text-red-700"
                        title="Revoke"
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

      {/* Webhooks Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="font-semibold text-gray-900">Webhooks</h2>
          <button
            onClick={() => setShowNewWebhookModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
          >
            <PlusIcon className="h-4 w-4" />
            New Webhook
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Events</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {webhooks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center">
                    <LinkIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 mb-3">No webhooks configured</p>
                    <button
                      onClick={() => setShowNewWebhookModal(true)}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      Create your first webhook
                    </button>
                  </td>
                </tr>
              ) : (
                webhooks.map((webhook) => (
                  <tr key={webhook.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">{webhook.url}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {webhook.events.map((event: string) => (
                          <span key={event} className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                            {event}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => toggleWebhook(webhook.id, webhook.enabled)}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          webhook.enabled
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {webhook.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm space-x-2">
                      <button
                        onClick={() => viewDeliveries(webhook)}
                        className="text-blue-600 hover:text-blue-700"
                        title="View deliveries"
                      >
                        View
                      </button>
                      <button
                        onClick={() => deleteWebhook(webhook.id)}
                        className="text-red-600 hover:text-red-700"
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New API Key Modal */}
      {showNewKeyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create API Key</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={newKey.name}
                  onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
                  placeholder="Production API Key"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                <div className="space-y-2">
                  {['read', 'write', 'admin'].map((perm) => (
                    <label key={perm} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={newKey.permissions.includes(perm)}
                        onChange={(e) => {
                          const permissions = e.target.checked
                            ? [...newKey.permissions, perm]
                            : newKey.permissions.filter(p => p !== perm);
                          setNewKey({ ...newKey, permissions });
                        }}
                        className="mr-2"
                      />
                      <span className="capitalize">{perm}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Expires At (optional)</label>
                <input
                  type="date"
                  value={newKey.expires_at}
                  onChange={(e) => setNewKey({ ...newKey, expires_at: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowNewKeyModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createApiKey}
                disabled={!newKey.name || newKey.permissions.length === 0}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
              >
                Create Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Show New API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">API Key Created</h2>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800 font-medium">
                Save this API key now. You won't be able to see it again!
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your API Key</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newApiKey}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
                  />
                  <button
                    onClick={() => copyToClipboard(newApiKey)}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <ClipboardDocumentIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => {
                  setShowKeyModal(false);
                  setNewApiKey('');
                }}
                className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
              >
                I've saved my API key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Webhook Modal */}
      {showNewWebhookModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create Webhook</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payload URL</label>
                <input
                  type="url"
                  value={newWebhook.url}
                  onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                  placeholder="https://example.com/webhook"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Events</label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {availableEvents.map((event) => (
                    <label key={event} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={newWebhook.events.includes(event)}
                        onChange={() => toggleEvent(event)}
                        className="mr-2"
                      />
                      <span className="text-sm">{event}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowNewWebhookModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createWebhook}
                disabled={!newWebhook.url || newWebhook.events.length === 0}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
              >
                Create Webhook
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Webhook Deliveries Modal */}
      {selectedWebhook && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Webhook Deliveries</h2>
              <button
                onClick={() => setSelectedWebhook(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">{selectedWebhook.url}</p>

            <div className="space-y-2">
              {deliveries.map((delivery) => (
                <div key={delivery.id} className="border rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{delivery.event}</span>
                        {delivery.success ? (
                          <CheckCircleIcon className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircleIcon className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(delivery.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      delivery.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {delivery.status_code || 'Error'}
                    </span>
                  </div>
                </div>
              ))}

              {deliveries.length === 0 && (
                <p className="text-center text-gray-500 py-8">No deliveries yet</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
