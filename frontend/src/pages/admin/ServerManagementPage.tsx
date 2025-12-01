// Enterprise Server Management Module
// Full server lifecycle, metrics, deployment, SSH management
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { API_BASE } from '../../lib/apiClient';
import {
  ServerStackIcon,
  PlusIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  CpuChipIcon,
  CircleStackIcon,
  SignalIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  StopIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ChartBarIcon,
  KeyIcon,
  CommandLineIcon,
  GlobeAltIcon,
  ClockIcon,
  TrashIcon,
  PencilSquareIcon,
  EyeIcon,
  Cog6ToothIcon,
  BoltIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

interface Server {
  id: string;
  name: string;
  hostname: string;
  ip_address: string;
  type: string;
  status: string;
  os: string;
  cpu_cores: number;
  memory_gb: number;
  disk_gb: number;
  location: string;
  provider: string;
  ssh_port: number;
  ssh_user: string;
  last_health_check: string | null;
  uptime_seconds: number;
  created_at: string;
  updated_at: string;
}

interface ServerMetrics {
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_in: number;
  network_out: number;
  load_average: number[];
  processes: number;
  uptime: number;
  timestamp: string;
}

const SERVER_TYPES = [
  { value: 'web', label: 'Web Server', icon: GlobeAltIcon },
  { value: 'database', label: 'Database', icon: CircleStackIcon },
  { value: 'app', label: 'Application', icon: CpuChipIcon },
  { value: 'mail', label: 'Mail Server', icon: SignalIcon },
  { value: 'dns', label: 'DNS Server', icon: GlobeAltIcon },
  { value: 'storage', label: 'Storage', icon: CircleStackIcon },
  { value: 'kubernetes', label: 'Kubernetes Node', icon: ServerStackIcon },
];

const STATUSES = [
  { value: 'active', label: 'Active', color: 'bg-green-100 text-green-800', dotColor: 'bg-green-500' },
  { value: 'inactive', label: 'Inactive', color: 'bg-gray-100 text-gray-800', dotColor: 'bg-gray-500' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-yellow-100 text-yellow-800', dotColor: 'bg-yellow-500' },
  { value: 'error', label: 'Error', color: 'bg-red-100 text-red-800', dotColor: 'bg-red-500' },
  { value: 'provisioning', label: 'Provisioning', color: 'bg-blue-100 text-blue-800', dotColor: 'bg-blue-500' },
];

export default function ServerManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [serverMetrics, setServerMetrics] = useState<ServerMetrics | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'metrics' | 'logs' | 'ssh'>('overview');
  const [metricsHistory, setMetricsHistory] = useState<ServerMetrics[]>([]);

  // Handle ?action=create from Quick Actions
  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      setShowCreateModal(true);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const fetchServers = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/servers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch servers');
      const data = await response.json();
      setServers(data.servers || data.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchServerMetrics = async (serverId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/servers/${serverId}/metrics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setServerMetrics(data.metrics || data);
        if (data.history) {
          setMetricsHistory(data.history);
        }
      }
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    }
  };

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  useEffect(() => {
    if (selectedServer) {
      fetchServerMetrics(selectedServer.id);
      // Auto-refresh metrics every 30 seconds
      const interval = setInterval(() => fetchServerMetrics(selectedServer.id), 30000);
      return () => clearInterval(interval);
    }
  }, [selectedServer]);

  // Filter servers
  const filteredServers = servers.filter(server => {
    const matchesSearch = 
      server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      server.hostname.toLowerCase().includes(searchQuery.toLowerCase()) ||
      server.ip_address.includes(searchQuery);
    const matchesType = typeFilter === 'all' || server.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || server.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  // Stats
  const stats = {
    total: servers.length,
    active: servers.filter(s => s.status === 'active').length,
    error: servers.filter(s => s.status === 'error').length,
    totalCores: servers.reduce((sum, s) => sum + (s.cpu_cores || 0), 0),
    totalMemory: servers.reduce((sum, s) => sum + (s.memory_gb || 0), 0),
    totalDisk: servers.reduce((sum, s) => sum + (s.disk_gb || 0), 0),
  };

  const getStatusBadge = (status: string) => {
    const s = STATUSES.find(s => s.value === status);
    return s ? (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${s.dotColor}`}></span>
        {s.label}
      </span>
    ) : (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        {status}
      </span>
    );
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getUsageColor = (usage: number) => {
    if (usage >= 90) return 'text-red-600 bg-red-100';
    if (usage >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const getUsageBarColor = (usage: number) => {
    if (usage >= 90) return 'bg-red-500';
    if (usage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className={`transition-all duration-300 ${showDetailPanel ? 'mr-[520px]' : ''}`}>
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Server Management</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Manage infrastructure servers, monitor health, and deploy services.
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={fetchServers}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <ArrowPathIcon className="h-4 w-4 mr-2" />
                  Refresh
                </button>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add Server
                </button>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Servers</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <div className="p-3 bg-indigo-100 rounded-lg">
                  <ServerStackIcon className="h-6 w-6 text-indigo-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Active</p>
                  <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Errors</p>
                  <p className="text-2xl font-bold text-red-600">{stats.error}</p>
                </div>
                <div className="p-3 bg-red-100 rounded-lg">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Cores</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.totalCores}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <CpuChipIcon className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Memory</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.totalMemory} GB</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <CircleStackIcon className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Storage</p>
                  <p className="text-2xl font-bold text-emerald-600">{stats.totalDisk} GB</p>
                </div>
                <div className="p-3 bg-emerald-100 rounded-lg">
                  <CircleStackIcon className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center space-x-4">
                <div className="relative flex-1 max-w-xs">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search servers..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Types</option>
                  {SERVER_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Statuses</option>
                  {STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Server Grid */}
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
              ) : filteredServers.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <ServerStackIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No servers found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredServers.map(server => (
                    <div
                      key={server.id}
                      onClick={() => {
                        setSelectedServer(server);
                        setShowDetailPanel(true);
                        setDetailTab('overview');
                      }}
                      className={`bg-white border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${
                        selectedServer?.id === server.id ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center">
                          <div className={`p-2 rounded-lg ${server.status === 'active' ? 'bg-green-100' : 'bg-gray-100'}`}>
                            <ServerStackIcon className={`h-5 w-5 ${server.status === 'active' ? 'text-green-600' : 'text-gray-500'}`} />
                          </div>
                          <div className="ml-3">
                            <h3 className="font-semibold text-gray-900">{server.name}</h3>
                            <p className="text-sm text-gray-500">{server.hostname}</p>
                          </div>
                        </div>
                        {getStatusBadge(server.status)}
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">IP Address</span>
                          <span className="font-mono text-gray-900">{server.ip_address}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Type</span>
                          <span className="text-gray-900">{SERVER_TYPES.find(t => t.value === server.type)?.label || server.type}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Resources</span>
                          <span className="text-gray-900">{server.cpu_cores} CPU · {server.memory_gb} GB · {server.disk_gb} GB</span>
                        </div>
                        {server.uptime_seconds > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">Uptime</span>
                            <span className="text-green-600">{formatUptime(server.uptime_seconds)}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-xs text-gray-400">{server.location || server.provider}</span>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={e => { e.stopPropagation(); }}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                            title="View Metrics"
                          >
                            <ChartBarIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); }}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                            title="SSH Console"
                          >
                            <CommandLineIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); }}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                            title="Settings"
                          >
                            <Cog6ToothIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Server Detail Panel */}
      {showDetailPanel && selectedServer && (
        <div className="fixed right-0 top-0 h-full w-[520px] bg-white shadow-xl border-l border-gray-200 overflow-y-auto z-40">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Server Details</h2>
            <button
              onClick={() => {
                setShowDetailPanel(false);
                setSelectedServer(null);
              }}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <XCircleIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Server Header */}
          <div className="px-6 py-4 bg-gradient-to-br from-slate-700 to-slate-900 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-3 bg-white/10 rounded-lg">
                  <ServerStackIcon className="h-8 w-8" />
                </div>
                <div className="ml-4">
                  <h3 className="text-xl font-bold">{selectedServer.name}</h3>
                  <p className="text-white/70">{selectedServer.hostname}</p>
                </div>
              </div>
              {getStatusBadge(selectedServer.status)}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{selectedServer.cpu_cores}</p>
                <p className="text-xs text-white/60">CPU Cores</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{selectedServer.memory_gb} GB</p>
                <p className="text-xs text-white/60">Memory</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{selectedServer.disk_gb} GB</p>
                <p className="text-xs text-white/60">Storage</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {(['overview', 'metrics', 'logs', 'ssh'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setDetailTab(tab)}
                  className={`flex-1 py-3 px-4 text-center text-sm font-medium border-b-2 ${
                    detailTab === tab
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {detailTab === 'overview' && (
              <div className="space-y-6">
                {/* Quick Actions */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Quick Actions</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="flex items-center justify-center px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                      <PlayIcon className="h-4 w-4 mr-2" />
                      Start
                    </button>
                    <button className="flex items-center justify-center px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
                      <StopIcon className="h-4 w-4 mr-2" />
                      Stop
                    </button>
                    <button className="flex items-center justify-center px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                      <ArrowPathIcon className="h-4 w-4 mr-2" />
                      Restart
                    </button>
                    <button className="flex items-center justify-center px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                      <CommandLineIcon className="h-4 w-4 mr-2" />
                      SSH Console
                    </button>
                  </div>
                </div>

                {/* Server Info */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Server Information</h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">IP Address</span>
                      <span className="font-mono text-gray-900">{selectedServer.ip_address}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">SSH Port</span>
                      <span className="text-gray-900">{selectedServer.ssh_port || 22}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">SSH User</span>
                      <span className="text-gray-900">{selectedServer.ssh_user || 'root'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">OS</span>
                      <span className="text-gray-900">{selectedServer.os || 'Ubuntu 24.04'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Type</span>
                      <span className="text-gray-900">{SERVER_TYPES.find(t => t.value === selectedServer.type)?.label || selectedServer.type}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Location</span>
                      <span className="text-gray-900">{selectedServer.location || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Provider</span>
                      <span className="text-gray-900">{selectedServer.provider || 'Self-hosted'}</span>
                    </div>
                  </div>
                </div>

                {/* Services */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Deployed Services</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                        <span className="text-sm font-medium">nginx</span>
                      </div>
                      <span className="text-xs text-gray-500">Port 80, 443</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                        <span className="text-sm font-medium">node</span>
                      </div>
                      <span className="text-xs text-gray-500">Port 2271</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {detailTab === 'metrics' && (
              <div className="space-y-6">
                {serverMetrics ? (
                  <>
                    {/* CPU Usage */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">CPU Usage</span>
                        <span className={`text-sm font-bold px-2 py-0.5 rounded ${getUsageColor(serverMetrics.cpu_usage)}`}>
                          {serverMetrics.cpu_usage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${getUsageBarColor(serverMetrics.cpu_usage)}`}
                          style={{ width: `${serverMetrics.cpu_usage}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Memory Usage */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Memory Usage</span>
                        <span className={`text-sm font-bold px-2 py-0.5 rounded ${getUsageColor(serverMetrics.memory_usage)}`}>
                          {serverMetrics.memory_usage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${getUsageBarColor(serverMetrics.memory_usage)}`}
                          style={{ width: `${serverMetrics.memory_usage}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Disk Usage */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Disk Usage</span>
                        <span className={`text-sm font-bold px-2 py-0.5 rounded ${getUsageColor(serverMetrics.disk_usage)}`}>
                          {serverMetrics.disk_usage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${getUsageBarColor(serverMetrics.disk_usage)}`}
                          style={{ width: `${serverMetrics.disk_usage}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Network */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center text-sm text-gray-500 mb-1">
                          <ArrowDownIcon className="h-4 w-4 mr-1 text-green-500" />
                          Network In
                        </div>
                        <p className="text-lg font-bold text-gray-900">
                          {(serverMetrics.network_in / 1024 / 1024).toFixed(2)} MB/s
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center text-sm text-gray-500 mb-1">
                          <ArrowUpIcon className="h-4 w-4 mr-1 text-blue-500" />
                          Network Out
                        </div>
                        <p className="text-lg font-bold text-gray-900">
                          {(serverMetrics.network_out / 1024 / 1024).toFixed(2)} MB/s
                        </p>
                      </div>
                    </div>

                    {/* Load Average */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Load Average</p>
                      <div className="flex items-center space-x-4">
                        {serverMetrics.load_average?.map((load, i) => (
                          <div key={i} className="text-center">
                            <p className="text-lg font-bold text-gray-900">{load.toFixed(2)}</p>
                            <p className="text-xs text-gray-500">{i === 0 ? '1m' : i === 1 ? '5m' : '15m'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <ChartBarIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Loading metrics...</p>
                  </div>
                )}
              </div>
            )}

            {detailTab === 'logs' && (
              <div className="space-y-4">
                <div className="bg-gray-900 rounded-lg p-4 font-mono text-xs text-green-400 h-96 overflow-y-auto">
                  <p>[2025-11-30 03:45:12] System started</p>
                  <p>[2025-11-30 03:45:13] nginx: Started successfully</p>
                  <p>[2025-11-30 03:45:14] pm2: Started tenant-billing</p>
                  <p>[2025-11-30 03:45:15] Health check: OK</p>
                  <p className="text-gray-500">...</p>
                </div>
              </div>
            )}

            {detailTab === 'ssh' && (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">SSH Connection</h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-gray-500">Command:</span></p>
                    <code className="block bg-gray-900 text-green-400 p-3 rounded font-mono text-xs">
                      ssh {selectedServer.ssh_user || 'root'}@{selectedServer.ip_address} -p {selectedServer.ssh_port || 22}
                    </code>
                  </div>
                </div>
                <button className="w-full flex items-center justify-center px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800">
                  <CommandLineIcon className="h-5 w-5 mr-2" />
                  Open Web Terminal
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Server Modal */}
      {showCreateModal && (
        <ServerFormModal
          onClose={() => setShowCreateModal(false)}
          onSave={() => {
            setShowCreateModal(false);
            fetchServers();
          }}
        />
      )}
    </div>
  );
}

// Server Form Modal
function ServerFormModal({
  server,
  onClose,
  onSave,
}: {
  server?: Server;
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    name: server?.name || '',
    hostname: server?.hostname || '',
    ip_address: server?.ip_address || '',
    type: server?.type || 'web',
    ssh_port: server?.ssh_port || 22,
    ssh_user: server?.ssh_user || 'root',
    cpu_cores: server?.cpu_cores || 2,
    memory_gb: server?.memory_gb || 4,
    disk_gb: server?.disk_gb || 50,
    os: server?.os || 'Ubuntu 24.04',
    location: server?.location || '',
    provider: server?.provider || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const url = server ? `${API_BASE}/servers/${server.id}` : `${API_BASE}/servers`;
      const method = server ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save server');
      }

      onSave();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose}></div>
        <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            {server ? 'Edit Server' : 'Add New Server'}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Server Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hostname</label>
                <input
                  type="text"
                  value={formData.hostname}
                  onChange={e => setFormData({ ...formData, hostname: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IP Address</label>
                <input
                  type="text"
                  value={formData.ip_address}
                  onChange={e => setFormData({ ...formData, ip_address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  {SERVER_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CPU Cores</label>
                <input
                  type="number"
                  value={formData.cpu_cores}
                  onChange={e => setFormData({ ...formData, cpu_cores: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Memory (GB)</label>
                <input
                  type="number"
                  value={formData.memory_gb}
                  onChange={e => setFormData({ ...formData, memory_gb: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Disk (GB)</label>
                <input
                  type="number"
                  value={formData.disk_gb}
                  onChange={e => setFormData({ ...formData, disk_gb: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  min="10"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SSH User</label>
                <input
                  type="text"
                  value={formData.ssh_user}
                  onChange={e => setFormData({ ...formData, ssh_user: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SSH Port</label>
                <input
                  type="number"
                  value={formData.ssh_port}
                  onChange={e => setFormData({ ...formData, ssh_port: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g., US-East"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                <input
                  type="text"
                  value={formData.provider}
                  onChange={e => setFormData({ ...formData, provider: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g., Hetzner"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : server ? 'Update Server' : 'Add Server'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
