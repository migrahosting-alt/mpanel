// Enterprise Provisioning Module
// Task queue, job management, auto-provision settings, logs
import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../lib/apiClient';
import {
  CogIcon,
  PlayIcon,
  PauseIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  QueueListIcon,
  BoltIcon,
  ServerStackIcon,
  CloudIcon,
  GlobeAltIcon,
  EnvelopeIcon,
  CircleStackIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  TrashIcon,
  EyeIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';

interface ProvisioningTask {
  id: string;
  type: string;
  resource_type: string;
  resource_id: string;
  customer_id?: string;
  customer_email?: string;
  status: string;
  priority: number;
  attempts: number;
  max_attempts: number;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  metadata?: Record<string, any>;
}

interface ProvisioningStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  avgDuration: number;
  successRate: number;
}

interface AutoProvisionRule {
  id: string;
  name: string;
  trigger: string;
  resource_type: string;
  enabled: boolean;
  config: Record<string, any>;
  created_at: string;
}

const TASK_TYPES = [
  { value: 'create_cloudpod', label: 'Create CloudPod', icon: CloudIcon },
  { value: 'create_website', label: 'Create Website', icon: GlobeAltIcon },
  { value: 'create_database', label: 'Create Database', icon: CircleStackIcon },
  { value: 'create_email', label: 'Create Email', icon: EnvelopeIcon },
  { value: 'setup_dns', label: 'Setup DNS', icon: GlobeAltIcon },
  { value: 'deploy_ssl', label: 'Deploy SSL', icon: ServerStackIcon },
  { value: 'backup', label: 'Backup', icon: CircleStackIcon },
];

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', dotColor: 'bg-yellow-500' },
  queued: { label: 'Queued', color: 'bg-blue-100 text-blue-800', dotColor: 'bg-blue-500' },
  running: { label: 'Running', color: 'bg-indigo-100 text-indigo-800', dotColor: 'bg-indigo-500 animate-pulse' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800', dotColor: 'bg-green-500' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-800', dotColor: 'bg-red-500' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800', dotColor: 'bg-gray-500' },
};

export default function ProvisioningModule() {
  const [tasks, setTasks] = useState<ProvisioningTask[]>([]);
  const [stats, setStats] = useState<ProvisioningStats>({
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    avgDuration: 0,
    successRate: 0,
  });
  const [rules, setRules] = useState<AutoProvisionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'queue' | 'history' | 'rules' | 'settings'>('queue');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedTask, setSelectedTask] = useState<ProvisioningTask | null>(null);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchTasks = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/ops/provisioning/jobs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch tasks');
      const data = await response.json();
      setTasks(data.tasks || data.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/provisioning/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats || data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchTasks(), fetchStats()]);
    setLoading(false);
  }, [fetchTasks, fetchStats]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchAll]);

  const retryTask = async (taskId: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE}/provisioning/retry/${taskId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchTasks();
    } catch (err) {
      console.error('Failed to retry task:', err);
    }
  };

  const cancelTask = async (taskId: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE}/provisioning/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchTasks();
    } catch (err) {
      console.error('Failed to cancel task:', err);
    }
  };

  const clearFailed = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE}/provisioning/failed`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchTasks();
    } catch (err) {
      console.error('Failed to clear failed jobs:', err);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = 
      task.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.customer_email?.toLowerCase().includes(searchQuery.toLowerCase()) || false);
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesType = typeFilter === 'all' || task.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const queuedTasks = filteredTasks.filter(t => ['pending', 'queued', 'running'].includes(t.status));
  const historyTasks = filteredTasks.filter(t => ['completed', 'failed', 'cancelled'].includes(t.status));

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${config.dotColor}`}></span>
        {config.label}
      </span>
    );
  };

  const formatDuration = (start?: string, end?: string) => {
    if (!start) return '—';
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const seconds = Math.floor((endTime - startTime) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTaskIcon = (type: string) => {
    const taskType = TASK_TYPES.find(t => t.value === type);
    const Icon = taskType?.icon || CogIcon;
    return <Icon className="h-5 w-5" />;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Provisioning</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage automated provisioning tasks, queue status, and auto-provision rules.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <label className="flex items-center text-sm text-gray-600">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={e => setAutoRefresh(e.target.checked)}
                className="mr-2 h-4 w-4 text-indigo-600 rounded border-gray-300"
              />
              Auto-refresh
            </label>
            <button
              onClick={fetchAll}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <ArrowPathIcon className="h-4 w-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <ClockIcon className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Running</p>
              <p className="text-2xl font-bold text-indigo-600">{stats.running}</p>
            </div>
            <div className="p-3 bg-indigo-100 rounded-lg">
              <BoltIcon className="h-6 w-6 text-indigo-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Completed</p>
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircleIcon className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Failed</p>
              <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <XCircleIcon className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Avg Duration</p>
              <p className="text-2xl font-bold text-blue-600">{stats.avgDuration.toFixed(1)}s</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <ChartBarIcon className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Success Rate</p>
              <p className="text-2xl font-bold text-emerald-600">{stats.successRate.toFixed(1)}%</p>
            </div>
            <div className="p-3 bg-emerald-100 rounded-lg">
              <CheckCircleIcon className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {(['queue', 'history', 'rules', 'settings'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${
                  activeTab === tab
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab === 'queue' && (
                  <span className="flex items-center">
                    <QueueListIcon className="h-4 w-4 mr-2" />
                    Queue ({queuedTasks.length})
                  </span>
                )}
                {tab === 'history' && (
                  <span className="flex items-center">
                    <ClockIcon className="h-4 w-4 mr-2" />
                    History
                  </span>
                )}
                {tab === 'rules' && (
                  <span className="flex items-center">
                    <BoltIcon className="h-4 w-4 mr-2" />
                    Auto-Provision Rules
                  </span>
                )}
                {tab === 'settings' && (
                  <span className="flex items-center">
                    <Cog6ToothIcon className="h-4 w-4 mr-2" />
                    Settings
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Filters */}
        {(activeTab === 'queue' || activeTab === 'history') && (
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center space-x-4">
              <div className="relative flex-1 max-w-xs">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Statuses</option>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Types</option>
                {TASK_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              {activeTab === 'history' && stats.failed > 0 && (
                <button
                  onClick={clearFailed}
                  className="inline-flex items-center px-3 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50"
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Clear Failed
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12 text-red-500">
              <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
              {error}
            </div>
          ) : (
            <>
              {/* Queue Tab */}
              {activeTab === 'queue' && (
                <div className="space-y-3">
                  {queuedTasks.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <QueueListIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No tasks in queue</p>
                    </div>
                  ) : (
                    queuedTasks.map(task => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center space-x-4">
                          <div className={`p-2 rounded-lg ${task.status === 'running' ? 'bg-indigo-100' : 'bg-gray-200'}`}>
                            {getTaskIcon(task.type)}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-gray-900">
                                {TASK_TYPES.find(t => t.value === task.type)?.label || task.type}
                              </span>
                              {getStatusBadge(task.status)}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              {task.customer_email && <span className="mr-3">Customer: {task.customer_email}</span>}
                              <span className="mr-3">Attempt: {task.attempts}/{task.max_attempts}</span>
                              <span>Created: {formatDate(task.created_at)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {task.status === 'running' && (
                            <span className="text-sm text-indigo-600 font-medium">
                              {formatDuration(task.started_at)}
                            </span>
                          )}
                          <button
                            onClick={() => {
                              setSelectedTask(task);
                              setShowTaskDetail(true);
                            }}
                            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white"
                            title="View Details"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => cancelTask(task.id)}
                            className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-white"
                            title="Cancel"
                          >
                            <XCircleIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* History Tab */}
              {activeTab === 'history' && (
                <div className="space-y-3">
                  {historyTasks.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <ClockIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No task history</p>
                    </div>
                  ) : (
                    historyTasks.slice(0, 50).map(task => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center space-x-4">
                          <div className={`p-2 rounded-lg ${
                            task.status === 'completed' ? 'bg-green-100' : 
                            task.status === 'failed' ? 'bg-red-100' : 'bg-gray-200'
                          }`}>
                            {task.status === 'completed' ? (
                              <CheckCircleIcon className="h-5 w-5 text-green-600" />
                            ) : task.status === 'failed' ? (
                              <XCircleIcon className="h-5 w-5 text-red-600" />
                            ) : (
                              getTaskIcon(task.type)
                            )}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-gray-900">
                                {TASK_TYPES.find(t => t.value === task.type)?.label || task.type}
                              </span>
                              {getStatusBadge(task.status)}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              {task.error_message && (
                                <span className="text-red-600 mr-3">{task.error_message}</span>
                              )}
                              <span className="mr-3">Duration: {formatDuration(task.started_at, task.completed_at)}</span>
                              <span>Completed: {task.completed_at ? formatDate(task.completed_at) : 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setSelectedTask(task);
                              setShowTaskDetail(true);
                            }}
                            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white"
                            title="View Details"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </button>
                          {task.status === 'failed' && (
                            <button
                              onClick={() => retryTask(task.id)}
                              className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-white"
                              title="Retry"
                            >
                              <ArrowPathIcon className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Rules Tab */}
              {activeTab === 'rules' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-500">Configure automatic provisioning triggers</p>
                    <button className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                      <BoltIcon className="h-4 w-4 mr-2" />
                      Add Rule
                    </button>
                  </div>

                  {/* Default Rules */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <CloudIcon className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">Auto-Create CloudPod on Subscription</h4>
                          <p className="text-sm text-gray-500">Automatically provision CloudPod when a hosting subscription is activated</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <GlobeAltIcon className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">Auto-Setup DNS Records</h4>
                          <p className="text-sm text-gray-500">Automatically create DNS records when a domain is added</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <ServerStackIcon className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">Auto-Deploy SSL Certificates</h4>
                          <p className="text-sm text-gray-500">Automatically request and deploy Let's Encrypt SSL certificates</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-orange-100 rounded-lg">
                          <EnvelopeIcon className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">Auto-Create Email Accounts</h4>
                          <p className="text-sm text-gray-500">Automatically create default email accounts for new domains</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Settings Tab */}
              {activeTab === 'settings' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-4">Queue Settings</h4>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-700 mb-1">Max Concurrent Tasks</label>
                          <input
                            type="number"
                            defaultValue={5}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-700 mb-1">Max Retry Attempts</label>
                          <input
                            type="number"
                            defaultValue={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-700 mb-1">Task Timeout (seconds)</label>
                          <input
                            type="number"
                            defaultValue={300}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-700 mb-1">Retry Delay (seconds)</label>
                          <input
                            type="number"
                            defaultValue={60}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-4">Notifications</h4>
                    <div className="space-y-3">
                      <label className="flex items-center">
                        <input type="checkbox" className="h-4 w-4 text-indigo-600 rounded border-gray-300 mr-3" defaultChecked />
                        <span className="text-sm text-gray-700">Email on task failure</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" className="h-4 w-4 text-indigo-600 rounded border-gray-300 mr-3" />
                        <span className="text-sm text-gray-700">Slack notification on failure</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" className="h-4 w-4 text-indigo-600 rounded border-gray-300 mr-3" />
                        <span className="text-sm text-gray-700">Daily provisioning summary</span>
                      </label>
                    </div>
                  </div>

                  <div className="pt-4">
                    <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                      Save Settings
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Task Detail Modal */}
      {showTaskDetail && selectedTask && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowTaskDetail(false)}></div>
            <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Task Details</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Status</span>
                  {getStatusBadge(selectedTask.status)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Type</span>
                  <span className="text-gray-900">{TASK_TYPES.find(t => t.value === selectedTask.type)?.label || selectedTask.type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Task ID</span>
                  <span className="font-mono text-sm text-gray-900">{selectedTask.id}</span>
                </div>
                {selectedTask.customer_email && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Customer</span>
                    <span className="text-gray-900">{selectedTask.customer_email}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Attempts</span>
                  <span className="text-gray-900">{selectedTask.attempts} / {selectedTask.max_attempts}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Created</span>
                  <span className="text-gray-900">{formatDate(selectedTask.created_at)}</span>
                </div>
                {selectedTask.started_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Started</span>
                    <span className="text-gray-900">{formatDate(selectedTask.started_at)}</span>
                  </div>
                )}
                {selectedTask.completed_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Completed</span>
                    <span className="text-gray-900">{formatDate(selectedTask.completed_at)}</span>
                  </div>
                )}
                {selectedTask.error_message && (
                  <div>
                    <span className="text-gray-500 block mb-1">Error</span>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                      {selectedTask.error_message}
                    </div>
                  </div>
                )}
                {selectedTask.metadata && Object.keys(selectedTask.metadata).length > 0 && (
                  <div>
                    <span className="text-gray-500 block mb-1">Metadata</span>
                    <pre className="bg-gray-50 rounded-lg p-3 text-xs overflow-x-auto">
                      {JSON.stringify(selectedTask.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowTaskDetail(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
                {selectedTask.status === 'failed' && (
                  <button
                    onClick={() => {
                      retryTask(selectedTask.id);
                      setShowTaskDetail(false);
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Retry Task
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
