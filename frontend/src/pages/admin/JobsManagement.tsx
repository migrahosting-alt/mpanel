import { useState, useEffect } from 'react';
import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  QueueListIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  EyeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

const API_BASE = '/api';

interface Job {
  id: string;
  name: string;
  type: 'provisioning' | 'billing' | 'email' | 'backup' | 'maintenance' | 'sync';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
  priority: 'low' | 'normal' | 'high' | 'critical';
  progress: number;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  data?: Record<string, any>;
  result?: Record<string, any>;
}

interface JobStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
}

export default function JobsManagement() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<JobStats>({ total: 0, pending: 0, running: 0, completed: 0, failed: 0, cancelled: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [filter, setFilter] = useState({
    status: 'all',
    type: 'all',
    search: '',
  });
  const [page, setPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const itemsPerPage = 20;

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (filter.status !== 'all') params.append('status', filter.status);
      if (filter.type !== 'all') params.append('type', filter.type);
      if (filter.search) params.append('search', filter.search);
      
      const response = await fetch(`${API_BASE}/admin/jobs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to fetch jobs');
      const data = await response.json();
      
      let filtered = data.jobs || data.data || [];
      if (filter.status !== 'all') {
        filtered = filtered.filter(j => j.status === filter.status);
      }
      if (filter.type !== 'all') {
        filtered = filtered.filter(j => j.type === filter.type);
      }
      if (filter.search) {
        const search = filter.search.toLowerCase();
        filtered = filtered.filter(j => 
          j.name.toLowerCase().includes(search) || 
          j.id.toLowerCase().includes(search)
        );
      }
      
      setJobs(filtered);
      
      // Calculate stats from all jobs (not filtered)
      const allJobs = data.jobs || data.data || [];
      const newStats: JobStats = {
        total: allJobs.length,
        pending: allJobs.filter((j: Job) => j.status === 'pending').length,
        running: allJobs.filter((j: Job) => j.status === 'running').length,
        completed: allJobs.filter((j: Job) => j.status === 'completed').length,
        failed: allJobs.filter((j: Job) => j.status === 'failed').length,
        cancelled: allJobs.filter((j: Job) => j.status === 'cancelled').length,
      };
      setStats(newStats);
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
      setJobs([]);
      setStats({ total: 0, pending: 0, running: 0, completed: 0, failed: 0, cancelled: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [filter]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, filter]);

  const handleRetry = async (jobId: string) => {
    try {
      // await fetch(`${API_BASE}/admin/jobs/${jobId}/retry`, { method: 'POST' });
      console.log('Retrying job:', jobId);
      fetchJobs();
    } catch (err) {
      console.error('Failed to retry job:', err);
    }
  };

  const handleCancel = async (jobId: string) => {
    if (!confirm('Are you sure you want to cancel this job?')) return;
    try {
      // await fetch(`${API_BASE}/admin/jobs/${jobId}/cancel`, { method: 'POST' });
      console.log('Cancelling job:', jobId);
      fetchJobs();
    } catch (err) {
      console.error('Failed to cancel job:', err);
    }
  };

  const handlePause = async (jobId: string) => {
    try {
      // await fetch(`${API_BASE}/admin/jobs/${jobId}/pause`, { method: 'POST' });
      console.log('Pausing job:', jobId);
      fetchJobs();
    } catch (err) {
      console.error('Failed to pause job:', err);
    }
  };

  const handleResume = async (jobId: string) => {
    try {
      // await fetch(`${API_BASE}/admin/jobs/${jobId}/resume`, { method: 'POST' });
      console.log('Resuming job:', jobId);
      fetchJobs();
    } catch (err) {
      console.error('Failed to resume job:', err);
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job? This action cannot be undone.')) return;
    try {
      // await fetch(`${API_BASE}/admin/jobs/${jobId}`, { method: 'DELETE' });
      console.log('Deleting job:', jobId);
      fetchJobs();
    } catch (err) {
      console.error('Failed to delete job:', err);
    }
  };

  const getStatusBadge = (status: Job['status']) => {
    const styles: Record<Job['status'], string> = {
      pending: 'bg-gray-100 text-gray-800',
      running: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      cancelled: 'bg-orange-100 text-orange-800',
      paused: 'bg-yellow-100 text-yellow-800',
    };
    const icons: Record<Job['status'], JSX.Element> = {
      pending: <ClockIcon className="h-3 w-3" />,
      running: <ArrowPathIcon className="h-3 w-3 animate-spin" />,
      completed: <CheckCircleIcon className="h-3 w-3" />,
      failed: <XCircleIcon className="h-3 w-3" />,
      cancelled: <StopIcon className="h-3 w-3" />,
      paused: <PauseIcon className="h-3 w-3" />,
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${styles[status]}`}>
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getPriorityBadge = (priority: Job['priority']) => {
    const styles: Record<Job['priority'], string> = {
      low: 'text-gray-500',
      normal: 'text-blue-500',
      high: 'text-orange-500',
      critical: 'text-red-500 font-bold',
    };
    return <span className={`text-xs ${styles[priority]}`}>{priority.toUpperCase()}</span>;
  };

  const getTypeBadge = (type: Job['type']) => {
    const styles: Record<Job['type'], string> = {
      provisioning: 'bg-purple-100 text-purple-800',
      billing: 'bg-green-100 text-green-800',
      email: 'bg-blue-100 text-blue-800',
      backup: 'bg-yellow-100 text-yellow-800',
      maintenance: 'bg-gray-100 text-gray-800',
      sync: 'bg-indigo-100 text-indigo-800',
    };
    return (
      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${styles[type]}`}>
        {type}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatTimeAgo = (dateString: string) => {
    const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const paginatedJobs = jobs.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const totalPages = Math.ceil(jobs.length / itemsPerPage);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Job Queue Management</h1>
            <p className="text-gray-600 mt-1">Monitor and manage background jobs and tasks</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded text-blue-600"
              />
              Auto-refresh
            </label>
            <button
              onClick={fetchJobs}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
            >
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <QueueListIcon className="h-8 w-8 text-gray-400" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-500">Total Jobs</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <ClockIcon className="h-8 w-8 text-gray-400" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
              <p className="text-xs text-gray-500">Pending</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <ArrowPathIcon className="h-8 w-8 text-blue-400" />
            <div>
              <p className="text-2xl font-bold text-blue-600">{stats.running}</p>
              <p className="text-xs text-gray-500">Running</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="h-8 w-8 text-green-400" />
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              <p className="text-xs text-gray-500">Completed</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <XCircleIcon className="h-8 w-8 text-red-400" />
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
              <p className="text-xs text-gray-500">Failed</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <StopIcon className="h-8 w-8 text-orange-400" />
            <div>
              <p className="text-2xl font-bold text-orange-600">{stats.cancelled}</p>
              <p className="text-xs text-gray-500">Cancelled</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6 border border-gray-200">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Status:</label>
            <select
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
              className="text-sm border-gray-300 rounded-md"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
              <option value="paused">Paused</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Type:</label>
            <select
              value={filter.type}
              onChange={(e) => setFilter({ ...filter, type: e.target.value })}
              className="text-sm border-gray-300 rounded-md"
            >
              <option value="all">All</option>
              <option value="provisioning">Provisioning</option>
              <option value="billing">Billing</option>
              <option value="email">Email</option>
              <option value="backup">Backup</option>
              <option value="maintenance">Maintenance</option>
              <option value="sync">Sync</option>
            </select>
          </div>

          <div className="flex-1 min-w-64">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search jobs by name or ID..."
                value={filter.search}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 text-sm border-gray-300 rounded-md"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" />
                    Loading jobs...
                  </td>
                </tr>
              ) : paginatedJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <QueueListIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    No jobs found
                  </td>
                </tr>
              ) : (
                paginatedJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{job.name}</p>
                        <p className="text-xs text-gray-500 font-mono">{job.id}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">{getTypeBadge(job.type)}</td>
                    <td className="px-4 py-3">{getStatusBadge(job.status)}</td>
                    <td className="px-4 py-3">{getPriorityBadge(job.priority)}</td>
                    <td className="px-4 py-3">
                      <div className="w-24">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                job.status === 'failed' ? 'bg-red-500' :
                                job.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{job.progress}%</span>
                        </div>
                        {job.attempts > 0 && (
                          <p className="text-xs text-gray-400 mt-1">
                            Attempt {job.attempts}/{job.maxAttempts}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-500" title={formatDate(job.createdAt)}>
                        {formatTimeAgo(job.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setSelectedJob(job); setShowDetails(true); }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="View Details"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        
                        {job.status === 'running' && (
                          <button
                            onClick={() => handlePause(job.id)}
                            className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded"
                            title="Pause"
                          >
                            <PauseIcon className="h-4 w-4" />
                          </button>
                        )}
                        
                        {job.status === 'paused' && (
                          <button
                            onClick={() => handleResume(job.id)}
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                            title="Resume"
                          >
                            <PlayIcon className="h-4 w-4" />
                          </button>
                        )}
                        
                        {job.status === 'failed' && (
                          <button
                            onClick={() => handleRetry(job.id)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Retry"
                          >
                            <ArrowPathIcon className="h-4 w-4" />
                          </button>
                        )}
                        
                        {(job.status === 'pending' || job.status === 'running' || job.status === 'paused') && (
                          <button
                            onClick={() => handleCancel(job.id)}
                            className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded"
                            title="Cancel"
                          >
                            <StopIcon className="h-4 w-4" />
                          </button>
                        )}
                        
                        {(job.status === 'completed' || job.status === 'cancelled' || job.status === 'failed') && (
                          <button
                            onClick={() => handleDelete(job.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-700">
              Showing {(page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, jobs.length)} of {jobs.length} jobs
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Job Details Modal */}
      {showDetails && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Job Details</h3>
              <button
                onClick={() => { setShowDetails(false); setSelectedJob(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  {getStatusBadge(selectedJob.status)}
                  {getTypeBadge(selectedJob.type)}
                  {getPriorityBadge(selectedJob.priority)}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Job ID</label>
                    <p className="text-sm font-mono text-gray-900">{selectedJob.id}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Name</label>
                    <p className="text-sm text-gray-900">{selectedJob.name}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Created</label>
                    <p className="text-sm text-gray-900">{formatDate(selectedJob.createdAt)}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Attempts</label>
                    <p className="text-sm text-gray-900">{selectedJob.attempts} / {selectedJob.maxAttempts}</p>
                  </div>
                  {selectedJob.startedAt && (
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Started</label>
                      <p className="text-sm text-gray-900">{formatDate(selectedJob.startedAt)}</p>
                    </div>
                  )}
                  {selectedJob.completedAt && (
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Completed</label>
                      <p className="text-sm text-gray-900">{formatDate(selectedJob.completedAt)}</p>
                    </div>
                  )}
                </div>

                {/* Progress */}
                <div>
                  <label className="text-xs text-gray-500 uppercase">Progress</label>
                  <div className="mt-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        selectedJob.status === 'failed' ? 'bg-red-500' :
                        selectedJob.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${selectedJob.progress}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{selectedJob.progress}% complete</p>
                </div>

                {/* Error */}
                {selectedJob.error && (
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Error</label>
                    <div className="mt-1 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-700">{selectedJob.error}</p>
                    </div>
                  </div>
                )}

                {/* Job Data */}
                {selectedJob.data && (
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Job Data</label>
                    <pre className="mt-1 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs overflow-x-auto">
                      {JSON.stringify(selectedJob.data, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Result */}
                {selectedJob.result && (
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Result</label>
                    <pre className="mt-1 p-3 bg-green-50 border border-green-200 rounded-lg text-xs overflow-x-auto">
                      {JSON.stringify(selectedJob.result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              {selectedJob.status === 'failed' && (
                <button
                  onClick={() => { handleRetry(selectedJob.id); setShowDetails(false); }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  Retry Job
                </button>
              )}
              <button
                onClick={() => { setShowDetails(false); setSelectedJob(null); }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
