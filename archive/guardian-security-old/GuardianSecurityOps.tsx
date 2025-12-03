import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheckIcon, ExclamationTriangleIcon, BoltIcon, CheckCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { api } from '../../lib/apiClient';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

interface GuardianSecurityOverview {
  activeInstances: number;
  openFindings: number;
  pendingTasks: number;
  recentScans: GuardianSecurityScan[];
}

interface GuardianSecurityScan {
  id: string;
  status: string;
  findingsCount: number;
  createdAt: string;
  securityInstance?: {
    id: string;
    name: string;
  };
  server?: {
    id: string;
    name: string;
    ipAddress: string;
  };
}

interface GuardianSecurityFinding {
  id: string;
  title: string;
  severity: string;
  status: string;
  remediationStatus?: string | null;
  guardianInstanceId?: string | null;
  server?: {
    id: string;
    name: string;
    ipAddress?: string;
  } | null;
  scan?: {
    id: string;
    status: string;
  } | null;
  openedAt?: string;
  createdAt?: string;
}

interface GuardianSecurityRemediationTask {
  id: string;
  status: string;
  mode?: string | null;
  severity?: string | null;
  findingId?: string | null;
  server?: {
    id: string;
    name: string;
  } | null;
  finding?: {
    id: string;
    title: string;
    severity: string;
  } | null;
  createdAt: string;
  updatedAt?: string;
}

type LoadingKey = 'overview' | 'scans' | 'findings' | 'tasks';

type LoadingState = Record<LoadingKey, boolean>;

const classNames = (...classes: Array<string | boolean | null | undefined>) =>
  classes.filter(Boolean).join(' ');

const severityStyles: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-blue-100 text-blue-700',
  info: 'bg-gray-100 text-gray-700',
};

const statusStyles: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  acknowledged: 'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700',
  pending: 'bg-gray-100 text-gray-700',
  awaiting_approval: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-700',
};

const findingStatusOptions = [
  { label: 'Open', value: 'open' },
  { label: 'Acknowledged', value: 'acknowledged' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'All statuses', value: 'all' },
];

const severityOptions = [
  { label: 'All severities', value: 'all' },
  { label: 'Critical', value: 'critical' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
  { label: 'Info', value: 'info' },
];

const remediationStatusOptions = [
  { label: 'Pending', value: 'pending' },
  { label: 'Awaiting Approval', value: 'awaiting_approval' },
  { label: 'Approved', value: 'approved' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'All statuses', value: 'all' },
];

const GuardianSecurityOps: React.FC = () => {
  const [overview, setOverview] = useState<GuardianSecurityOverview | null>(null);
  const [scans, setScans] = useState<GuardianSecurityScan[]>([]);
  const [findings, setFindings] = useState<GuardianSecurityFinding[]>([]);
  const [remediationTasks, setRemediationTasks] = useState<GuardianSecurityRemediationTask[]>([]);
  const [loading, setLoading] = useState<LoadingState>({
    overview: true,
    scans: true,
    findings: true,
    tasks: true,
  });
  const [findingStatus, setFindingStatus] = useState('open');
  const [findingSeverity, setFindingSeverity] = useState('all');
  const [taskStatus, setTaskStatus] = useState('pending');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const setLoadingFlag = useCallback((key: LoadingKey, value: boolean) => {
    setLoading((prev) => ({ ...prev, [key]: value }));
  }, []);

  const formatDate = useCallback((value?: string) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }, []);

  const fetchOverviewAndScans = useCallback(async () => {
    setLoadingFlag('overview', true);
    setLoadingFlag('scans', true);
    try {
      const [overviewResponse, scansResponse] = await Promise.all([
        api.get<ApiResponse<GuardianSecurityOverview>>('/guardian/security/overview'),
        api.get<ApiResponse<GuardianSecurityScan[]>>('/guardian/security/scans', {
          params: { pageSize: 5 },
        }),
      ]);

      setOverview(overviewResponse.data);
      setScans(scansResponse.data ?? []);
    } catch (error: any) {
      toast.error(error?.message ?? 'Unable to load Guardian security overview');
    } finally {
      setLoadingFlag('overview', false);
      setLoadingFlag('scans', false);
    }
  }, [setLoadingFlag]);

  const fetchFindings = useCallback(async () => {
    setLoadingFlag('findings', true);
    try {
      const response = await api.get<ApiResponse<GuardianSecurityFinding[]>>('/guardian/security/findings', {
        params: {
          status: findingStatus !== 'all' ? findingStatus : undefined,
          severity: findingSeverity !== 'all' ? findingSeverity : undefined,
          pageSize: 15,
        },
      });
      setFindings(response.data ?? []);
    } catch (error: any) {
      toast.error(error?.message ?? 'Unable to load findings');
    } finally {
      setLoadingFlag('findings', false);
    }
  }, [findingStatus, findingSeverity, setLoadingFlag]);

  const fetchRemediationTasks = useCallback(async () => {
    setLoadingFlag('tasks', true);
    try {
      const response = await api.get<ApiResponse<GuardianSecurityRemediationTask[]>>(
        '/guardian/security/remediation-tasks',
        {
          params: {
            status: taskStatus !== 'all' ? taskStatus : undefined,
            pageSize: 20,
          },
        }
      );
      setRemediationTasks(response.data ?? []);
    } catch (error: any) {
      toast.error(error?.message ?? 'Unable to load remediation queue');
    } finally {
      setLoadingFlag('tasks', false);
    }
  }, [taskStatus, setLoadingFlag]);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchOverviewAndScans(), fetchFindings(), fetchRemediationTasks()]);
    setIsRefreshing(false);
  }, [fetchOverviewAndScans, fetchFindings, fetchRemediationTasks]);

  useEffect(() => {
    fetchOverviewAndScans();
  }, [fetchOverviewAndScans]);

  useEffect(() => {
    fetchFindings();
  }, [fetchFindings]);

  useEffect(() => {
    fetchRemediationTasks();
  }, [fetchRemediationTasks]);

  const openFindings = useMemo(() => findings.length, [findings]);

  const updateTaskStatus = async (taskId: string, status: string) => {
    try {
      await api.patch(`/guardian/security/remediation-tasks/${taskId}`, { status });
      toast.success('Remediation task updated');
      fetchRemediationTasks();
      if (status === 'completed') {
        fetchFindings();
      }
    } catch (error: any) {
      toast.error(error?.message ?? 'Unable to update task');
    }
  };

  const renderSeverityPill = (severity?: string | null) => {
    if (!severity) {
      return <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">n/a</span>;
    }
    const normalized = severity.toLowerCase();
    return (
      <span className={classNames('px-2 py-0.5 rounded-full text-xs font-semibold', severityStyles[normalized] || 'bg-gray-100 text-gray-700')}>
        {severity.toUpperCase()}
      </span>
    );
  };

  const renderStatusPill = (status?: string) => {
    if (!status) return null;
    const normalized = status.toLowerCase();
    return (
      <span className={classNames('px-2 py-0.5 rounded-full text-xs font-semibold', statusStyles[normalized] || 'bg-gray-100 text-gray-700')}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  const renderTaskActions = (task: GuardianSecurityRemediationTask) => {
    const actions: Array<{ label: string; status: string; show: boolean; tone?: 'primary' | 'danger' }>= [
      { label: 'Approve', status: 'approved', show: ['pending', 'awaiting_approval'].includes(task.status) },
      { label: 'Start Fix', status: 'in_progress', show: ['pending', 'approved'].includes(task.status) },
      { label: 'Complete', status: 'completed', show: task.status === 'in_progress', tone: 'primary' },
      { label: 'Cancel', status: 'cancelled', show: ['pending', 'awaiting_approval', 'in_progress'].includes(task.status), tone: 'danger' },
    ];

    return (
      <div className="flex flex-wrap gap-2">
        {actions.filter((action) => action.show).map((action) => (
          <button
            key={`${task.id}-${action.status}`}
            onClick={() => updateTaskStatus(task.id, action.status)}
            className={classNames(
              'px-3 py-1 text-xs font-semibold rounded-lg border transition-colors',
              action.tone === 'danger' && 'border-red-200 text-red-600 hover:bg-red-50',
              action.tone === 'primary' && 'border-green-200 text-green-700 hover:bg-green-50',
              !action.tone && 'border-blue-200 text-blue-600 hover:bg-blue-50'
            )}
          >
            {action.label}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-wide">Guardian Security</p>
          <h1 className="text-3xl font-bold text-gray-900 mt-1">Security Operations Center</h1>
          <p className="text-gray-600 mt-2 max-w-2xl">
            Monitor agent-delivered scan results, triage findings, and progress remediation tasks in one place.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refreshAll}
            disabled={isRefreshing}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold shadow hover:bg-gray-800 disabled:opacity-50"
          >
            <ArrowPathIcon className={classNames('h-5 w-5 mr-2', isRefreshing && 'animate-spin')} />
            {isRefreshing ? 'Refreshing...' : 'Refresh data'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Instances</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {loading.overview ? '—' : overview?.activeInstances ?? 0}
              </p>
            </div>
            <ShieldCheckIcon className="h-12 w-12 text-primary-500" />
          </div>
          <p className="text-xs text-gray-500 mt-3">Guardrails currently enforcing policies</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Open Findings</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {loading.findings ? '—' : overview?.openFindings ?? openFindings}
              </p>
            </div>
            <ExclamationTriangleIcon className="h-12 w-12 text-orange-500" />
          </div>
          <p className="text-xs text-gray-500 mt-3">Requires investigation or remediation</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending Tasks</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {loading.tasks ? '—' : overview?.pendingTasks ?? remediationTasks.length}
              </p>
            </div>
            <BoltIcon className="h-12 w-12 text-amber-500" />
          </div>
          <p className="text-xs text-gray-500 mt-3">Awaiting operator action</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Recent Scans</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {loading.scans ? '—' : overview?.recentScans.length ?? scans.length}
              </p>
            </div>
            <CheckCircleIcon className="h-12 w-12 text-green-500" />
          </div>
          <p className="text-xs text-gray-500 mt-3">Last 5 Guardian agent scans</p>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Active Findings</h2>
            <p className="text-sm text-gray-500">Prioritize by severity and status to focus remediation work.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={findingStatus}
              onChange={(event) => setFindingStatus(event.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
            >
              {findingStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={findingSeverity}
              onChange={(event) => setFindingSeverity(event.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
            >
              {severityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          {loading.findings ? (
            <div className="p-8 text-center text-gray-500">Loading findings…</div>
          ) : findings.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No findings match the current filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Finding</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Severity</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Server</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Opened</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {findings.map((finding) => (
                    <tr key={finding.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{finding.title}</p>
                        <p className="text-sm text-gray-500">{finding.scan ? `Scan ${finding.scan.id}` : 'Ad-hoc'}</p>
                      </td>
                      <td className="px-6 py-4">{renderSeverityPill(finding.severity)}</td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-900">{finding.server?.name ?? 'Unassigned'}</p>
                        {finding.server?.ipAddress && (
                          <p className="text-xs text-gray-500">{finding.server.ipAddress}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 space-y-1">
                        {renderStatusPill(finding.status)}
                        {finding.remediationStatus && renderStatusPill(finding.remediationStatus)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(finding.openedAt ?? finding.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Remediation Queue</h2>
            <p className="text-sm text-gray-500">Approve, start, and resolve tasks dispatched from Guardian agents.</p>
          </div>
          <select
            value={taskStatus}
            onChange={(event) => setTaskStatus(event.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
          >
            {remediationStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          {loading.tasks ? (
            <div className="p-8 text-center text-gray-500">Loading remediation tasks…</div>
          ) : remediationTasks.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No remediation tasks for this filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Task</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Finding</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Server</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {remediationTasks.map((task) => (
                    <tr key={task.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{task.mode?.replace('_', ' ') || 'Remediation'}</p>
                        {task.severity && renderSeverityPill(task.severity)}
                      </td>
                      <td className="px-6 py-4">
                        {task.finding ? (
                          <>
                            <p className="font-medium text-gray-900">{task.finding.title}</p>
                            <p className="text-xs text-gray-500">ID: {task.finding.id}</p>
                          </>
                        ) : (
                          <p className="text-sm text-gray-500">Unlinked finding</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-900">{task.server?.name ?? 'Unassigned'}</p>
                      </td>
                      <td className="px-6 py-4">{renderStatusPill(task.status)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(task.createdAt)}</td>
                      <td className="px-6 py-4">
                        {renderTaskActions(task)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Recent Agent Scans</h2>
            <p className="text-sm text-gray-500">Latest telemetry from Guardian deployment targets.</p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          {loading.scans ? (
            <div className="p-8 text-center text-gray-500">Loading scan activity…</div>
          ) : scans.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No scans recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Scan ID</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Instance</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Findings</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {scans.map((scan) => (
                    <tr key={scan.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-mono text-sm text-gray-900">{scan.id}</p>
                        {scan.server?.ipAddress && (
                          <p className="text-xs text-gray-500">{scan.server.ipAddress}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-900">{scan.securityInstance?.name ?? 'Standalone'}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{scan.findingsCount}</td>
                      <td className="px-6 py-4">{renderStatusPill(scan.status)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(scan.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default GuardianSecurityOps;
