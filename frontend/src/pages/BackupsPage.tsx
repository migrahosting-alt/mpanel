// frontend/src/pages/BackupsPage.tsx
import React, { useState, useEffect } from 'react';
import {
  CloudArrowDownIcon,
  CloudArrowUpIcon,
  TrashIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { apiClient } from '../lib/apiClient';
import toast from 'react-hot-toast';

interface Backup {
  id: number;
  name: string;
  type: string;
  resource_type: string;
  resource_id: number;
  description: string;
  size: number;
  status: string;
  error: string;
  created_at: string;
  completed_at: string;
}

interface BackupSchedule {
  id: number;
  resource_type: string;
  resource_id: number;
  frequency: string;
  retention_days: number;
  enabled: boolean;
  last_run: string;
  next_run: string;
}

interface Resource {
  id: number;
  name?: string;
  domain?: string;
  email?: string;
}

export default function BackupsPage() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewBackupModal, setShowNewBackupModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [resources, setResources] = useState<{ [key: string]: Resource[] }>({});
  const [newBackup, setNewBackup] = useState({
    type: 'manual',
    resource_type: 'website',
    resource_id: '',
    description: '',
  });
  const [newSchedule, setNewSchedule] = useState({
    resource_type: 'website',
    resource_id: '',
    frequency: 'daily',
    retention_days: 30,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [backupsRes, schedulesRes] = await Promise.all([
        apiClient.get('/backups'),
        apiClient.get('/backups/schedules/list'),
      ]);
      setBackups(backupsRes.data.backups);
      setSchedules(schedulesRes.data.schedules);
    } catch (error: any) {
      console.error('Failed to fetch backups:', error);
      // Don't show error toast for features not yet implemented
      if (error?.response?.status !== 404 && error?.response?.status !== 501) {
        toast.error('Failed to fetch backups');
      }
      setBackups([]);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchResources = async () => {
    try {
      const [websites, databases, emails] = await Promise.all([
        apiClient.get('/services/hosting'),
        apiClient.get('/services/databases'),
        apiClient.get('/services/email-accounts'),
      ]);
      setResources({
        website: websites.data.services || [],
        database: databases.data.services || [],
        email: emails.data.services || [],
      });
    } catch (error) {
      toast.error('Failed to fetch resources');
    }
  };

  const createBackup = async () => {
    try {
      const payload = {
        ...newBackup,
        resource_id: parseInt(newBackup.resource_id),
      };
      await apiClient.post('/backups', payload);
      toast.success('Backup initiated successfully');
      setShowNewBackupModal(false);
      setNewBackup({
        type: 'manual',
        resource_type: 'website',
        resource_id: '',
        description: '',
      });
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create backup');
    }
  };

  const restoreBackup = async (backupId: number) => {
    if (!confirm('Are you sure you want to restore this backup? This will replace current data.')) {
      return;
    }

    try {
      await apiClient.post(`/backups/${backupId}/restore`);
      toast.success('Restore initiated successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to initiate restore');
    }
  };

  const deleteBackup = async (backupId: number) => {
    if (!confirm('Are you sure you want to delete this backup? This cannot be undone.')) {
      return;
    }

    try {
      await apiClient.delete(`/backups/${backupId}`);
      toast.success('Backup deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete backup');
    }
  };

  const createSchedule = async () => {
    try {
      const payload = {
        ...newSchedule,
        resource_id: parseInt(newSchedule.resource_id),
      };
      await apiClient.post('/backups/schedules', payload);
      toast.success('Backup schedule created successfully');
      setShowScheduleModal(false);
      setNewSchedule({
        resource_type: 'website',
        resource_id: '',
        frequency: 'daily',
        retention_days: 30,
      });
      fetchData();
    } catch (error) {
      toast.error('Failed to create backup schedule');
    }
  };

  const toggleSchedule = async (scheduleId: number, enabled: boolean) => {
    try {
      await apiClient.put(`/backups/schedules/${scheduleId}`, { enabled: !enabled });
      toast.success(`Schedule ${!enabled ? 'enabled' : 'disabled'}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update schedule');
    }
  };

  const deleteSchedule = async (scheduleId: number) => {
    if (!confirm('Are you sure you want to delete this backup schedule?')) {
      return;
    }

    try {
      await apiClient.delete(`/backups/schedules/${scheduleId}`);
      toast.success('Backup schedule deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete backup schedule');
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: { color: string; icon: any } } = {
      completed: { color: 'bg-green-100 text-green-800', icon: CheckCircleIcon },
      in_progress: { color: 'bg-blue-100 text-blue-800', icon: ArrowPathIcon },
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: ClockIcon },
      failed: { color: 'bg-red-100 text-red-800', icon: XCircleIcon },
    };

    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="h-4 w-4 mr-1" />
        {status.replace('_', ' ')}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show "Coming Soon" state if module not implemented
  if (backups.length === 0 && schedules.length === 0 && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Backups & Restore</h1>
          <p className="text-gray-600 mt-1">Manage backups and schedules for your resources</p>
        </div>
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <CloudArrowUpIcon className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Backups Coming Soon
          </h3>
          <p className="text-slate-600 mb-4 max-w-md mx-auto">
            Automated backup and restore functionality is not enabled yet in your environment.
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
          <h1 className="text-2xl font-bold text-gray-900">Backups & Restore</h1>
          <p className="text-gray-600 mt-1">Manage backups and schedules for your resources</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              fetchResources();
              setShowScheduleModal(true);
            }}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2"
          >
            <ClockIcon className="h-5 w-5" />
            New Schedule
          </button>
          <button
            onClick={() => {
              fetchResources();
              setShowNewBackupModal(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <CloudArrowUpIcon className="h-5 w-5" />
            New Backup
          </button>
        </div>
      </div>

      {/* Backup Schedules */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Backup Schedules</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resource</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Frequency</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Retention</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Run</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Next Run</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {schedules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No backup schedules configured
                  </td>
                </tr>
              ) : (
                schedules.map((schedule) => (
                  <tr key={schedule.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {schedule.resource_type} #{schedule.resource_id}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 capitalize">{schedule.frequency}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{schedule.retention_days} days</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {schedule.last_run ? new Date(schedule.last_run).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {schedule.next_run ? new Date(schedule.next_run).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => toggleSchedule(schedule.id, schedule.enabled)}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          schedule.enabled
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {schedule.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={() => deleteSchedule(schedule.id)}
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

      {/* Backups List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Backup History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resource</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <CloudArrowUpIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 mb-3">No backups yet</p>
                    <button
                      onClick={() => {
                        fetchResources();
                        setShowNewBackupModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      Create your first backup
                    </button>
                  </td>
                </tr>
              ) : (
                backups.map((backup) => (
                  <tr key={backup.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{backup.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 capitalize">{backup.type}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {backup.resource_type} #{backup.resource_id}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatBytes(backup.size)}</td>
                    <td className="px-4 py-3">{getStatusBadge(backup.status)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(backup.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                      {backup.status === 'completed' && (
                        <button
                          onClick={() => restoreBackup(backup.id)}
                          className="text-green-600 hover:text-green-700 mr-3"
                          title="Restore backup"
                        >
                          <CloudArrowDownIcon className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteBackup(backup.id)}
                        className="text-red-600 hover:text-red-700"
                        title="Delete backup"
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

      {/* New Backup Modal */}
      {showNewBackupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create Backup</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Resource Type</label>
                <select
                  value={newBackup.resource_type}
                  onChange={(e) => setNewBackup({ ...newBackup, resource_type: e.target.value, resource_id: '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="website">Website</option>
                  <option value="database">Database</option>
                  <option value="email">Email Account</option>
                  <option value="full">Full Account</option>
                </select>
              </div>

              {newBackup.resource_type !== 'full' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Resource</label>
                  <select
                    value={newBackup.resource_id}
                    onChange={(e) => setNewBackup({ ...newBackup, resource_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select resource...</option>
                    {(resources[newBackup.resource_type] || []).map((resource: Resource) => (
                      <option key={resource.id} value={resource.id}>
                        {resource.name || resource.domain || resource.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description (optional)</label>
                <textarea
                  value={newBackup.description}
                  onChange={(e) => setNewBackup({ ...newBackup, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Add a note about this backup..."
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowNewBackupModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createBackup}
                disabled={newBackup.resource_type !== 'full' && !newBackup.resource_id}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
              >
                Create Backup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create Backup Schedule</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Resource Type</label>
                <select
                  value={newSchedule.resource_type}
                  onChange={(e) => setNewSchedule({ ...newSchedule, resource_type: e.target.value, resource_id: '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="website">Website</option>
                  <option value="database">Database</option>
                  <option value="email">Email Account</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Resource</label>
                <select
                  value={newSchedule.resource_id}
                  onChange={(e) => setNewSchedule({ ...newSchedule, resource_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select resource...</option>
                  {(resources[newSchedule.resource_type] || []).map((resource: Resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.name || resource.domain || resource.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
                <select
                  value={newSchedule.frequency}
                  onChange={(e) => setNewSchedule({ ...newSchedule, frequency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Retention (days)</label>
                <input
                  type="number"
                  value={newSchedule.retention_days}
                  onChange={(e) => setNewSchedule({ ...newSchedule, retention_days: parseInt(e.target.value) })}
                  min="1"
                  max="365"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createSchedule}
                disabled={!newSchedule.resource_id}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
              >
                Create Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
