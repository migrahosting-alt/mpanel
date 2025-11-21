import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { 
  GlobeAltIcon, 
  PlusIcon, 
  ShieldCheckIcon,
  TrashIcon,
  PencilIcon,
  SparklesIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

export default function Domains() {
  const [domains, setDomains] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [aiLoadingId, setAiLoadingId] = useState(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [newDomain, setNewDomain] = useState({
    domain_name: '',
    customerId: '',
    type: 'primary',
    php_version: '8.2',
    auto_ssl: true
  });

  useEffect(() => {
    fetchDomains();
    fetchCustomers();
  }, []);

  const fetchDomains = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/domains', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDomains(response.data.domains);
    } catch (error) {
      console.error('Error fetching domains:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/customers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCustomers(response.data.customers);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const handleAddDomain = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/domains', newDomain, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowAddModal(false);
      setNewDomain({ domain_name: '', customerId: '', type: 'primary', php_version: '8.2', auto_ssl: true });
      fetchDomains();
    } catch (error) {
      console.error('Error adding domain:', error);
      alert(error.response?.data?.error || 'Failed to add domain');
    }
  };

  const handleDeleteDomain = async (id, domain_name) => {
    if (!confirm(`Delete ${domain_name}?`)) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/domains/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchDomains();
    } catch (error) {
      console.error('Error deleting domain:', error);
      alert('Failed to delete domain');
    }
  };

  const fetchAiSummary = async (domain) => {
    setAiSummary('');
    setAiLoadingId(domain.id);
    setShowAiModal(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/ai/domains/${domain.id}/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAiSummary(response.data.summary || JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.error('Error fetching AI summary:', error);
      setAiSummary(error.response?.data?.error || 'AI service unavailable. Make sure OPENAI_API_KEY is configured.');
    } finally {
      setAiLoadingId(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Domains</h1>
          <p className="text-sm text-gray-600">Manage your websites and domains</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Add Domain
        </button>
      </div>

      {domains.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <GlobeAltIcon className="h-16 w-16 mx-auto text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No domains yet</h3>
          <p className="mt-2 text-sm text-gray-500">Get started by adding your first domain</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Add Domain
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {domains.map((domain) => (
            <div key={domain.id} className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <GlobeAltIcon className="h-6 w-6 text-primary-600" />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{domain.domain_name}</h3>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-sm text-gray-500">PHP {domain.php_version}</span>
                        {domain.auto_ssl && (
                          <span className="flex items-center text-sm text-green-600">
                            <ShieldCheckIcon className="h-4 w-4 mr-1" />
                            SSL Enabled
                          </span>
                        )}
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          domain.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {domain.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {domain.document_root && (
                    <p className="mt-3 text-sm text-gray-600">
                      <span className="font-medium">Document Root:</span> {domain.document_root}
                    </p>
                  )}
                  
                  {domain.redirect_url && (
                    <p className="mt-2 text-sm text-gray-600">
                      <span className="font-medium">Redirects to:</span> {domain.redirect_url} ({domain.redirect_type})
                    </p>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => fetchAiSummary(domain)}
                    disabled={aiLoadingId === domain.id}
                    className="px-3 py-2 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors disabled:opacity-50 flex items-center gap-1"
                    title="AI Summary"
                  >
                    <SparklesIcon className="h-4 w-4" />
                    {aiLoadingId === domain.id ? 'Loading...' : 'AI Summary'}
                  </button>
                  <Link
                    to={`/domains/${domain.id}`}
                    className="p-2 text-gray-600 hover:text-primary-600 transition-colors"
                    title="Edit"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </Link>
                  <button
                    onClick={() => handleDeleteDomain(domain.id, domain.domain_name)}
                    className="p-2 text-gray-600 hover:text-red-600 transition-colors"
                    title="Delete"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Domain Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add New Domain</h2>
            <form onSubmit={handleAddDomain}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer *
                  </label>
                  <select
                    required
                    value={newDomain.customerId}
                    onChange={(e) => setNewDomain({ ...newDomain, customerId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select a customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.company_name || customer.email || `Customer ${customer.id.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Domain Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="example.com"
                    value={newDomain.domain_name}
                    onChange={(e) => setNewDomain({ ...newDomain, domain_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Domain Type
                  </label>
                  <select
                    value={newDomain.type}
                    onChange={(e) => setNewDomain({ ...newDomain, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="primary">Primary Domain</option>
                    <option value="addon">Addon Domain</option>
                    <option value="subdomain">Subdomain</option>
                    <option value="alias">Domain Alias</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    PHP Version
                  </label>
                  <select
                    value={newDomain.php_version}
                    onChange={(e) => setNewDomain({ ...newDomain, php_version: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="8.3">PHP 8.3</option>
                    <option value="8.2">PHP 8.2</option>
                    <option value="8.1">PHP 8.1</option>
                    <option value="8.0">PHP 8.0</option>
                    <option value="7.4">PHP 7.4</option>
                  </select>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="auto_ssl"
                    checked={newDomain.auto_ssl}
                    onChange={(e) => setNewDomain({ ...newDomain, auto_ssl: e.target.checked })}
                    className="h-4 w-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="auto_ssl" className="ml-2 text-sm text-gray-700">
                    Enable Auto SSL (Let's Encrypt)
                  </label>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Add Domain
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Summary Modal */}
      {showAiModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-2">
                <SparklesIcon className="h-6 w-6 text-violet-600" />
                <h2 className="text-xl font-bold text-gray-900">AI Domain Summary</h2>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {aiLoadingId ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mb-4"></div>
                  <p className="text-sm text-gray-600">Generating AI summary...</p>
                </div>
              ) : aiSummary ? (
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-200">
                    {aiSummary}
                  </pre>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No summary available</p>
              )}
            </div>
            
            <div className="p-6 border-t flex justify-end">
              <button
                onClick={() => setShowAiModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
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
