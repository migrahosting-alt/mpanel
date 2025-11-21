import React, { useEffect, useState } from 'react';
import { ChartBarIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline';
import { analyticsApi } from '../lib/api';
import toast from 'react-hot-toast';

export default function Analytics() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const response = await analyticsApi.overview(timeRange);
      setStats(response.data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const metrics = [
    { name: 'Total Revenue', value: '$12,450', change: '+12.5%', trend: 'up' },
    { name: 'Active Users', value: '1,234', change: '+8.2%', trend: 'up' },
    { name: 'Server Uptime', value: '99.98%', change: '+0.02%', trend: 'up' },
    { name: 'Avg Response Time', value: '125ms', change: '-15.3%', trend: 'down' },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics & BI</h1>
          <p className="mt-1 text-sm text-gray-500">
            Business intelligence and performance metrics
          </p>
        </div>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
        </select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => (
          <div key={metric.name} className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{metric.name}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{metric.value}</p>
              </div>
              {metric.trend === 'up' ? (
                <ArrowTrendingUpIcon className="h-8 w-8 text-green-500" />
              ) : (
                <ArrowTrendingDownIcon className="h-8 w-8 text-red-500" />
              )}
            </div>
            <p className={`text-sm mt-2 ${metric.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
              {metric.change} from last period
            </p>
          </div>
        ))}
      </div>

      {/* Charts Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h3>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded">
            <ChartBarIcon className="h-16 w-16 text-gray-300" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Resource Usage</h3>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded">
            <ChartBarIcon className="h-16 w-16 text-gray-300" />
          </div>
        </div>
      </div>
    </div>
  );
}
