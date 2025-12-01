import { useState, useEffect } from 'react';
import {
  DocumentTextIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  UserCircleIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  XCircleIcon,
  ShieldCheckIcon,
  CogIcon,
  CurrencyDollarIcon,
  ServerIcon,
  KeyIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

const API_BASE = '/api';

interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  action: string;
  category: 'auth' | 'user' | 'billing' | 'server' | 'system' | 'security' | 'api';
  resource: string;
  resourceId?: string;
  ipAddress: string;
  userAgent: string;
  status: 'success' | 'failure' | 'warning';
  details?: Record<string, any>;
  changes?: { field: string; oldValue: any; newValue: any }[];
}

export default function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);
  const itemsPerPage = 25;

  const [filter, setFilter] = useState({
    category: 'all',
    status: 'all',
    dateFrom: '',
    dateTo: '',
    userId: '',
    search: '',
  });

  // Mock audit data
  const mockEntries: AuditEntry[] = [
    {
      id: 'aud-001',
      timestamp: new Date(Date.now() - 60000).toISOString(),
      userId: 'usr-001',
      userName: 'Admin User',
      userEmail: 'admin@migrahosting.com',
      userRole: 'super_admin',
      action: 'user.update',
      category: 'user',
      resource: 'User',
      resourceId: 'usr-042',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
      status: 'success',
      changes: [
        { field: 'status', oldValue: 'active', newValue: 'suspended' },
        { field: 'notes', oldValue: '', newValue: 'Account suspended for review' }
      ]
    },
    {
      id: 'aud-002',
      timestamp: new Date(Date.now() - 120000).toISOString(),
      userId: 'usr-002',
      userName: 'John Doe',
      userEmail: 'john@example.com',
      userRole: 'customer',
      action: 'auth.login',
      category: 'auth',
      resource: 'Session',
      ipAddress: '203.45.67.89',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1',
      status: 'success',
      details: { method: '2FA', provider: 'totp' }
    },
    {
      id: 'aud-003',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      userId: 'usr-003',
      userName: 'Jane Smith',
      userEmail: 'jane@company.com',
      userRole: 'admin',
      action: 'billing.payment.process',
      category: 'billing',
      resource: 'Payment',
      resourceId: 'pay-789',
      ipAddress: '10.0.0.50',
      userAgent: 'MigraPanel-API/1.0',
      status: 'success',
      details: { amount: 299.99, currency: 'USD', method: 'stripe' }
    },
    {
      id: 'aud-004',
      timestamp: new Date(Date.now() - 450000).toISOString(),
      userId: 'usr-001',
      userName: 'Admin User',
      userEmail: 'admin@migrahosting.com',
      userRole: 'super_admin',
      action: 'server.create',
      category: 'server',
      resource: 'Server',
      resourceId: 'srv-new',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
      status: 'success',
      details: { hostname: 'cpanel-srv3.migrahosting.com', type: 'cPanel' }
    },
    {
      id: 'aud-005',
      timestamp: new Date(Date.now() - 600000).toISOString(),
      userId: 'usr-unknown',
      userName: 'Unknown',
      userEmail: 'unknown@attacker.com',
      userRole: 'none',
      action: 'auth.login.failed',
      category: 'security',
      resource: 'Session',
      ipAddress: '185.220.101.1',
      userAgent: 'python-requests/2.28.0',
      status: 'failure',
      details: { reason: 'Invalid credentials', attempts: 5, blocked: true }
    },
    {
      id: 'aud-006',
      timestamp: new Date(Date.now() - 900000).toISOString(),
      userId: 'system',
      userName: 'System',
      userEmail: 'system@migrahosting.com',
      userRole: 'system',
      action: 'system.backup.complete',
      category: 'system',
      resource: 'Backup',
      resourceId: 'bak-daily-001',
      ipAddress: '127.0.0.1',
      userAgent: 'MigraPanel-Cron/1.0',
      status: 'success',
      details: { size: '2.4GB', duration: '15m 32s', type: 'full' }
    },
    {
      id: 'aud-007',
      timestamp: new Date(Date.now() - 1200000).toISOString(),
      userId: 'usr-001',
      userName: 'Admin User',
      userEmail: 'admin@migrahosting.com',
      userRole: 'super_admin',
      action: 'api.key.create',
      category: 'api',
      resource: 'API Key',
      resourceId: 'key-xyz',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
      status: 'success',
      details: { name: 'Production Integration', scopes: ['read:users', 'write:orders'] }
    },
    {
      id: 'aud-008',
      timestamp: new Date(Date.now() - 1500000).toISOString(),
      userId: 'usr-004',
      userName: 'Mike Wilson',
      userEmail: 'mike@business.com',
      userRole: 'customer',
      action: 'user.password.change',
      category: 'user',
      resource: 'User',
      resourceId: 'usr-004',
      ipAddress: '72.134.56.78',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1',
      status: 'success',
      details: { method: 'self-service' }
    },
    {
      id: 'aud-009',
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      userId: 'usr-001',
      userName: 'Admin User',
      userEmail: 'admin@migrahosting.com',
      userRole: 'super_admin',
      action: 'user.delete',
      category: 'user',
      resource: 'User',
      resourceId: 'usr-deleted',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
      status: 'warning',
      details: { reason: 'Account closure request', dataRetention: '30 days' }
    },
    {
      id: 'aud-010',
      timestamp: new Date(Date.now() - 2100000).toISOString(),
      userId: 'system',
      userName: 'System',
      userEmail: 'system@migrahosting.com',
      userRole: 'system',
      action: 'billing.invoice.generate',
      category: 'billing',
      resource: 'Invoice',
      resourceId: 'inv-2024-001',
      ipAddress: '127.0.0.1',
      userAgent: 'MigraPanel-Cron/1.0',
      status: 'success',
      details: { count: 45, totalAmount: 12500.00 }
    },
  ];

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      // const response = await fetch(`${API_BASE}/admin/audit?page=${page}&limit=${itemsPerPage}&...filters`);
      // const data = await response.json();
      
      // Using mock data with filtering
      let filtered = [...mockEntries];
      
      if (filter.category !== 'all') {
        filtered = filtered.filter(e => e.category === filter.category);
      }
      if (filter.status !== 'all') {
        filtered = filtered.filter(e => e.status === filter.status);
      }
      if (filter.search) {
        const search = filter.search.toLowerCase();
        filtered = filtered.filter(e => 
          e.action.toLowerCase().includes(search) ||
          e.userName.toLowerCase().includes(search) ||
          e.userEmail.toLowerCase().includes(search) ||
          e.resource.toLowerCase().includes(search) ||
          e.ipAddress.includes(search)
        );
      }

      setTotalEntries(filtered.length);
      setTotalPages(Math.ceil(filtered.length / itemsPerPage));
      setEntries(filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage));
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [page, filter]);

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      // In production, this would call an export API endpoint
      const data = format === 'json' 
        ? JSON.stringify(entries, null, 2)
        : entries.map(e => 
            `${e.timestamp},${e.userName},${e.action},${e.category},${e.status},${e.ipAddress}`
          ).join('\n');
      
      const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export:', err);
    }
  };

  const getCategoryIcon = (category: AuditEntry['category']) => {
    const icons: Record<AuditEntry['category'], JSX.Element> = {
      auth: <KeyIcon className="h-4 w-4" />,
      user: <UserCircleIcon className="h-4 w-4" />,
      billing: <CurrencyDollarIcon className="h-4 w-4" />,
      server: <ServerIcon className="h-4 w-4" />,
      system: <CogIcon className="h-4 w-4" />,
      security: <ShieldCheckIcon className="h-4 w-4" />,
      api: <DocumentTextIcon className="h-4 w-4" />,
    };
    return icons[category];
  };

  const getCategoryBadge = (category: AuditEntry['category']) => {
    const styles: Record<AuditEntry['category'], string> = {
      auth: 'bg-purple-100 text-purple-800',
      user: 'bg-blue-100 text-blue-800',
      billing: 'bg-green-100 text-green-800',
      server: 'bg-orange-100 text-orange-800',
      system: 'bg-gray-100 text-gray-800',
      security: 'bg-red-100 text-red-800',
      api: 'bg-indigo-100 text-indigo-800',
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${styles[category]}`}>
        {getCategoryIcon(category)}
        {category}
      </span>
    );
  };

  const getStatusBadge = (status: AuditEntry['status']) => {
    const styles: Record<AuditEntry['status'], string> = {
      success: 'bg-green-100 text-green-800',
      failure: 'bg-red-100 text-red-800',
      warning: 'bg-yellow-100 text-yellow-800',
    };
    return (
      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${styles[status]}`}>
        {status}
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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
            <p className="text-gray-600 mt-1">Track all system activities and changes</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchAuditLogs}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
            >
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <div className="relative group">
              <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                <ArrowDownTrayIcon className="h-4 w-4" />
                Export
              </button>
              <div className="absolute right-0 mt-2 w-32 bg-white rounded-lg shadow-lg border border-gray-200 hidden group-hover:block z-10">
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg"
                >
                  Export CSV
                </button>
                <button
                  onClick={() => handleExport('json')}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-b-lg"
                >
                  Export JSON
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <DocumentTextIcon className="h-8 w-8 text-gray-400" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalEntries}</p>
              <p className="text-xs text-gray-500">Total Entries</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-green-600 text-sm font-bold">✓</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {mockEntries.filter(e => e.status === 'success').length}
              </p>
              <p className="text-xs text-gray-500">Successful</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-red-600 text-sm font-bold">✕</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">
                {mockEntries.filter(e => e.status === 'failure').length}
              </p>
              <p className="text-xs text-gray-500">Failed</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <ShieldCheckIcon className="h-8 w-8 text-red-400" />
            <div>
              <p className="text-2xl font-bold text-red-600">
                {mockEntries.filter(e => e.category === 'security').length}
              </p>
              <p className="text-xs text-gray-500">Security Events</p>
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
            <label className="text-sm text-gray-600">Category:</label>
            <select
              value={filter.category}
              onChange={(e) => { setFilter({ ...filter, category: e.target.value }); setPage(1); }}
              className="text-sm border-gray-300 rounded-md"
            >
              <option value="all">All</option>
              <option value="auth">Auth</option>
              <option value="user">User</option>
              <option value="billing">Billing</option>
              <option value="server">Server</option>
              <option value="system">System</option>
              <option value="security">Security</option>
              <option value="api">API</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Status:</label>
            <select
              value={filter.status}
              onChange={(e) => { setFilter({ ...filter, status: e.target.value }); setPage(1); }}
              className="text-sm border-gray-300 rounded-md"
            >
              <option value="all">All</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
              <option value="warning">Warning</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-gray-400" />
            <input
              type="date"
              value={filter.dateFrom}
              onChange={(e) => setFilter({ ...filter, dateFrom: e.target.value })}
              className="text-sm border-gray-300 rounded-md"
              placeholder="From"
            />
            <span className="text-gray-400">-</span>
            <input
              type="date"
              value={filter.dateTo}
              onChange={(e) => setFilter({ ...filter, dateTo: e.target.value })}
              className="text-sm border-gray-300 rounded-md"
              placeholder="To"
            />
          </div>

          <div className="flex-1 min-w-64">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search actions, users, IPs..."
                value={filter.search}
                onChange={(e) => { setFilter({ ...filter, search: e.target.value }); setPage(1); }}
                className="w-full pl-10 pr-4 py-2 text-sm border-gray-300 rounded-md"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" />
                    Loading audit logs...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <DocumentTextIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    No audit entries found
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-900" title={formatDate(entry.timestamp)}>
                        {formatTimeAgo(entry.timestamp)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{entry.userName}</p>
                        <p className="text-xs text-gray-500">{entry.userEmail}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-mono text-gray-900">{entry.action}</p>
                        {entry.resourceId && (
                          <p className="text-xs text-gray-500">{entry.resource}: {entry.resourceId}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">{getCategoryBadge(entry.category)}</td>
                    <td className="px-4 py-3">{getStatusBadge(entry.status)}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono text-gray-600">{entry.ipAddress}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { setSelectedEntry(entry); setShowDetails(true); }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="View Details"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
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
              Showing {(page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, totalEntries)} of {totalEntries} entries
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

      {/* Entry Details Modal */}
      {showDetails && selectedEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Audit Entry Details</h3>
              <button
                onClick={() => { setShowDetails(false); setSelectedEntry(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-4">
                {/* Status Badges */}
                <div className="flex items-center gap-4">
                  {getCategoryBadge(selectedEntry.category)}
                  {getStatusBadge(selectedEntry.status)}
                </div>

                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Entry ID</label>
                    <p className="text-sm font-mono text-gray-900">{selectedEntry.id}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Timestamp</label>
                    <p className="text-sm text-gray-900">{formatDate(selectedEntry.timestamp)}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Action</label>
                    <p className="text-sm font-mono text-gray-900">{selectedEntry.action}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Resource</label>
                    <p className="text-sm text-gray-900">
                      {selectedEntry.resource}
                      {selectedEntry.resourceId && ` (${selectedEntry.resourceId})`}
                    </p>
                  </div>
                </div>

                {/* User Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="text-xs text-gray-500 uppercase block mb-2">User Information</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{selectedEntry.userName}</p>
                      <p className="text-xs text-gray-500">{selectedEntry.userEmail}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Role</p>
                      <p className="text-sm text-gray-900">{selectedEntry.userRole}</p>
                    </div>
                  </div>
                </div>

                {/* Request Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="text-xs text-gray-500 uppercase block mb-2">Request Information</label>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-500">IP Address</p>
                      <p className="text-sm font-mono text-gray-900">{selectedEntry.ipAddress}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">User Agent</p>
                      <p className="text-xs text-gray-700 break-all">{selectedEntry.userAgent}</p>
                    </div>
                  </div>
                </div>

                {/* Changes */}
                {selectedEntry.changes && selectedEntry.changes.length > 0 && (
                  <div>
                    <label className="text-xs text-gray-500 uppercase block mb-2">Changes</label>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg overflow-hidden">
                      <table className="min-w-full text-sm">
                        <thead className="bg-yellow-100">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-yellow-800">Field</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-yellow-800">Old Value</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-yellow-800">New Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedEntry.changes.map((change, idx) => (
                            <tr key={idx} className="border-t border-yellow-200">
                              <td className="px-3 py-2 font-medium text-gray-900">{change.field}</td>
                              <td className="px-3 py-2 text-red-600">{change.oldValue || '(empty)'}</td>
                              <td className="px-3 py-2 text-green-600">{change.newValue || '(empty)'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Details */}
                {selectedEntry.details && (
                  <div>
                    <label className="text-xs text-gray-500 uppercase block mb-2">Additional Details</label>
                    <pre className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs overflow-x-auto">
                      {JSON.stringify(selectedEntry.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => { setShowDetails(false); setSelectedEntry(null); }}
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
