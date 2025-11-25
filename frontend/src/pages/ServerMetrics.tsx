import React, { useState, useEffect } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { format } from 'date-fns';
import { apiClient } from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';
import LoadingSkeleton from '../components/LoadingSkeleton';
import toast from 'react-hot-toast';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface Agent {
  id: string;
  hostname: string;
  os: string;
  status: 'online' | 'offline';
  last_seen: string;
}

interface Metrics {
  timestamp: string;
  cpu: {
    usage: number;
    load: { one: number; five: number; fifteen: number };
    cores: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
    swap: { total: number; used: number; free: number };
  };
  disk: Array<{
    mountpoint: string;
    total: number;
    used: number;
    available: number;
    percentage: number;
    filesystem: string;
  }>;
  network: Array<{
    interface: string;
    bytesSent: number;
    bytesReceived: number;
    packetsSent: number;
    packetsReceived: number;
    errors: number;
    drops: number;
  }>;
}

type TimeRange = '1h' | '6h' | '24h' | '7d';

const timeRangeOptions: { value: TimeRange; label: string }[] = [
  { value: '1h', label: 'Last Hour' },
  { value: '6h', label: 'Last 6 Hours' },
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
];

export default function ServerMetrics() {
  const { token } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Fetch agents list
  const fetchAgents = async () => {
    try {
      const response = await apiClient.get('/agents', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAgents(response.data.agents || []);
      
      // Auto-select first online agent
      if (response.data.agents?.length > 0 && !selectedAgent) {
        const onlineAgent = response.data.agents.find((a: Agent) => a.status === 'online');
        setSelectedAgent(onlineAgent?.id || response.data.agents[0].id);
      }
    } catch (error: any) {
      console.error('Error fetching agents:', error);
      toast.error('Failed to load agents');
    }
  };

  // Fetch metrics for selected agent
  const fetchMetrics = async (agentId: string, range: TimeRange, isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const response = await apiClient.get(`/agents/${agentId}/metrics`, {
        params: { timeRange: range },
        headers: { Authorization: `Bearer ${token}` },
      });

      setMetrics(response.data.metrics || []);
      setLastUpdate(new Date());
    } catch (error: any) {
      console.error('Error fetching metrics:', error);
      toast.error('Failed to load metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchAgents();
  }, []);

  // Auto-refresh metrics every 60 seconds
  useEffect(() => {
    if (selectedAgent) {
      fetchMetrics(selectedAgent, timeRange);

      const interval = setInterval(() => {
        fetchMetrics(selectedAgent, timeRange, true);
      }, 60000); // 60 seconds

      return () => clearInterval(interval);
    }
  }, [selectedAgent, timeRange]);

  // Manual refresh
  const handleRefresh = () => {
    if (selectedAgent) {
      fetchMetrics(selectedAgent, timeRange, true);
    }
  };

  // Export metrics to CSV
  const handleExportCSV = () => {
    if (metrics.length === 0) {
      toast.error('No data to export');
      return;
    }

    const csvHeaders = [
      'Timestamp',
      'CPU Usage (%)',
      'CPU Load 1m',
      'CPU Load 5m',
      'CPU Load 15m',
      'Memory Usage (%)',
      'Memory Used (MB)',
      'Memory Total (MB)',
      'Disk Usage (%)',
      'Network Sent (MB)',
      'Network Received (MB)',
    ].join(',');

    const csvRows = metrics.map((m) => {
      const diskUsage = m.disk[0]?.percentage || 0;
      const networkSent = m.network.reduce((sum, n) => sum + n.bytesSent, 0) / (1024 * 1024);
      const networkReceived = m.network.reduce((sum, n) => sum + n.bytesReceived, 0) / (1024 * 1024);

      return [
        format(new Date(m.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        m.cpu.usage.toFixed(2),
        m.cpu.load.one.toFixed(2),
        m.cpu.load.five.toFixed(2),
        m.cpu.load.fifteen.toFixed(2),
        m.memory.percentage.toFixed(2),
        (m.memory.used / (1024 * 1024)).toFixed(2),
        (m.memory.total / (1024 * 1024)).toFixed(2),
        diskUsage.toFixed(2),
        networkSent.toFixed(2),
        networkReceived.toFixed(2),
      ].join(',');
    });

    const csvContent = [csvHeaders, ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `metrics-${currentAgent?.hostname}-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Metrics exported to CSV');
  };

  // Get current agent status
  const currentAgent = agents.find((a) => a.id === selectedAgent);
  const latestMetrics = metrics.length > 0 ? metrics[metrics.length - 1] : null;

  // Check for critical metrics
  const criticalAlerts = [];
  if (latestMetrics) {
    if (latestMetrics.cpu.usage > 90) {
      criticalAlerts.push({ type: 'CPU', value: latestMetrics.cpu.usage, threshold: 90 });
    }
    if (latestMetrics.memory.percentage > 90) {
      criticalAlerts.push({ type: 'Memory', value: latestMetrics.memory.percentage, threshold: 90 });
    }
    latestMetrics.disk.forEach((disk) => {
      if (disk.percentage > 90) {
        criticalAlerts.push({ type: `Disk (${disk.mountpoint})`, value: disk.percentage, threshold: 90 });
      }
    });
  }

  // Prepare chart data
  const cpuChartData = {
    labels: metrics.map((m) => format(new Date(m.timestamp), 'HH:mm')),
    datasets: [
      {
        label: 'CPU Usage (%)',
        data: metrics.map((m) => m.cpu.usage),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const memoryChartData = {
    labels: metrics.map((m) => format(new Date(m.timestamp), 'HH:mm')),
    datasets: [
      {
        label: 'Memory Usage (%)',
        data: metrics.map((m) => m.memory.percentage),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
      },
    },
  };

  if (loading && !metrics.length) {
    return (
      <div className="p-6">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Server Metrics
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Monitor your server performance in real-time
        </p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-4">
          {/* Agent Selector */}
          <div>
            <label htmlFor="agent-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Server
            </label>
            <select
              id="agent-select"
              value={selectedAgent || ''}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">Select a server</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.hostname} ({agent.status})
                </option>
              ))}
            </select>
          </div>

          {/* Time Range Selector */}
          <div>
            <label htmlFor="time-range-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Time Range
            </label>
            <select
              id="time-range-select"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {timeRangeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Refresh Button */}
        <div className="flex items-center gap-4">
          {lastUpdate && (
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Last update: {format(lastUpdate, 'HH:mm:ss')}
            </span>
          )}
          <button
            onClick={handleExportCSV}
            disabled={metrics.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export CSV
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Agent Status */}
      {currentAgent && (
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {currentAgent.hostname}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {currentAgent.os}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  currentAgent.status === 'online'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full mr-2 ${
                    currentAgent.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                {currentAgent.status}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Critical Alerts */}
      {criticalAlerts.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Critical Resource Usage Detected
              </h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                <ul className="list-disc pl-5 space-y-1">
                  {criticalAlerts.map((alert, index) => (
                    <li key={index}>
                      {alert.type} usage at {alert.value.toFixed(1)}% (threshold: {alert.threshold}%)
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Current Metrics Cards */}
      {latestMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {/* CPU Card */}
          <MetricCard
            title="CPU Usage"
            value={`${latestMetrics.cpu.usage.toFixed(1)}%`}
            percentage={latestMetrics.cpu.usage}
            subtitle={`Load: ${latestMetrics.cpu.load.one.toFixed(2)}`}
          />

          {/* Memory Card */}
          <MetricCard
            title="Memory Usage"
            value={`${latestMetrics.memory.percentage.toFixed(1)}%`}
            percentage={latestMetrics.memory.percentage}
            subtitle={`${formatBytes(latestMetrics.memory.used)} / ${formatBytes(latestMetrics.memory.total)}`}
          />

          {/* Disk Card */}
          <MetricCard
            title="Disk Usage"
            value={`${latestMetrics.disk[0]?.percentage.toFixed(1) || 0}%`}
            percentage={latestMetrics.disk[0]?.percentage || 0}
            subtitle={latestMetrics.disk[0]?.mountpoint || '/'}
          />

          {/* Network Card */}
          <MetricCard
            title="Network Traffic"
            value={formatBytes(
              latestMetrics.network.reduce((sum, n) => sum + n.bytesSent + n.bytesReceived, 0)
            )}
            subtitle="Total transferred"
          />
        </div>
      )}

      {/* Charts */}
      {metrics.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CPU Chart */}
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              CPU Usage Over Time
            </h3>
            <div className="h-64">
              <Line data={cpuChartData} options={chartOptions} />
            </div>
          </div>

          {/* Memory Chart */}
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Memory Usage Over Time
            </h3>
            <div className="h-64">
              <Line data={memoryChartData} options={chartOptions} />
            </div>
          </div>

          {/* Disk Usage Chart */}
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Disk Usage by Mount Point
            </h3>
            <div className="h-64">
              <Bar
                data={{
                  labels: latestMetrics?.disk.map((d) => d.mountpoint) || [],
                  datasets: [
                    {
                      label: 'Disk Usage (%)',
                      data: latestMetrics?.disk.map((d) => d.percentage) || [],
                      backgroundColor: latestMetrics?.disk.map((d) =>
                        d.percentage > 90
                          ? 'rgba(239, 68, 68, 0.8)'
                          : d.percentage > 70
                          ? 'rgba(251, 191, 36, 0.8)'
                          : 'rgba(34, 197, 94, 0.8)'
                      ),
                    },
                  ],
                }}
                options={{
                  ...chartOptions,
                  indexAxis: 'y' as const,
                }}
              />
            </div>
          </div>

          {/* Network Chart */}
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Network Traffic Over Time
            </h3>
            <div className="h-64">
              <Line
                data={{
                  labels: metrics.map((m) => format(new Date(m.timestamp), 'HH:mm')),
                  datasets: [
                    {
                      label: 'Bytes Sent',
                      data: metrics.map((m) =>
                        m.network.reduce((sum, n) => sum + n.bytesSent, 0)
                      ),
                      borderColor: 'rgb(59, 130, 246)',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      tension: 0.4,
                    },
                    {
                      label: 'Bytes Received',
                      data: metrics.map((m) =>
                        m.network.reduce((sum, n) => sum + n.bytesReceived, 0)
                      ),
                      borderColor: 'rgb(16, 185, 129)',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      tension: 0.4,
                    },
                  ],
                }}
                options={chartOptions}
              />
            </div>
          </div>
        </div>
      )}

      {/* No Metrics Message */}
      {!selectedAgent && agents.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">
            No servers available. Please install and configure a server agent.
          </p>
        </div>
      )}

      {selectedAgent && metrics.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">
            No metrics data available for this time range.
          </p>
        </div>
      )}
    </div>
  );
}

// Metric Card Component
interface MetricCardProps {
  title: string;
  value: string;
  percentage?: number;
  subtitle?: string;
}

function MetricCard({ title, value, percentage, subtitle }: MetricCardProps) {
  const getStatusColor = (pct?: number) => {
    if (!pct) return 'text-blue-600 dark:text-blue-400';
    if (pct > 90) return 'text-red-600 dark:text-red-400';
    if (pct > 70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
      <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
        {title}
      </h3>
      <p className={`text-3xl font-bold ${getStatusColor(percentage)}`}>
        {value}
      </p>
      {subtitle && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>
      )}
      {percentage !== undefined && (
        <div className="mt-3">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                percentage > 90
                  ? 'bg-red-500'
                  : percentage > 70
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
              role="progressbar"
              aria-valuenow={Math.round(percentage)}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
