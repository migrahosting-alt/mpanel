import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  CircleStackIcon,
  PlusIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  UserPlusIcon,
  KeyIcon,
  ChartBarIcon,
  UserIcon
} from '@heroicons/react/24/outline';

export default function DatabaseManagement() {
  const [databases, setDatabases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [selectedDatabase, setSelectedDatabase] = useState(null);
  const [dbUsers, setDbUsers] = useState([]);
  const [dbStats, setDbStats] = useState(null);
  const [domains, setDomains] = useState([]);
  
  const [createForm, setCreateForm] = useState({
    name: '',
    db_user: '',
    db_password: '',
    max_size_mb: 512,
    domain_id: ''
  });

  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE']
  });

  const API_URL = 'http://localhost:3002/api/database-mgmt';
  const DOMAINS_URL = 'http://localhost:3002/api/domains';
  const token = localStorage.getItem('token');

  const axiosConfig = {
    headers: { Authorization: `Bearer ${token}` }
  };

  useEffect(() => {
    fetchDatabases();
    fetchDomains();
  }, []);

  const fetchDatabases = async () => {
    try {
      setLoading(true);
      const response = await axios.get(API_URL, axiosConfig);
      setDatabases(response.data);
    } catch (error) {
      console.error('Error fetching databases:', error);
      alert('Failed to load databases');
    } finally {
      setLoading(false);
    }
  };

  const fetchDomains = async () => {
    try {
      const response = await axios.get(DOMAINS_URL, axiosConfig);
      setDomains(response.data);
    } catch (error) {
      console.error('Error fetching domains:', error);
    }
  };

  const handleCreateDatabase = async () => {
    try {
      await axios.post(API_URL, createForm, axiosConfig);
      alert('Database created successfully');
      setShowCreateModal(false);
      setCreateForm({ name: '', db_user: '', db_password: '', max_size_mb: 512, domain_id: '' });
      fetchDatabases();
    } catch (error) {
      console.error('Error creating database:', error);
      alert(error.response?.data?.error || 'Failed to create database');
    }
  };

  const handleDeleteDatabase = async (id, name) => {
    if (!confirm(`Are you sure you want to delete database "${name}"? This action cannot be undone!`)) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/${id}`, axiosConfig);
      alert('Database deleted successfully');
      fetchDatabases();
    } catch (error) {
      console.error('Error deleting database:', error);
      alert('Failed to delete database');
    }
  };

  const handleViewUsers = async (database) => {
    try {
      setSelectedDatabase(database);
      const response = await axios.get(`${API_URL}/${database.id}/users`, axiosConfig);
      setDbUsers(response.data);
      setShowUsersModal(true);
    } catch (error) {
      console.error('Error fetching users:', error);
      alert('Failed to load users');
    }
  };

  const handleAddUser = async () => {
    try {
      await axios.post(`${API_URL}/${selectedDatabase.id}/users`, userForm, axiosConfig);
      alert('User created successfully');
      setShowAddUserModal(false);
      setUserForm({ username: '', password: '', privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] });
      handleViewUsers(selectedDatabase);
    } catch (error) {
      console.error('Error creating user:', error);
      alert(error.response?.data?.error || 'Failed to create user');
    }
  };

  const handleDeleteUser = async (username) => {
    if (!confirm(`Delete user "${username}"?`)) return;

    try {
      await axios.delete(`${API_URL}/${selectedDatabase.id}/users/${username}`, axiosConfig);
      alert('User deleted successfully');
      handleViewUsers(selectedDatabase);
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user');
    }
  };

  const handleViewStats = async (database) => {
    try {
      setSelectedDatabase(database);
      const response = await axios.get(`${API_URL}/${database.id}/stats`, axiosConfig);
      setDbStats(response.data);
      setShowStatsModal(true);
    } catch (error) {
      console.error('Error fetching stats:', error);
      alert('Failed to load database statistics');
    }
  };

  const handleExport = async (database) => {
    try {
      const response = await axios.get(`${API_URL}/${database.id}/export`, {
        ...axiosConfig,
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${database.name}.sql`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error exporting database:', error);
      alert('Failed to export database');
    }
  };

  const formatFileSize = (mb) => {
    if (mb < 1) return `${Math.round(mb * 1024)} KB`;
    if (mb < 1024) return `${Math.round(mb * 10) / 10} MB`;
    return `${Math.round(mb / 1024 * 10) / 10} GB`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Database Management</h1>
          <p className="mt-2 text-sm text-gray-600">
            Create and manage PostgreSQL databases
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Create Database
        </button>
      </div>

      {/* Database List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-2 text-sm text-gray-600">Loading databases...</p>
        </div>
      ) : databases.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <CircleStackIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No databases</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new database.</p>
          <div className="mt-6">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Create Database
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {databases.map((db) => (
            <div key={db.id} className="bg-white shadow rounded-lg p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <CircleStackIcon className="h-8 w-8 text-indigo-600" />
                  <h3 className="ml-3 text-lg font-medium text-gray-900">{db.name}</h3>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  db.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {db.status}
                </span>
              </div>

              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <div className="flex justify-between">
                  <span>User:</span>
                  <span className="font-medium text-gray-900">{db.db_user}</span>
                </div>
                <div className="flex justify-between">
                  <span>Size:</span>
                  <span className="font-medium text-gray-900">
                    {formatFileSize(db.size_mb || 0)} / {formatFileSize(db.max_size_mb)}
                  </span>
                </div>
                {db.associated_domain && (
                  <div className="flex justify-between">
                    <span>Domain:</span>
                    <span className="font-medium text-gray-900">{db.associated_domain}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Created:</span>
                  <span className="font-medium text-gray-900">
                    {new Date(db.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              {db.size_mb > 0 && (
                <div className="mb-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-indigo-600 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min((db.size_mb / db.max_size_mb) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleViewUsers(db)}
                  className="flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <UserIcon className="h-4 w-4 mr-1" />
                  Users
                </button>
                <button
                  onClick={() => handleViewStats(db)}
                  className="flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <ChartBarIcon className="h-4 w-4 mr-1" />
                  Stats
                </button>
                <button
                  onClick={() => handleExport(db)}
                  className="flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                  Export
                </button>
                <button
                  onClick={() => handleDeleteDatabase(db.id, db.name)}
                  className="flex items-center justify-center px-3 py-2 border border-red-300 rounded-md shadow-sm text-xs font-medium text-red-700 bg-white hover:bg-red-50"
                >
                  <TrashIcon className="h-4 w-4 mr-1" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Database Modal */}
      {showCreateModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowCreateModal(false)}></div>
            <div className="relative bg-white rounded-lg px-6 pt-5 pb-6 shadow-xl max-w-lg w-full">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Database</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Database Name *
                  </label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="myapp_db"
                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">Only letters, numbers, and underscores</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Database User *
                  </label>
                  <input
                    type="text"
                    value={createForm.db_user}
                    onChange={(e) => setCreateForm({ ...createForm, db_user: e.target.value })}
                    placeholder="myapp_user"
                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    value={createForm.db_password}
                    onChange={(e) => setCreateForm({ ...createForm, db_password: e.target.value })}
                    placeholder="Strong password"
                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Size (MB)
                  </label>
                  <input
                    type="number"
                    value={createForm.max_size_mb}
                    onChange={(e) => setCreateForm({ ...createForm, max_size_mb: parseInt(e.target.value) })}
                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Associated Domain (optional)
                  </label>
                  <select
                    value={createForm.domain_id}
                    onChange={(e) => setCreateForm({ ...createForm, domain_id: e.target.value })}
                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">None</option>
                    {domains.map(domain => (
                      <option key={domain.id} value={domain.id}>{domain.domain_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateDatabase}
                  className="px-4 py-2 bg-indigo-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Create Database
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Database Users Modal */}
      {showUsersModal && selectedDatabase && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowUsersModal(false)}></div>
            <div className="relative bg-white rounded-lg px-6 pt-5 pb-6 shadow-xl max-w-2xl w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Users for {selectedDatabase.name}
                </h3>
                <button
                  onClick={() => setShowAddUserModal(true)}
                  className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <UserPlusIcon className="h-4 w-4 mr-2" />
                  Add User
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Username
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Permissions
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dbUsers.map((user) => (
                      <tr key={user.username}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {user.username}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.is_superuser ? 'Superuser' : user.can_create_db ? 'Create DB' : 'Standard'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleDeleteUser(user.username)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowUsersModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && selectedDatabase && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowAddUserModal(false)}></div>
            <div className="relative bg-white rounded-lg px-6 pt-5 pb-6 shadow-xl max-w-lg w-full">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Add User to {selectedDatabase.name}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    value={userForm.username}
                    onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                    placeholder="db_user"
                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Privileges
                  </label>
                  <div className="space-y-2">
                    {['SELECT', 'INSERT', 'UPDATE', 'DELETE'].map(priv => (
                      <label key={priv} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={userForm.privileges.includes(priv)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setUserForm({ ...userForm, privileges: [...userForm.privileges, priv] });
                            } else {
                              setUserForm({ ...userForm, privileges: userForm.privileges.filter(p => p !== priv) });
                            }
                          }}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">{priv}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddUser}
                  className="px-4 py-2 bg-indigo-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Add User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Database Stats Modal */}
      {showStatsModal && selectedDatabase && dbStats && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowStatsModal(false)}></div>
            <div className="relative bg-white rounded-lg px-6 pt-5 pb-6 shadow-xl max-w-lg w-full">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Statistics for {selectedDatabase.name}
              </h3>

              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Storage Used</span>
                    <span className="text-lg font-bold text-indigo-600">
                      {formatFileSize(dbStats.size_mb)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-indigo-600 h-3 rounded-full transition-all"
                      style={{ width: `${dbStats.usage_percent}%` }}
                    ></div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {dbStats.usage_percent}% of {formatFileSize(dbStats.max_size_mb)} used
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm font-medium text-gray-700 mb-1">Tables</div>
                    <div className="text-2xl font-bold text-gray-900">{dbStats.table_count}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm font-medium text-gray-700 mb-1">Size (bytes)</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {dbStats.size_bytes.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowStatsModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
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
