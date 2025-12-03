// frontend/src/pages/MonitoringPage.tsx
import React, { useState, useEffect } from 'react';
import {
  CpuChipIcon,
  CircleStackIcon,
  ServerIcon,
  BellIcon,
  BellAlertIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrashIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { apiClient } from '../lib/apiClient';
import toast from 'react-hot-toast';

interface ServerMetrics {
  cpu: number;
  memory: number;
  disk: number;
  uptime: number;
  timestamp: string;
}

interface Alert {
  id: number;
  severity: string;
  message: string;
  status: string;
  created_at: string;
}

interface AlertRule {
  id: number;
  name: string;
  resource_type: string;
  resource_id: number;
  metric: string;
  operator: string;
  threshold: number;
  enabled: boolean;
}

interface Stats {
  server: ServerMetrics;
  alerts: {
    active: number;
    acknowledged: number;
    resolved: number;
  };
  active_rules: number;
}

export default function MonitoringPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewRuleModal, setShowNewRuleModal] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    resource_type: 'server',
    resource_id: '1',
    metric: 'cpu',
    operator: '>',
    threshold: '80',
  });

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, alertsRes, rulesRes] = await Promise.all([
        apiClient.get('/monitoring/stats'),
        apiClient.get('/monitoring/alerts?status=active'),
        apiClient.get('/monitoring/rules'),
      ]);
      setStats(statsRes.data);
      setAlerts(alertsRes.data.alerts);
      setRules(rulesRes.data.rules);
    } catch (error: any) {
      console.error('Failed to fetch monitoring data:', error);
      // Don't show error toast for features not yet implemented
      if (error?.response?.status !== 404 && error?.response?.status !== 501) {
        toast.error('Failed to fetch monitoring data');
      }
      // Set empty states
      setStats(null);
      setAlerts([]);
      setRules([]);
    } finally {
      setLoading(false);
    }
  };

  const createRule = async () => {
    try {
      const payload = {
        ...newRule,
        resource_id: parseInt(newRule.resource_id),
        threshold: parseFloat(newRule.threshold),
      };
      await apiClient.post('/monitoring/rules', payload);
      toast.success('Alert rule created successfully');
      setShowNewRuleModal(false);
      setNewRule({
        name: '',
        resource_type: 'server',
        resource_id: '1',
        metric: 'cpu',
        operator: '>',
        threshold: '80',
      });
      fetchData();
    } catch (error) {
      toast.error('Failed to create alert rule');
    }
  };

  const toggleRule = async (ruleId: number, enabled: boolean) => {
    try {
      await apiClient.put(`/monitoring/rules/${ruleId}`, { enabled: !enabled });
      toast.success(`Rule ${!enabled ? 'enabled' : 'disabled'}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update rule');
    }
  };

  const deleteRule = async (ruleId: number) => {
    if (!confirm('Are you sure you want to delete this alert rule?')) return;

    try {
      await apiClient.delete(`/monitoring/rules/${ruleId}`);
      toast.success('Alert rule deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete alert rule');
    }
  };

  const acknowledgeAlert = async (alertId: number) => {
    try {
      await apiClient.post(`/monitoring/alerts/${alertId}/acknowledge`);
      toast.success('Alert acknowledged');
      fetchData();
    } catch (error) {
      toast.error('Failed to acknowledge alert');
    }
  };

  const resolveAlert = async (alertId: number) => {
    try {
      await apiClient.post(`/monitoring/alerts/${alertId}/resolve`);
      toast.success('Alert resolved');
      fetchData();
    } catch (error) {
      toast.error('Failed to resolve alert');
    }
  };

  const getMetricColor = (value: number, threshold: number = 80) => {
    if (value >= threshold) return 'text-red-600';
    if (value >= threshold * 0.75) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getSeverityBadge = (severity: string) => {
    const colors = {
      info: 'bg-blue-100 text-blue-800',
      warning: 'bg-yellow-100 text-yellow-800',
      critical: 'bg-red-100 text-red-800',
    };
    return colors[severity as keyof typeof colors] || colors.info;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show "Coming Soon" state if no data available
  if (!stats && alerts.length === 0 && rules.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Resource Monitoring</h1>
          <p className="text-gray-600 mt-1">Real-time metrics and alerts</p>
        </div>
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <BellIcon className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Monitoring Coming Soon
          </h3>
          <p className="text-slate-600 mb-4 max-w-md mx-auto">
            Advanced monitoring and alerting features are not enabled yet in your environment.
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Resource Monitoring</h1>
          <p className="text-gray-600 mt-1">Real-time metrics and alerts</p>
        </div>
        <button
          onClick={() => setShowNewRuleModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <PlusIcon className="h-5 w-5" />
          New Alert Rule
        </button>
      </div>

      {/* Metrics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">CPU Usage</p>
                <p className={`text-3xl font-bold ${getMetricColor(parseFloat(stats.server.cpu))}`}>
                  {stats.server.cpu}%
                </p>
              </div>
              <CpuChipIcon className="h-12 w-12 text-gray-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Memory Usage</p>
                <p className={`text-3xl font-bold ${getMetricColor(parseFloat(stats.server.memory))}`}>
                  {stats.server.memory}%
                </p>
              </div>
              <CircleStackIcon className="h-12 w-12 text-gray-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Disk Usage</p>
                <p className={`text-3xl font-bold ${getMetricColor(parseFloat(stats.server.disk))}`}>
                  {stats.server.disk}%
                </p>
              </div>
              <ServerIcon className="h-12 w-12 text-gray-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Alerts</p>
                <p className="text-3xl font-bold text-gray-900">{stats.alerts.active}</p>
              </div>
              <BellAlertIcon className="h-12 w-12 text-gray-400" />
            </div>
          </div>
        </div>
      )}

      {/* Active Alerts */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Active Alerts</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {alerts.length === 0 ? (
            <div className="p-8 text-center">
              <BellIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No active alerts</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div key={alert.id} className="p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSeverityBadge(alert.severity)}`}>
                        {alert.severity}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(alert.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-900">{alert.message}</p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="text-yellow-600 hover:text-yellow-700"
                      title="Acknowledge"
                    >
                      <CheckCircleIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => resolveAlert(alert.id)}
                      className="text-green-600 hover:text-green-700"
                      title="Resolve"
                    >
                      <XCircleIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Alert Rules */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Alert Rules</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resource</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Condition</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No alert rules configured
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{rule.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {rule.resource_type} #{rule.resource_id}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {rule.metric} {rule.operator} {rule.threshold}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => toggleRule(rule.id, rule.enabled)}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          rule.enabled
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {rule.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={() => deleteRule(rule.id)}
                        className="text-red-600 hover:text-red-700"
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

      {/* New Rule Modal */}
      {showNewRuleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create Alert Rule</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  placeholder="High CPU Alert"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Metric</label>
                <select
                  value={newRule.metric}
                  onChange={(e) => setNewRule({ ...newRule, metric: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="cpu">CPU Usage</option>
                  <option value="memory">Memory Usage</option>
                  <option value="disk">Disk Usage</option>
                  <option value="connections">Database Connections</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Operator</label>
                  <select
                    value={newRule.operator}
                    onChange={(e) => setNewRule({ ...newRule, operator: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value=">">Greater than</option>
                    <option value="<">Less than</option>
                    <option value=">=">Greater or equal</option>
                    <option value="<=">Less or equal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Threshold</label>
                  <input
                    type="number"
                    value={newRule.threshold}
                    onChange={(e) => setNewRule({ ...newRule, threshold: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowNewRuleModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createRule}
                disabled={!newRule.name}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
              >
                Create Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
