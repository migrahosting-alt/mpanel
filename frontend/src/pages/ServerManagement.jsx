import { useState, useEffect } from 'react';
import {
  ServerIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  CircleStackIcon,
  UserGroupIcon,
  TableCellsIcon,
  CodeBracketIcon,
  GlobeAltIcon,
  DocumentTextIcon,
  RocketLaunchIcon,
  ChartBarIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function ServerManagement() {
  const [activeTab, setActiveTab] = useState('servers');
  const [servers, setServers] = useState([]);
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddServerModal, setShowAddServerModal] = useState(false);
  const [showEditServerModal, setShowEditServerModal] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [deployType, setDeployType] = useState(null);
  const [selectedServer, setSelectedServer] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      // Fetch servers
      const serversRes = await fetch('/api/servers', { headers });
      if (serversRes.ok) {
        const serversData = await serversRes.json();
        setServers(serversData.data || serversData.servers || []);
      }

      // Fetch deployments
      const deploymentsRes = await fetch('/api/deployments', { headers });
      if (deploymentsRes.ok) {
        const deploymentsData = await deploymentsRes.json();
        setDeployments(deploymentsData.data || deploymentsData.deployments || []);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  const handleAddServer = async (formData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/servers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success('Server added successfully');
        setShowAddServerModal(false);
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to add server');
      }
    } catch (error) {
      console.error('Error adding server:', error);
      toast.error('Failed to add server');
    }
  };

  const handleEditServer = (server) => {
    setSelectedServer(server);
    setShowEditServerModal(true);
  };

  const handleUpdateServer = async (formData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/servers/${selectedServer.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success('Server updated successfully');
        setShowEditServerModal(false);
        setSelectedServer(null);
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update server');
      }
    } catch (error) {
      console.error('Error updating server:', error);
      toast.error('Failed to update server');
    }
  };

  const handleDeleteServer = async (serverId) => {
    if (!confirm('Are you sure you want to delete this server?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/servers/${serverId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success('Server deleted successfully');
        fetchData();
      } else {
        toast.error('Failed to delete server');
      }
    } catch (error) {
      console.error('Error deleting server:', error);
      toast.error('Failed to delete server');
    }
  };

  const handleDeploy = async (formData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/deployments/${deployType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`${deployType} deployed successfully!`);
        setShowDeployModal(false);
        setDeployType(null);
        fetchData();
        
        // Show deployment result modal
        showDeploymentResult(result);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Deployment failed');
      }
    } catch (error) {
      console.error('Deployment error:', error);
      toast.error('Deployment failed');
    }
  };

  const showDeploymentResult = (deployment) => {
    if (deployment.result) {
      const resultText = JSON.stringify(deployment.result, null, 2);
      alert(`Deployment Successful!\n\n${resultText}`);
    }
  };

  const deploymentTypes = [
    {
      id: 'database',
      name: 'Database',
      description: 'Create MySQL/PostgreSQL database',
      icon: CircleStackIcon,
      color: 'bg-blue-500',
    },
    {
      id: 'user',
      name: 'Database User',
      description: 'Create database user with privileges',
      icon: UserGroupIcon,
      color: 'bg-green-500',
    },
    {
      id: 'table',
      name: 'Table',
      description: 'Deploy database table from schema',
      icon: TableCellsIcon,
      color: 'bg-purple-500',
    },
    {
      id: 'api',
      name: 'API Endpoint',
      description: 'Deploy REST API endpoint',
      icon: CodeBracketIcon,
      color: 'bg-yellow-500',
    },
    {
      id: 'website',
      name: 'Website',
      description: 'Deploy full website/application',
      icon: GlobeAltIcon,
      color: 'bg-red-500',
    },
    {
      id: 'form',
      name: 'Form',
      description: 'Deploy HTML form with backend',
      icon: DocumentTextIcon,
      color: 'bg-indigo-500',
    },
  ];

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
          <h1 className="text-2xl font-bold text-gray-900">Server Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage servers and deploy resources with one click
          </p>
        </div>
        <button
          onClick={() => setShowAddServerModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Add Server
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('servers')}
            className={`${
              activeTab === 'servers'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            <ServerIcon className="w-5 h-5 inline-block mr-2" />
            Servers ({servers.length})
          </button>

          <button
            onClick={() => setActiveTab('deploy')}
            className={`${
              activeTab === 'deploy'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            <RocketLaunchIcon className="w-5 h-5 inline-block mr-2" />
            Quick Deploy
          </button>

          <button
            onClick={() => setActiveTab('resources')}
            className={`${
              activeTab === 'resources'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            <ChartBarIcon className="w-5 h-5 inline-block mr-2" />
            Resources ({deployments.length})
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'servers' && (
        <ServersTab
          servers={servers}
          onDelete={handleDeleteServer}
          onEdit={handleEditServer}
        />
      )}

      {activeTab === 'deploy' && (
        <QuickDeployTab
          deploymentTypes={deploymentTypes}
          servers={servers}
          onDeploy={(type) => {
            setDeployType(type);
            setShowDeployModal(true);
          }}
        />
      )}

      {activeTab === 'resources' && (
        <ResourcesTab
          deployments={deployments}
          onRefresh={fetchData}
        />
      )}

      {/* Add Server Modal */}
      {showAddServerModal && (
        <AddServerModal
          onClose={() => setShowAddServerModal(false)}
          onSubmit={handleAddServer}
        />
      )}

      {/* Edit Server Modal */}
      {showEditServerModal && selectedServer && (
        <AddServerModal
          onClose={() => {
            setShowEditServerModal(false);
            setSelectedServer(null);
          }}
          onSubmit={handleUpdateServer}
          initialData={selectedServer}
          isEdit={true}
        />
      )}

      {/* Deploy Modal */}
      {showDeployModal && deployType && (
        <DeployModal
          type={deployType}
          servers={servers}
          onClose={() => {
            setShowDeployModal(false);
            setDeployType(null);
          }}
          onSubmit={handleDeploy}
        />
      )}
    </div>
  );
}

// Servers Tab Component
function ServersTab({ servers, onDelete, onEdit }) {
  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Server
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Control Panel
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Resources
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {servers.length === 0 ? (
            <tr>
              <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">
                No servers found. Add your first server to get started.
              </td>
            </tr>
          ) : (
            servers.map((server) => (
              <tr key={server.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <ServerIcon className="h-10 w-10 text-gray-400" />
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{server.name}</div>
                      <div className="text-sm text-gray-500">{server.hostname}</div>
                      <div className="text-xs text-gray-400">{server.ip_address}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    {server.control_panel || 'cPanel'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {server.status === 'active' ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircleIcon className="w-4 h-4 mr-1" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      <XCircleIcon className="w-4 h-4 mr-1" />
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {server.max_accounts || 0} max accounts
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => onEdit(server)}
                    className="text-indigo-600 hover:text-indigo-900 mr-4"
                  >
                    <PencilIcon className="w-5 h-5 inline" />
                  </button>
                  <button
                    onClick={() => onDelete(server.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <TrashIcon className="w-5 h-5 inline" />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// Quick Deploy Tab Component
function QuickDeployTab({ deploymentTypes, servers, onDeploy }) {
  if (servers.length === 0) {
    return (
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <ServerIcon className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700">
              You need to add at least one server before you can deploy resources.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {deploymentTypes.map((type) => {
        const Icon = type.icon;
        return (
          <div
            key={type.id}
            className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 rounded-lg shadow hover:shadow-lg transition-shadow"
          >
            <div>
              <span className={`${type.color} rounded-lg inline-flex p-3 text-white ring-4 ring-white`}>
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-8">
              <h3 className="text-lg font-medium">
                <button
                  onClick={() => onDeploy(type.id)}
                  className="focus:outline-none text-left w-full"
                >
                  <span className="absolute inset-0" aria-hidden="true" />
                  {type.name}
                </button>
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                {type.description}
              </p>
            </div>
            <button
              onClick={() => onDeploy(type.id)}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <RocketLaunchIcon className="w-4 h-4 mr-2" />
              Deploy Now
            </button>
          </div>
        );
      })}
    </div>
  );
}

// Resources Tab Component
function ResourcesTab({ deployments, onRefresh }) {
  const [filter, setFilter] = useState('all');

  const filteredDeployments = filter === 'all'
    ? deployments
    : deployments.filter(d => d.type === filter);

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex justify-between items-center">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="block pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
        >
          <option value="all">All Types</option>
          <option value="database">Databases</option>
          <option value="user">Users</option>
          <option value="table">Tables</option>
          <option value="api">APIs</option>
          <option value="website">Websites</option>
          <option value="form">Forms</option>
        </select>

        <button
          onClick={onRefresh}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <ArrowPathIcon className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Deployments Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Server
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredDeployments.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">
                  No deployments found.
                </td>
              </tr>
            ) : (
              filteredDeployments.map((deployment) => (
                <tr key={deployment.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {deployment.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {deployment.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {deployment.server_name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(deployment.status)}`}>
                      {deployment.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(deployment.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Add Server Modal Component
function AddServerModal({ onClose, onSubmit, initialData = null, isEdit = false }) {
  const [formData, setFormData] = useState(initialData || {
    name: '',
    hostname: '',
    ip_address: '',
    control_panel: 'cpanel',
    control_panel_url: '',
    api_username: '',
    api_token: '',
    max_accounts: 100,
    nameserver1: 'ns1.migrahosting.com',
    nameserver2: 'ns2.migrahosting.com',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed z-10 inset-0 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <form onSubmit={handleSubmit}>
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                {isEdit ? 'Edit Server' : 'Add New Server'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Hostname</label>
                  <input
                    type="text"
                    required
                    value={formData.hostname}
                    onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">IP Address</label>
                  <input
                    type="text"
                    required
                    value={formData.ip_address}
                    onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Control Panel</label>
                  <select
                    value={formData.control_panel}
                    onChange={(e) => setFormData({ ...formData, control_panel: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="cpanel">cPanel/WHM</option>
                    <option value="plesk">Plesk</option>
                    <option value="directadmin">DirectAdmin</option>
                    <option value="cyberpanel">CyberPanel</option>
                    <option value="mpanel">mPanel (Native)</option>
                    <option value="ispconfig">ISPConfig</option>
                    <option value="virtualmin">Virtualmin</option>
                    <option value="webmin">Webmin</option>
                    <option value="other">Other/Custom</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Control Panel URL</label>
                  <input
                    type="url"
                    placeholder="https://server.example.com:2087"
                    value={formData.control_panel_url}
                    onChange={(e) => setFormData({ ...formData, control_panel_url: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">API Username</label>
                  <input
                    type="text"
                    value={formData.api_username}
                    onChange={(e) => setFormData({ ...formData, api_username: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">API Token</label>
                  <input
                    type="password"
                    value={formData.api_token}
                    onChange={(e) => setFormData({ ...formData, api_token: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
              <button
                type="submit"
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 sm:text-sm"
              >
                {isEdit ? 'Update Server' : 'Add Server'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Deploy Modal Component (continued in next message due to length)
function DeployModal({ type, servers, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    name: '',
    server_id: servers[0]?.id || '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const renderFields = () => {
    switch (type) {
      case 'database':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">Database Type</label>
              <select
                value={formData.type || 'mysql'}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="mysql">MySQL</option>
                <option value="postgresql">PostgreSQL</option>
              </select>
            </div>
          </>
        );
      case 'website':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">Domain</label>
              <input
                type="text"
                required
                placeholder="example.com"
                value={formData.domain || ''}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Framework</label>
              <select
                value={formData.framework || 'static'}
                onChange={(e) => setFormData({ ...formData, framework: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="static">Static HTML</option>
                <option value="wordpress">WordPress</option>
                <option value="react">React</option>
                <option value="vue">Vue.js</option>
                <option value="angular">Angular</option>
              </select>
            </div>
          </>
        );
      case 'api':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">Path</label>
              <input
                type="text"
                required
                placeholder="users"
                value={formData.path || ''}
                onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Method</label>
              <select
                value={formData.method || 'GET'}
                onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Handler Type</label>
              <select
                value={formData.handler_type || 'crud'}
                onChange={(e) => setFormData({ ...formData, handler_type: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="crud">CRUD (Auto-generated)</option>
                <option value="custom">Custom Code</option>
              </select>
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed z-10 inset-0 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <form onSubmit={handleSubmit}>
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Deploy {type.charAt(0).toUpperCase() + type.slice(1)}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Server</label>
                  <select
                    required
                    value={formData.server_id}
                    onChange={(e) => setFormData({ ...formData, server_id: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    {servers.map((server) => (
                      <option key={server.id} value={server.id}>
                        {server.name} ({server.hostname})
                      </option>
                    ))}
                  </select>
                </div>

                {renderFields()}
              </div>
            </div>

            <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
              <button
                type="submit"
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 sm:text-sm"
              >
                <RocketLaunchIcon className="w-4 h-4 mr-2" />
                Deploy
              </button>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
