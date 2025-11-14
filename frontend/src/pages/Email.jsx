import { useState, useEffect } from 'react';
import { apiClient } from '../lib/apiClient';
import toast from 'react-hot-toast';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { ErrorMessage } from '../components/ErrorBoundary';
import { 
  EnvelopeIcon, 
  PlusIcon, 
  TrashIcon, 
  PencilIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

export default function Email() {
  const [activeTab, setActiveTab] = useState('accounts');
  const [domains, setDomains] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [forwarders, setForwarders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showForwarderModal, setShowForwarderModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [editingForwarder, setEditingForwarder] = useState(null);

  // Account form state
  const [accountForm, setAccountForm] = useState({
    domain_id: '',
    email_address: '',
    password: '',
    quota_mb: 1024,
    enable_spam_filter: true,
    spam_score_threshold: 5,
  });

  // Forwarder form state
  const [forwarderForm, setForwarderForm] = useState({
    domain_id: '',
    source_address: '',
    destination_address: '',
  });

  useEffect(() => {
    fetchDomains();
    fetchAccounts();
    fetchForwarders();
  }, []);

  const fetchDomains = async () => {
    try {
      const response = await apiClient.get('/domains');
      if (response.success) {
        setDomains(response.domains);
      }
    } catch (error) {
      console.error('Error fetching domains:', error);
      setError('Failed to load domains');
    }
  };

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/email/accounts');
      if (response.success) {
        setAccounts(response.accounts);
      }
    } catch (error) {
      console.error('Error fetching email accounts:', error);
      setError('Failed to load email accounts');
      toast.error('Failed to load email accounts');
    } finally {
      setLoading(false);
    }
  };

  const fetchForwarders = async () => {
    try {
      const response = await apiClient.get('/email/forwarders');
      if (response.success) {
        setForwarders(response.forwarders);
      }
    } catch (error) {
      console.error('Error fetching forwarders:', error);
      toast.error('Failed to load forwarders');
    }
  };

  const handleAddAccount = async (e) => {
    e.preventDefault();
    try {
      const response = await apiClient.post('/email/accounts', accountForm);
      if (response.success) {
        await fetchAccounts();
        setShowAccountModal(false);
        resetAccountForm();
        toast.success('Email account created successfully');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to create email account');
    }
  };

  const handleDeleteAccount = async (id) => {
    if (!confirm('Are you sure you want to delete this email account?')) return;
    
    try {
      const response = await apiClient.delete(`/email/accounts/${id}`);
      if (response.success) {
        await fetchAccounts();
        toast.success('Email account deleted');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to delete email account');
    }
  };

  const handleAddForwarder = async (e) => {
    e.preventDefault();
    try {
      const response = await apiClient.post('/email/forwarders', forwarderForm);
      if (response.success) {
        await fetchForwarders();
        setShowForwarderModal(false);
        resetForwarderForm();
        toast.success('Forwarder created successfully');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to create forwarder');
    }
  };

  const handleDeleteForwarder = async (id) => {
    if (!confirm('Are you sure you want to delete this forwarder?')) return;
    
    try {
      const response = await apiClient.delete(`/email/forwarders/${id}`);
      if (response.success) {
        await fetchForwarders();
        toast.success('Forwarder deleted');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to delete forwarder');
    }
  };

  const resetAccountForm = () => {
    setAccountForm({
      domain_id: '',
      email_address: '',
      password: '',
      quota_mb: 1024,
      enable_spam_filter: true,
      spam_score_threshold: 5,
    });
    setEditingAccount(null);
  };

  const resetForwarderForm = () => {
    setForwarderForm({
      domain_id: '',
      source_address: '',
      destination_address: '',
    });
    setEditingForwarder(null);
  };

  const formatQuota = (mb) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb} MB`;
  };

  const getDomainName = (domainId) => {
    const domain = domains.find(d => d.id === domainId);
    return domain?.domain_name || 'Unknown';
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Email Management</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage email accounts and forwarders for your domains
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          {activeTab === 'accounts' ? (
            <button
              onClick={() => setShowAccountModal(true)}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
            >
              <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
              Add Account
            </button>
          ) : (
            <button
              onClick={() => setShowForwarderModal(true)}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
            >
              <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
              Add Forwarder
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mt-4">
          <ErrorMessage message={error} onRetry={() => { setError(null); fetchAccounts(); }} />
        </div>
      )}

      {/* Tabs */}
      <div className="mt-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('accounts')}
            className={`${
              activeTab === 'accounts'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
          >
            Email Accounts ({accounts.length})
          </button>
          <button
            onClick={() => setActiveTab('forwarders')}
            className={`${
              activeTab === 'forwarders'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
          >
            Forwarders ({forwarders.length})
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="mt-8">
        {loading ? (
          <TableSkeleton rows={5} columns={6} />
        ) : activeTab === 'accounts' ? (
          <EmailAccounts 
            accounts={accounts}
            domains={domains}
            getDomainName={getDomainName}
            formatQuota={formatQuota}
            onDelete={handleDeleteAccount}
          />
        ) : (
          <EmailForwarders 
            forwarders={forwarders}
            domains={domains}
            getDomainName={getDomainName}
            onDelete={handleDeleteForwarder}
          />
        )}
      </div>

      {/* Add Account Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Add Email Account</h3>
              <button onClick={() => { setShowAccountModal(false); resetAccountForm(); }}>
                <XMarkIcon className="h-6 w-6 text-gray-400 hover:text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleAddAccount}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Domain</label>
                  <select
                    required
                    value={accountForm.domain_id}
                    onChange={(e) => setAccountForm({ ...accountForm, domain_id: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="">Select domain...</option>
                    {domains.map((domain) => (
                      <option key={domain.id} value={domain.id}>{domain.domain_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Email Address</label>
                  <input
                    type="text"
                    required
                    placeholder="username"
                    value={accountForm.email_address}
                    onChange={(e) => setAccountForm({ ...accountForm, email_address: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">Enter username only (e.g., "info" for info@domain.com)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <input
                    type="password"
                    required
                    value={accountForm.password}
                    onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Quota (MB)</label>
                  <input
                    type="number"
                    min="100"
                    value={accountForm.quota_mb}
                    onChange={(e) => setAccountForm({ ...accountForm, quota_mb: parseInt(e.target.value) })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={accountForm.enable_spam_filter}
                    onChange={(e) => setAccountForm({ ...accountForm, enable_spam_filter: e.target.checked })}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-900">
                    Enable spam filter
                  </label>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowAccountModal(false); resetAccountForm(); }}
                  className="flex-1 bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Add Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Forwarder Modal */}
      {showForwarderModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Add Email Forwarder</h3>
              <button onClick={() => { setShowForwarderModal(false); resetForwarderForm(); }}>
                <XMarkIcon className="h-6 w-6 text-gray-400 hover:text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleAddForwarder}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Domain</label>
                  <select
                    required
                    value={forwarderForm.domain_id}
                    onChange={(e) => setForwarderForm({ ...forwarderForm, domain_id: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="">Select domain...</option>
                    {domains.map((domain) => (
                      <option key={domain.id} value={domain.id}>{domain.domain_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Source Address</label>
                  <input
                    type="text"
                    required
                    placeholder="username"
                    value={forwarderForm.source_address}
                    onChange={(e) => setForwarderForm({ ...forwarderForm, source_address: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">Enter username only</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Destination Address</label>
                  <input
                    type="email"
                    required
                    placeholder="destination@example.com"
                    value={forwarderForm.destination_address}
                    onChange={(e) => setForwarderForm({ ...forwarderForm, destination_address: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">Full email address where mail will be forwarded</p>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowForwarderModal(false); resetForwarderForm(); }}
                  className="flex-1 bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Add Forwarder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Email Accounts Component
function EmailAccounts({ accounts, domains, getDomainName, formatQuota, onDelete }) {
  if (accounts.length === 0) {
    return (
      <div className="text-center py-12">
        <EnvelopeIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No email accounts</h3>
        <p className="mt-1 text-sm text-gray-500">Get started by creating a new email account.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {accounts.map((account) => (
        <div key={account.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <EnvelopeIcon className="h-5 w-5 text-indigo-600 flex-shrink-0" />
                <p className="text-sm font-medium text-gray-900 truncate">
                  {account.email_address}@{getDomainName(account.domain_id)}
                </p>
              </div>
              
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Quota:</span>
                  <span className="font-medium text-gray-900">{formatQuota(account.quota_mb)}</span>
                </div>
                
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Used:</span>
                  <span className="font-medium text-gray-900">{formatQuota(account.disk_usage_mb || 0)}</span>
                </div>

                {account.enable_spam_filter && (
                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <ShieldCheckIcon className="h-4 w-4" />
                    <span>Spam filter active</span>
                  </div>
                )}

                {account.enable_autoresponder && (
                  <div className="flex items-center gap-1 text-xs text-blue-600">
                    <ArrowPathIcon className="h-4 w-4" />
                    <span>Auto-reply enabled</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex gap-2">
            <button className="flex-1 text-xs text-indigo-600 hover:text-indigo-900 font-medium flex items-center justify-center gap-1 py-2 border border-indigo-200 rounded hover:bg-indigo-50">
              <PencilIcon className="h-3 w-3" />
              Edit
            </button>
            <button 
              onClick={() => onDelete(account.id)}
              className="flex-1 text-xs text-red-600 hover:text-red-900 font-medium flex items-center justify-center gap-1 py-2 border border-red-200 rounded hover:bg-red-50"
            >
              <TrashIcon className="h-3 w-3" />
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Email Forwarders Component
function EmailForwarders({ forwarders, domains, getDomainName, onDelete }) {
  if (forwarders.length === 0) {
    return (
      <div className="text-center py-12">
        <ArrowPathIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No forwarders</h3>
        <p className="mt-1 text-sm text-gray-500">Get started by creating a new email forwarder.</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <ul className="divide-y divide-gray-200">
        {forwarders.map((forwarder) => (
          <li key={forwarder.id}>
            <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <ArrowPathIcon className="h-5 w-5 text-indigo-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {forwarder.source_address}@{getDomainName(forwarder.domain_id)}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        → {forwarder.destination_address}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button 
                    onClick={() => onDelete(forwarder.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
