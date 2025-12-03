// Enterprise CloudPods Management Module
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE } from '../../lib/apiClient';
import {
  CloudIcon,
  PlusIcon,
  PlayIcon,
  StopIcon,
  ArrowPathIcon,
  TrashIcon,
  EyeIcon,
  CpuChipIcon,
  ServerStackIcon,
  CircleStackIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  CommandLineIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';

interface CloudPod {
  id: string;
  name: string;
  customer_id?: string;
  customer_email?: string;
  status: string;
  image: string;
  cpu_cores: number;
  memory_mb: number;
  disk_gb: number;
  ip_address?: string;
  domain?: string;
  server_id?: string;
  server_name?: string;
  created_at: string;
  updated_at?: string;
  last_health_check?: string;
  uptime_seconds?: number;
  resource_usage?: {
    cpu_percent: number;
    memory_percent: number;
    disk_percent: number;
  };
}

interface CloudPodStats {
  total: number;
  running: number;
  stopped: number;
  error: number;
  totalCpu: number;
  totalMemory: number;
  totalDisk: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dotColor: string }> = {
  running: { label: 'Running', color: 'bg-green-100 text-green-800', dotColor: 'bg-green-500' },
  stopped: { label: 'Stopped', color: 'bg-gray-100 text-gray-800', dotColor: 'bg-gray-500' },
  starting: { label: 'Starting', color: 'bg-blue-100 text-blue-800', dotColor: 'bg-blue-500 animate-pulse' },
  stopping: { label: 'Stopping', color: 'bg-yellow-100 text-yellow-800', dotColor: 'bg-yellow-500 animate-pulse' },
  error: { label: 'Error', color: 'bg-red-100 text-red-800', dotColor: 'bg-red-500' },
  provisioning: { label: 'Provisioning', color: 'bg-indigo-100 text-indigo-800', dotColor: 'bg-indigo-500 animate-pulse' },
};

export default function CloudPodsManagement() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pods, setPods] = useState<CloudPod[]>([]);
  const [stats, setStats] = useState<CloudPodStats>({
    total: 0, running: 0, stopped: 0, error: 0,
    totalCpu: 0, totalMemory: 0, totalDisk: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle ?action=create from Quick Actions
  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      setShowCreateModal(true);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPod, setSelectedPod] = useState<CloudPod | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchPods = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/cloudpods`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch CloudPods');
      const data = await response.json();
      const podList = data.pods || data.data || [];
      setPods(podList);
      
      // Calculate stats
      const newStats: CloudPodStats = {
        total: podList.length,
        running: podList.filter((p: CloudPod) => p.status === 'running').length,
        stopped: podList.filter((p: CloudPod) => p.status === 'stopped').length,
        error: podList.filter((p: CloudPod) => p.status === 'error').length,
        totalCpu: podList.reduce((sum: number, p: CloudPod) => sum + (p.cpu_cores || 0), 0),
        totalMemory: podList.reduce((sum: number, p: CloudPod) => sum + (p.memory_mb || 0), 0),
        totalDisk: podList.reduce((sum: number, p: CloudPod) => sum + (p.disk_gb || 0), 0),
      };
      setStats(newStats);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch CloudPods:', err);
      setPods([]);
      setStats({
        total: 0, running: 0, stopped: 0, error: 0,
        totalCpu: 0, totalMemory: 0, totalDisk: 0,
      });
      setError(err.message || 'Failed to load CloudPods');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPods();
    const interval = setInterval(fetchPods, 30000);
    return () => clearInterval(interval);
  }, [fetchPods]);

  const performAction = async (podId: string, action: 'start' | 'stop' | 'restart' | 'delete') => {
    setActionLoading(podId);
    try {
      const token = localStorage.getItem('token');
      const url = action === 'delete' 
        ? `${API_BASE}/cloudpods/${podId}`
        : `${API_BASE}/cloudpods/${podId}/${action}`;
      
      await fetch(url, {
        method: action === 'delete' ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchPods();
    } catch (err) {
      console.error(`Failed to ${action} pod:`, err);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredPods = pods.filter(pod => {
    const matchesSearch = 
      pod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pod.customer_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pod.ip_address?.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || pod.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.stopped;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${config.dotColor}`}></span>
        {config.label}
      </span>
    );
  };

  const formatUptime = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatMemory = (mb: number) => {
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb} MB`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">CloudPods</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage containerized hosting environments
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={fetchPods}
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
              Create CloudPod
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Pods</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="p-3 bg-indigo-100 rounded-lg">
              <CloudIcon className="h-6 w-6 text-indigo-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Running</p>
              <p className="text-2xl font-bold text-green-600">{stats.running}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircleIcon className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Stopped</p>
              <p className="text-2xl font-bold text-gray-600">{stats.stopped}</p>
            </div>
            <div className="p-3 bg-gray-100 rounded-lg">
              <StopIcon className="h-6 w-6 text-gray-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total CPU</p>
              <p className="text-2xl font-bold text-blue-600">{stats.totalCpu}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <CpuChipIcon className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total RAM</p>
              <p className="text-2xl font-bold text-purple-600">{formatMemory(stats.totalMemory)}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <ServerStackIcon className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Disk</p>
              <p className="text-2xl font-bold text-orange-600">{stats.totalDisk} GB</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <CircleStackIcon className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {/* Filters */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-xs">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search pods..."
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
          </div>
        </div>

        {/* Pods List */}
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
          ) : filteredPods.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CloudIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No CloudPods found</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Create First CloudPod
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPods.map(pod => (
                <div
                  key={pod.id}
                  className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${
                        pod.status === 'running' ? 'bg-green-100' : 
                        pod.status === 'error' ? 'bg-red-100' : 'bg-gray-100'
                      }`}>
                        <CloudIcon className={`h-5 w-5 ${
                          pod.status === 'running' ? 'text-green-600' : 
                          pod.status === 'error' ? 'text-red-600' : 'text-gray-600'
                        }`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{pod.name}</h3>
                        <p className="text-xs text-gray-500">{pod.customer_email || 'No customer'}</p>
                      </div>
                    </div>
                    {getStatusBadge(pod.status)}
                  </div>

                  {/* Resources */}
                  <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-xs text-gray-500">CPU</p>
                      <p className="text-sm font-semibold text-gray-900">{pod.cpu_cores} cores</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-xs text-gray-500">RAM</p>
                      <p className="text-sm font-semibold text-gray-900">{formatMemory(pod.memory_mb)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-xs text-gray-500">Disk</p>
                      <p className="text-sm font-semibold text-gray-900">{pod.disk_gb} GB</p>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="text-sm text-gray-500 mb-3 space-y-1">
                    {pod.ip_address && (
                      <p className="flex items-center">
                        <GlobeAltIcon className="h-4 w-4 mr-1" />
                        {pod.ip_address}
                      </p>
                    )}
                    {pod.status === 'running' && (
                      <p className="flex items-center">
                        <ClockIcon className="h-4 w-4 mr-1" />
                        Uptime: {formatUptime(pod.uptime_seconds)}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex items-center space-x-1">
                      {pod.status === 'running' ? (
                        <button
                          onClick={() => performAction(pod.id, 'stop')}
                          disabled={actionLoading === pod.id}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Stop"
                        >
                          <StopIcon className="h-4 w-4" />
                        </button>
                      ) : pod.status === 'stopped' ? (
                        <button
                          onClick={() => performAction(pod.id, 'start')}
                          disabled={actionLoading === pod.id}
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
                          title="Start"
                        >
                          <PlayIcon className="h-4 w-4" />
                        </button>
                      ) : null}
                      <button
                        onClick={() => performAction(pod.id, 'restart')}
                        disabled={actionLoading === pod.id || pod.status !== 'running'}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
                        title="Restart"
                      >
                        <ArrowPathIcon className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => {
                          setSelectedPod(pod);
                          setShowDetailModal(true);
                        }}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                        title="View Details"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => performAction(pod.id, 'delete')}
                        disabled={actionLoading === pod.id}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedPod && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowDetailModal(false)}></div>
            <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">{selectedPod.name}</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Status</span>
                  {getStatusBadge(selectedPod.status)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Customer</span>
                  <span className="text-gray-900">{selectedPod.customer_email || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">IP Address</span>
                  <span className="font-mono text-gray-900">{selectedPod.ip_address || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Image</span>
                  <span className="text-gray-900">{selectedPod.image || 'N/A'}</span>
                </div>
                <div className="grid grid-cols-3 gap-4 py-3 border-t border-b border-gray-100">
                  <div className="text-center">
                    <p className="text-sm text-gray-500">CPU</p>
                    <p className="text-lg font-bold text-gray-900">{selectedPod.cpu_cores}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Memory</p>
                    <p className="text-lg font-bold text-gray-900">{formatMemory(selectedPod.memory_mb)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Disk</p>
                    <p className="text-lg font-bold text-gray-900">{selectedPod.disk_gb} GB</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Created</span>
                  <span className="text-gray-900">{new Date(selectedPod.created_at).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    navigate(`/admin/cloudpods/${selectedPod.id}/console`);
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Open Console
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateCloudPodModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchPods();
          }}
        />
      )}
    </div>
  );
}

// Create CloudPod Modal
function CreateCloudPodModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    customer_id: '',
    image: 'ubuntu:22.04',
    cpu_cores: 1,
    memory_mb: 512,
    disk_gb: 10,
  });
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/customers`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setCustomers(data.customers || data.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch customers:', err);
      }
    };
    fetchCustomers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE}/cloudpods`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      onCreated();
    } catch (err) {
      console.error('Failed to create CloudPod:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose}></div>
        <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Create CloudPod</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="my-cloudpod"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
              <select
                value={formData.customer_id}
                onChange={e => setFormData(prev => ({ ...prev, customer_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">No customer (Admin)</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.email}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
              <select
                value={formData.image}
                onChange={e => setFormData(prev => ({ ...prev, image: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ubuntu:22.04">Ubuntu 22.04</option>
                <option value="ubuntu:20.04">Ubuntu 20.04</option>
                <option value="debian:12">Debian 12</option>
                <option value="alpine:latest">Alpine</option>
                <option value="nginx:latest">Nginx</option>
                <option value="node:20">Node.js 20</option>
                <option value="php:8.2-fpm">PHP 8.2</option>
              </select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CPU Cores</label>
                <select
                  value={formData.cpu_cores}
                  onChange={e => setFormData(prev => ({ ...prev, cpu_cores: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  {[1, 2, 4, 8].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Memory</label>
                <select
                  value={formData.memory_mb}
                  onChange={e => setFormData(prev => ({ ...prev, memory_mb: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  {[256, 512, 1024, 2048, 4096, 8192].map(n => (
                    <option key={n} value={n}>{n >= 1024 ? `${n/1024} GB` : `${n} MB`}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Disk</label>
                <select
                  value={formData.disk_gb}
                  onChange={e => setFormData(prev => ({ ...prev, disk_gb: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  {[5, 10, 20, 50, 100].map(n => (
                    <option key={n} value={n}>{n} GB</option>
                  ))}
                </select>
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
                disabled={loading || !formData.name}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create CloudPod'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
