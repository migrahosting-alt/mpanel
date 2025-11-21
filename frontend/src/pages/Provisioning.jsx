import { useState, useEffect } from 'react';
import {
  ServerIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { api } from '../lib/apiClient';

export default function Provisioning() {
  const [stats, setStats] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [failedJobs, setFailedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedTask, setSelectedTask] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [filterStatus]);

  const fetchData = async () => {
    try {
      const tasksPath = filterStatus === 'all'
        ? '/provisioning/tasks'
        : `/provisioning/tasks?status=${filterStatus}`;

      const [statsData, tasksData, failedData] = await Promise.all([
        api.get('/provisioning/stats'),
        api.get(tasksPath),
        api.get('/provisioning/failed')
      ]);

      const normalizedStats = {
        pending: statsData.tasks?.last_7_days?.pending ?? 0,
        processing: statsData.tasks?.last_7_days?.processing ?? 0,
        completed: statsData.tasks?.last_7_days?.completed ?? 0,
        failed: statsData.tasks?.last_7_days?.failed ?? 0,
        queue: statsData.queue || {},
        raw: statsData,
      };

      setStats(normalizedStats);
      setTasks(Array.isArray(tasksData) ? tasksData : tasksData?.tasks || []);
      setFailedJobs(Array.isArray(failedData) ? failedData : failedData?.failed_jobs || []);

      if (isInitialLoad) {
        setLoading(false);
        setIsInitialLoad(false);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      if (isInitialLoad) {
        setLoading(false);
        setIsInitialLoad(false);
      }
    }
  };

  const retryTask = async (taskId) => {
    try {
      await api.post(`/provisioning/retry/${taskId}`);
      toast.success('Task retry initiated');
      fetchData();
    } catch (error) {
      console.error('Error retrying task:', error);
      toast.error(error.message || 'Failed to retry task');
    }
  };

  const manualProvision = async () => {
    const serviceId = prompt('Enter service ID to provision:');
    if (!serviceId) return;

    const customerId = prompt('Enter customer ID for this service:');
    const productId = prompt('Enter product ID:');
    const domain = prompt('Enter domain for the service:');

    if (!customerId || !productId || !domain) {
      toast.error('All fields are required to queue provisioning');
      return;
    }

    try {
      const data = await api.post('/provisioning/provision', {
        serviceId,
        customerId,
        productId,
        domain,
      });

      toast.success(`Provisioning job created: ${data.jobId || 'queued'}`);
      fetchData();
    } catch (error) {
      console.error('Error creating provisioning job:', error);
      toast.error(error.message || 'Failed to create provisioning job');
    }
  };

  const clearFailedJobs = async () => {
    if (!confirm('Are you sure you want to clear all failed jobs?')) return;

    try {
      await api.delete('/provisioning/failed');
      toast.success('Failed jobs cleared');
      fetchData();
    } catch (error) {
      console.error('Error clearing failed jobs:', error);
      toast.error(error.message || 'Failed to clear failed jobs');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return CheckCircleIcon;
      case 'processing': return ArrowPathIcon;
      case 'pending': return ClockIcon;
      case 'failed': return XCircleIcon;
      default: return ClockIcon;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ArrowPathIcon className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automated Provisioning</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor and manage hosting account provisioning
          </p>
        </div>
        <button
          onClick={fetchData}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <ArrowPathIcon className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ClockIcon className="h-6 w-6 text-yellow-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Pending
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats.pending || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ArrowPathIcon className="h-6 w-6 text-blue-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Processing
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats.processing || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircleIcon className="h-6 w-6 text-green-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Completed
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats.completed || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <XCircleIcon className="h-6 w-6 text-red-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Failed
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats.failed || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`${
              activeTab === 'overview'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            <ChartBarIcon className="w-5 h-5 inline-block mr-2" />
            Overview
          </button>

          <button
            onClick={() => setActiveTab('tasks')}
            className={`${
              activeTab === 'tasks'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            <ServerIcon className="w-5 h-5 inline-block mr-2" />
            Tasks ({tasks.length})
          </button>

          <button
            onClick={() => setActiveTab('failed')}
            className={`${
              activeTab === 'failed'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            <ExclamationTriangleIcon className="w-5 h-5 inline-block mr-2" />
            Failed Jobs ({failedJobs.length})
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && stats && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Queue Statistics</h3>
          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="px-4 py-5 bg-gray-50 shadow rounded-lg overflow-hidden sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">
                Total Processed Today
              </dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">
                {(stats.completed || 0) + (stats.failed || 0)}
              </dd>
            </div>

            <div className="px-4 py-5 bg-gray-50 shadow rounded-lg overflow-hidden sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">
                Success Rate
              </dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">
                {stats.completed && (stats.completed + stats.failed) > 0
                  ? `${Math.round((stats.completed / (stats.completed + stats.failed)) * 100)}%`
                  : '0%'}
              </dd>
            </div>

            <div className="px-4 py-5 bg-gray-50 shadow rounded-lg overflow-hidden sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">
                In Queue
              </dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">
                {(stats.pending || 0) + (stats.processing || 0)}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {/* Tasks Tab */}
      {activeTab === 'tasks' && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Provisioning Tasks</h3>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="block pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Task ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Domain
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Started
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">
                      No tasks found
                    </td>
                  </tr>
                ) : (
                  tasks.map((task) => {
                    const StatusIcon = getStatusIcon(task.status);
                    const taskIdDisplay = task.id ? String(task.id) : 'N/A';
                    return (
                      <tr key={task.id || task.domain || Math.random()}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {taskIdDisplay.length > 8 ? `${taskIdDisplay.substring(0, 8)}...` : taskIdDisplay}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {task.domain || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                            <StatusIcon className="w-4 h-4 mr-1" />
                            {task.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {task.started_at ? new Date(task.started_at).toLocaleString() : 'Not started'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => setSelectedTask(task)}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            View
                          </button>
                          {task.status === 'failed' && (
                            <button
                              onClick={() => retryTask(task.id)}
                              className="text-green-600 hover:text-green-900"
                            >
                              Retry
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Failed Jobs Tab */}
      {activeTab === 'failed' && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Failed Jobs</h3>
              {failedJobs.length > 0 && (
                <button
                  onClick={clearFailedJobs}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                >
                  Clear All Failed
                </button>
              )}
            </div>
          </div>
          <div className="p-6">
            {failedJobs.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircleIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No failed jobs</h3>
                <p className="mt-1 text-sm text-gray-500">
                  All provisioning jobs are processing successfully!
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {failedJobs.map((jobWrapper) => {
                  const job = jobWrapper.job || jobWrapper;
                  const key = job.id || jobWrapper.failedAt || Math.random();
                  return (
                    <li key={key} className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            Job ID: {job.id || 'unknown'}
                          </p>
                          <p className="text-sm text-gray-500">
                            Attempt {job.attempts ?? 0} of {job.maxRetries ?? 3}
                          </p>
                          {(jobWrapper.error || job.lastError) && (
                            <p className="mt-1 text-sm text-red-600">
                              Error: {jobWrapper.error || job.lastError}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => retryTask(job.id)}
                          className="ml-4 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <ArrowPathIcon className="w-4 h-4 mr-2" />
                          Retry
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setSelectedTask(null)}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div>
                <div className="mt-3 sm:mt-5">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Task Details
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-500">Task ID:</span>
                      <p className="mt-1 text-sm text-gray-900">{selectedTask.id}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Status:</span>
                      <p className="mt-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedTask.status)}`}>
                          {selectedTask.status}
                        </span>
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Domain:</span>
                      <p className="mt-1 text-sm text-gray-900">{selectedTask.domain || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Started:</span>
                      <p className="mt-1 text-sm text-gray-900">
                        {selectedTask.started_at ? new Date(selectedTask.started_at).toLocaleString() : 'Not started'}
                      </p>
                    </div>
                    {selectedTask.completed_at && (
                      <div>
                        <span className="text-sm font-medium text-gray-500">Completed:</span>
                        <p className="mt-1 text-sm text-gray-900">
                          {new Date(selectedTask.completed_at).toLocaleString()}
                        </p>
                      </div>
                    )}
                    {selectedTask.result && (
                      <div>
                        <span className="text-sm font-medium text-gray-500">Result:</span>
                        <pre className="mt-1 text-xs text-gray-900 bg-gray-50 p-2 rounded overflow-auto max-h-60">
                          {JSON.stringify(selectedTask.result, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-6">
                <button
                  type="button"
                  onClick={() => setSelectedTask(null)}
                  className="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
