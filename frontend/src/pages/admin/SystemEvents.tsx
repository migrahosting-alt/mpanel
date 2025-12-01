import { useState, useEffect, useRef } from 'react';
import {
  BellAlertIcon,
  ArrowPathIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
  CheckCircleIcon,
  ShieldExclamationIcon,
  ServerIcon,
  CpuChipIcon,
  CloudIcon,
  WrenchScrewdriverIcon,
  SignalIcon,
  PlayIcon,
  PauseIcon,
} from '@heroicons/react/24/outline';

const API_BASE = '/api';

interface SystemEvent {
  id: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  source: 'api' | 'database' | 'server' | 'network' | 'security' | 'billing' | 'provisioning' | 'system';
  title: string;
  message: string;
  server?: string;
  details?: Record<string, any>;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export default function SystemEvents() {
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);
  const [liveMode, setLiveMode] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<SystemEvent | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const eventLogRef = useRef<HTMLDivElement>(null);
  const itemsPerPage = 30;

  const [filter, setFilter] = useState({
    severity: 'all',
    source: 'all',
    acknowledged: 'all',
    search: '',
  });

  const [stats, setStats] = useState({
    total: 0,
    info: 0,
    warning: 0,
    error: 0,
    critical: 0,
    unacknowledged: 0,
  });

  // Mock events data
  const mockEvents: SystemEvent[] = [
    { id: 'evt-001', timestamp: new Date(Date.now() - 30000).toISOString(), severity: 'info', source: 'api', title: 'API Request Rate Normal', message: 'API request rate has stabilized to normal levels.', acknowledged: true, acknowledgedBy: 'admin@migrahosting.com' },
    { id: 'evt-002', timestamp: new Date(Date.now() - 60000).toISOString(), severity: 'warning', source: 'server', title: 'High CPU Usage', message: 'Server cpanel-srv1 CPU usage exceeded 80% threshold.', server: 'cpanel-srv1', details: { cpu: 85, threshold: 80 }, acknowledged: false },
    { id: 'evt-003', timestamp: new Date(Date.now() - 120000).toISOString(), severity: 'error', source: 'database', title: 'Slow Query Detected', message: 'Query exceeded 5 second execution threshold.', details: { query: 'SELECT * FROM orders...', duration: '7.2s' }, acknowledged: false },
    { id: 'evt-004', timestamp: new Date(Date.now() - 180000).toISOString(), severity: 'critical', source: 'security', title: 'Brute Force Attempt Detected', message: 'Multiple failed login attempts from IP 185.220.101.1 - IP has been blocked.', details: { ip: '185.220.101.1', attempts: 15, blocked: true }, acknowledged: true, acknowledgedBy: 'security@migrahosting.com', acknowledgedAt: new Date(Date.now() - 150000).toISOString() },
    { id: 'evt-005', timestamp: new Date(Date.now() - 300000).toISOString(), severity: 'info', source: 'provisioning', title: 'Account Provisioned', message: 'Successfully provisioned cPanel account for example.com', details: { domain: 'example.com', server: 'cpanel-srv2', plan: 'Business' }, acknowledged: true },
    { id: 'evt-006', timestamp: new Date(Date.now() - 400000).toISOString(), severity: 'warning', source: 'network', title: 'High Latency Detected', message: 'Network latency to CloudFlare exceeded 100ms.', details: { latency: '145ms', target: 'cloudflare' }, acknowledged: false },
    { id: 'evt-007', timestamp: new Date(Date.now() - 500000).toISOString(), severity: 'error', source: 'billing', title: 'Payment Gateway Timeout', message: 'Stripe payment gateway connection timed out after 30 seconds.', details: { gateway: 'stripe', timeout: '30s', retrying: true }, acknowledged: false },
    { id: 'evt-008', timestamp: new Date(Date.now() - 600000).toISOString(), severity: 'info', source: 'system', title: 'Scheduled Backup Complete', message: 'Daily backup completed successfully for all databases.', details: { databases: 24, size: '15.2GB', duration: '45m' }, acknowledged: true },
    { id: 'evt-009', timestamp: new Date(Date.now() - 700000).toISOString(), severity: 'critical', source: 'server', title: 'Disk Space Critical', message: 'Server db-core disk usage at 95%. Immediate action required.', server: 'db-core', details: { diskUsage: 95, freeSpace: '12GB', totalSpace: '250GB' }, acknowledged: false },
    { id: 'evt-010', timestamp: new Date(Date.now() - 800000).toISOString(), severity: 'info', source: 'api', title: 'New API Key Generated', message: 'A new API key was generated for integration purposes.', details: { keyName: 'Production Key', scopes: ['read', 'write'] }, acknowledged: true },
    { id: 'evt-011', timestamp: new Date(Date.now() - 900000).toISOString(), severity: 'warning', source: 'provisioning', title: 'Provisioning Queue Backlog', message: '15 provisioning jobs pending. Consider scaling workers.', details: { pending: 15, avgWait: '5m' }, acknowledged: false },
    { id: 'evt-012', timestamp: new Date(Date.now() - 1000000).toISOString(), severity: 'error', source: 'security', title: 'SSL Certificate Expiring', message: 'SSL certificate for api.migrahosting.com expires in 7 days.', details: { domain: 'api.migrahosting.com', expiresIn: '7 days' }, acknowledged: false },
  ];

  const fetchEvents = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      // const response = await fetch(`${API_BASE}/admin/events?page=${page}&limit=${itemsPerPage}&...`);
      
      let filtered = [...mockEvents];
      
      if (filter.severity !== 'all') {
        filtered = filtered.filter(e => e.severity === filter.severity);
      }
      if (filter.source !== 'all') {
        filtered = filtered.filter(e => e.source === filter.source);
      }
      if (filter.acknowledged !== 'all') {
        filtered = filtered.filter(e => 
          filter.acknowledged === 'yes' ? e.acknowledged : !e.acknowledged
        );
      }
      if (filter.search) {
        const search = filter.search.toLowerCase();
        filtered = filtered.filter(e =>
          e.title.toLowerCase().includes(search) ||
          e.message.toLowerCase().includes(search) ||
          e.source.toLowerCase().includes(search)
        );
      }

      setTotalEvents(filtered.length);
      setTotalPages(Math.ceil(filtered.length / itemsPerPage));
      setEvents(filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage));

      // Calculate stats from all mock events
      setStats({
        total: mockEvents.length,
        info: mockEvents.filter(e => e.severity === 'info').length,
        warning: mockEvents.filter(e => e.severity === 'warning').length,
        error: mockEvents.filter(e => e.severity === 'error').length,
        critical: mockEvents.filter(e => e.severity === 'critical').length,
        unacknowledged: mockEvents.filter(e => !e.acknowledged).length,
      });
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [page, filter]);

  useEffect(() => {
    if (!liveMode) return;
    const interval = setInterval(fetchEvents, 5000);
    return () => clearInterval(interval);
  }, [liveMode, filter]);

  const handleAcknowledge = async (eventId: string) => {
    try {
      // await fetch(`${API_BASE}/admin/events/${eventId}/acknowledge`, { method: 'POST' });
      console.log('Acknowledging event:', eventId);
      fetchEvents();
    } catch (err) {
      console.error('Failed to acknowledge event:', err);
    }
  };

  const handleAcknowledgeAll = async () => {
    if (!confirm('Acknowledge all unacknowledged events?')) return;
    try {
      // await fetch(`${API_BASE}/admin/events/acknowledge-all`, { method: 'POST' });
      console.log('Acknowledging all events');
      fetchEvents();
    } catch (err) {
      console.error('Failed to acknowledge all events:', err);
    }
  };

  const getSeverityIcon = (severity: SystemEvent['severity']) => {
    switch (severity) {
      case 'info': return <InformationCircleIcon className="h-5 w-5 text-blue-500" />;
      case 'warning': return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      case 'error': return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'critical': return <ShieldExclamationIcon className="h-5 w-5 text-red-600 animate-pulse" />;
    }
  };

  const getSeverityBadge = (severity: SystemEvent['severity']) => {
    const styles: Record<SystemEvent['severity'], string> = {
      info: 'bg-blue-100 text-blue-800 border-blue-200',
      warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      error: 'bg-red-100 text-red-800 border-red-200',
      critical: 'bg-red-200 text-red-900 border-red-300 font-bold',
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border ${styles[severity]}`}>
        {getSeverityIcon(severity)}
        {severity.toUpperCase()}
      </span>
    );
  };

  const getSourceIcon = (source: SystemEvent['source']) => {
    const icons: Record<SystemEvent['source'], JSX.Element> = {
      api: <CloudIcon className="h-4 w-4" />,
      database: <CpuChipIcon className="h-4 w-4" />,
      server: <ServerIcon className="h-4 w-4" />,
      network: <SignalIcon className="h-4 w-4" />,
      security: <ShieldExclamationIcon className="h-4 w-4" />,
      billing: <InformationCircleIcon className="h-4 w-4" />,
      provisioning: <WrenchScrewdriverIcon className="h-4 w-4" />,
      system: <CpuChipIcon className="h-4 w-4" />,
    };
    return icons[source];
  };

  const getSourceBadge = (source: SystemEvent['source']) => {
    const styles: Record<SystemEvent['source'], string> = {
      api: 'bg-purple-100 text-purple-800',
      database: 'bg-blue-100 text-blue-800',
      server: 'bg-orange-100 text-orange-800',
      network: 'bg-cyan-100 text-cyan-800',
      security: 'bg-red-100 text-red-800',
      billing: 'bg-green-100 text-green-800',
      provisioning: 'bg-indigo-100 text-indigo-800',
      system: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded ${styles[source]}`}>
        {getSourceIcon(source)}
        {source}
      </span>
    );
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString();
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

  const getRowBgColor = (severity: SystemEvent['severity'], acknowledged: boolean) => {
    if (acknowledged) return 'bg-gray-50 opacity-75';
    switch (severity) {
      case 'critical': return 'bg-red-50 border-l-4 border-l-red-500';
      case 'error': return 'bg-red-50 border-l-4 border-l-red-300';
      case 'warning': return 'bg-yellow-50 border-l-4 border-l-yellow-400';
      default: return 'bg-white';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System Events</h1>
            <p className="text-gray-600 mt-1">Real-time system events and notifications</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLiveMode(!liveMode)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
                liveMode
                  ? 'bg-green-100 text-green-800 border border-green-300'
                  : 'bg-gray-100 text-gray-800 border border-gray-300'
              }`}
            >
              {liveMode ? <PlayIcon className="h-4 w-4" /> : <PauseIcon className="h-4 w-4" />}
              {liveMode ? 'Live' : 'Paused'}
            </button>
            <button
              onClick={fetchEvents}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
            >
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleAcknowledgeAll}
              disabled={stats.unacknowledged === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircleIcon className="h-4 w-4" />
              Acknowledge All ({stats.unacknowledged})
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <BellAlertIcon className="h-8 w-8 text-gray-400" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-500">Total Events</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <InformationCircleIcon className="h-8 w-8 text-blue-400" />
            <div>
              <p className="text-2xl font-bold text-blue-600">{stats.info}</p>
              <p className="text-xs text-gray-500">Info</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <ExclamationTriangleIcon className="h-8 w-8 text-yellow-400" />
            <div>
              <p className="text-2xl font-bold text-yellow-600">{stats.warning}</p>
              <p className="text-xs text-gray-500">Warnings</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <XCircleIcon className="h-8 w-8 text-red-400" />
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.error}</p>
              <p className="text-xs text-gray-500">Errors</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <ShieldExclamationIcon className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold text-red-700">{stats.critical}</p>
              <p className="text-xs text-gray-500">Critical</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
              <span className="text-orange-600 font-bold">!</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">{stats.unacknowledged}</p>
              <p className="text-xs text-gray-500">Unacknowledged</p>
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
            <label className="text-sm text-gray-600">Severity:</label>
            <select
              value={filter.severity}
              onChange={(e) => { setFilter({ ...filter, severity: e.target.value }); setPage(1); }}
              className="text-sm border-gray-300 rounded-md"
            >
              <option value="all">All</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Source:</label>
            <select
              value={filter.source}
              onChange={(e) => { setFilter({ ...filter, source: e.target.value }); setPage(1); }}
              className="text-sm border-gray-300 rounded-md"
            >
              <option value="all">All</option>
              <option value="api">API</option>
              <option value="database">Database</option>
              <option value="server">Server</option>
              <option value="network">Network</option>
              <option value="security">Security</option>
              <option value="billing">Billing</option>
              <option value="provisioning">Provisioning</option>
              <option value="system">System</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Status:</label>
            <select
              value={filter.acknowledged}
              onChange={(e) => { setFilter({ ...filter, acknowledged: e.target.value }); setPage(1); }}
              className="text-sm border-gray-300 rounded-md"
            >
              <option value="all">All</option>
              <option value="no">Unacknowledged</option>
              <option value="yes">Acknowledged</option>
            </select>
          </div>

          <div className="flex-1 min-w-64">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search events..."
                value={filter.search}
                onChange={(e) => { setFilter({ ...filter, search: e.target.value }); setPage(1); }}
                className="w-full pl-10 pr-4 py-2 text-sm border-gray-300 rounded-md"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden" ref={eventLogRef}>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading && events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" />
                    Loading events...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    <BellAlertIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    No events found
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id} className={getRowBgColor(event.severity, event.acknowledged)}>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-mono text-gray-900">{formatTime(event.timestamp)}</p>
                        <p className="text-xs text-gray-500">{formatTimeAgo(event.timestamp)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">{getSeverityBadge(event.severity)}</td>
                    <td className="px-4 py-3">{getSourceBadge(event.source)}</td>
                    <td className="px-4 py-3">
                      <div className="max-w-md">
                        <p className="text-sm font-medium text-gray-900">{event.title}</p>
                        <p className="text-xs text-gray-500 truncate">{event.message}</p>
                        {event.server && (
                          <p className="text-xs text-gray-400 mt-1">Server: {event.server}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {event.acknowledged ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">
                          <CheckCircleIcon className="h-3 w-3" />
                          Acknowledged
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-orange-100 text-orange-800 rounded">
                          <ExclamationTriangleIcon className="h-3 w-3" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setSelectedEvent(event); setShowDetails(true); }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="View Details"
                        >
                          <InformationCircleIcon className="h-4 w-4" />
                        </button>
                        {!event.acknowledged && (
                          <button
                            onClick={() => handleAcknowledge(event.id)}
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                            title="Acknowledge"
                          >
                            <CheckCircleIcon className="h-4 w-4" />
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
              Showing {(page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, totalEvents)} of {totalEvents} events
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

      {/* Event Details Modal */}
      {showDetails && selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className={`flex items-center justify-between px-6 py-4 border-b ${
              selectedEvent.severity === 'critical' ? 'bg-red-50 border-red-200' :
              selectedEvent.severity === 'error' ? 'bg-red-50 border-red-100' :
              selectedEvent.severity === 'warning' ? 'bg-yellow-50 border-yellow-200' :
              'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-center gap-3">
                {getSeverityIcon(selectedEvent.severity)}
                <h3 className="text-lg font-semibold text-gray-900">{selectedEvent.title}</h3>
              </div>
              <button
                onClick={() => { setShowDetails(false); setSelectedEvent(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-160px)]">
              <div className="space-y-4">
                {/* Status Badges */}
                <div className="flex items-center gap-4">
                  {getSeverityBadge(selectedEvent.severity)}
                  {getSourceBadge(selectedEvent.source)}
                  {selectedEvent.acknowledged ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">
                      <CheckCircleIcon className="h-3 w-3" />
                      Acknowledged
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-orange-100 text-orange-800 rounded">
                      Pending
                    </span>
                  )}
                </div>

                {/* Message */}
                <div>
                  <label className="text-xs text-gray-500 uppercase">Message</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedEvent.message}</p>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Event ID</label>
                    <p className="text-sm font-mono text-gray-900">{selectedEvent.id}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Timestamp</label>
                    <p className="text-sm text-gray-900">{formatDate(selectedEvent.timestamp)}</p>
                  </div>
                  {selectedEvent.server && (
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Server</label>
                      <p className="text-sm text-gray-900">{selectedEvent.server}</p>
                    </div>
                  )}
                </div>

                {/* Acknowledgement Info */}
                {selectedEvent.acknowledged && selectedEvent.acknowledgedBy && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <label className="text-xs text-green-700 uppercase block mb-2">Acknowledgement</label>
                    <p className="text-sm text-green-800">
                      Acknowledged by <span className="font-medium">{selectedEvent.acknowledgedBy}</span>
                      {selectedEvent.acknowledgedAt && (
                        <span> at {formatDate(selectedEvent.acknowledgedAt)}</span>
                      )}
                    </p>
                  </div>
                )}

                {/* Details */}
                {selectedEvent.details && (
                  <div>
                    <label className="text-xs text-gray-500 uppercase block mb-2">Event Details</label>
                    <pre className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs overflow-x-auto">
                      {JSON.stringify(selectedEvent.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              {!selectedEvent.acknowledged && (
                <button
                  onClick={() => { handleAcknowledge(selectedEvent.id); setShowDetails(false); }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                >
                  <CheckCircleIcon className="h-4 w-4" />
                  Acknowledge
                </button>
              )}
              <button
                onClick={() => { setShowDetails(false); setSelectedEvent(null); }}
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
