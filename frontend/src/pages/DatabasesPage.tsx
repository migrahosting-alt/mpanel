// src/pages/DatabasesPage.tsx
import React, { useState, useEffect } from 'react';
import { CircleStackIcon, PlusIcon, PencilIcon, TrashIcon, KeyIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { apiClient } from '../lib/apiClient';
import toast from 'react-hot-toast';

type Database = {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'suspended';
  configuration: {
    database_name: string;
    database_type: 'postgresql' | 'mysql' | 'mongodb';
    max_connections: number;
    storage_gb: number;
    username?: string;
    password?: string;
    host?: string;
    port?: number;
  };
  price: number;
  billing_cycle: 'monthly' | 'yearly';
  auto_renew: boolean;
  renewal_date: string;
  created_at: string;
};

export default function DatabasesPage() {
  const [databases, setDatabases] = useState<Database[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Database | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Database | null>(null);
  const [showCredentials, setShowCredentials] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    database_type: 'postgresql' as 'postgresql' | 'mysql' | 'mongodb',
    max_connections: 20,
    storage_gb: 5,
    price: 5.99,
    billing_cycle: 'monthly' as 'monthly' | 'yearly',
    auto_renew: true,
  });

  useEffect(() => {
    fetchDatabases();
  }, []);

  const fetchDatabases = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ services: Database[] }>('/services?type=database');
      setDatabases(response.services);
    } catch (error) {
      toast.error('Failed to load databases');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      database_type: 'postgresql',
      max_connections: 20,
      storage_gb: 5,
      price: 5.99,
      billing_cycle: 'monthly',
      auto_renew: true,
    });
    setModalOpen(true);
  };

  const openEdit = (db: Database) => {
    setEditing(db);
    setForm({
      name: db.name,
      database_type: db.configuration?.database_type || 'postgresql',
      max_connections: db.configuration?.max_connections || 20,
      storage_gb: db.configuration?.storage_gb || 5,
      price: db.price,
      billing_cycle: db.billing_cycle,
      auto_renew: db.auto_renew,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name) {
      toast.error('Please enter a database name');
      return;
    }

    try {
      if (editing) {
        await apiClient.put(`/services/${editing.id}`, {
          name: form.name,
          configuration: {
            database_name: form.name,
            database_type: form.database_type,
            max_connections: form.max_connections,
            storage_gb: form.storage_gb,
          },
          price: form.price,
          billing_cycle: form.billing_cycle,
          auto_renew: form.auto_renew,
        });
        toast.success('Database updated successfully');
      } else {
        await apiClient.post('/services', {
          type: 'database',
          name: form.name,
          configuration: {
            database_name: form.name,
            database_type: form.database_type,
            max_connections: form.max_connections,
            storage_gb: form.storage_gb,
          },
          price: form.price,
          billing_cycle: form.billing_cycle,
          auto_renew: form.auto_renew,
        });
        toast.success('Database created successfully');
      }
      
      setModalOpen(false);
      fetchDatabases();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save database');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    
    try {
      await apiClient.delete(`/services/${deleteConfirm.id}`);
      toast.success('Database deleted successfully');
      setDeleteConfirm(null);
      fetchDatabases();
    } catch (error) {
      toast.error('Failed to delete database');
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-gray-100 text-gray-700',
      suspended: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getDbTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      postgresql: 'bg-blue-100 text-blue-700',
      mysql: 'bg-orange-100 text-orange-700',
      mongodb: 'bg-green-100 text-green-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <CircleStackIcon className="w-7 h-7 text-violet-600" />
            Databases
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your database instances and credentials
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700 flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Create Database
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
        </div>
      ) : databases.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-12 text-center">
          <CircleStackIcon className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No databases yet</h3>
          <p className="text-slate-500 mb-4">
            Create your first database to store your application data
          </p>
          <button
            onClick={openCreate}
            className="px-4 py-2 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700"
          >
            Create Database
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {databases.map((db) => (
            <div
              key={db.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {db.name}
                    </h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDbTypeBadge(db.configuration?.database_type || 'postgresql')}`}>
                      {db.configuration?.database_type?.toUpperCase()}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(db.status)}`}>
                      {db.status}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Storage</p>
                      <p className="text-sm text-slate-900 font-medium">
                        {db.configuration?.storage_gb || 0} GB
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Max Connections</p>
                      <p className="text-sm text-slate-900 font-medium">
                        {db.configuration?.max_connections || 0}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Renewal Date</p>
                      <p className="text-sm text-slate-900">
                        {new Date(db.renewal_date).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Billing</p>
                      <p className="text-sm text-slate-900">
                        ${db.price.toFixed(2)}/{db.billing_cycle === 'yearly' ? 'yr' : 'mo'}
                      </p>
                    </div>
                  </div>

                  {showCredentials === db.id && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-slate-900">Connection Details</h4>
                        <button
                          onClick={() => setShowCredentials(null)}
                          className="text-xs text-slate-500 hover:text-slate-700"
                        >
                          Hide
                        </button>
                      </div>
                      <div className="space-y-2 text-xs font-mono">
                        <div>
                          <span className="text-slate-500">Host:</span>{' '}
                          <span className="text-slate-900">db.migrahosting.com</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Port:</span>{' '}
                          <span className="text-slate-900">
                            {db.configuration?.database_type === 'postgresql' ? '5432' : 
                             db.configuration?.database_type === 'mysql' ? '3306' : '27017'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Database:</span>{' '}
                          <span className="text-slate-900">{db.name}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Username:</span>{' '}
                          <span className="text-slate-900">{db.name}_user</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Password:</span>{' '}
                          <span className="text-slate-900">••••••••</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <button
                      onClick={() => setShowCredentials(showCredentials === db.id ? null : db.id)}
                      className="text-sm text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1"
                    >
                      <KeyIcon className="w-4 h-4" />
                      {showCredentials === db.id ? 'Hide' : 'Show'} Credentials
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => openEdit(db)}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                    title="Edit database"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(db)}
                    className="p-2 rounded-lg border border-red-200 hover:bg-red-50 text-red-600"
                    title="Delete database"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {editing ? 'Edit Database' : 'Create Database'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Database Name *
                </label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="my_database"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Lowercase letters, numbers, and underscores only
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  Database Type
                </label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.database_type}
                  onChange={(e) => setForm({ ...form, database_type: e.target.value as any })}
                >
                  <option value="postgresql">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                  <option value="mongodb">MongoDB</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Storage (GB)
                  </label>
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.storage_gb}
                    onChange={(e) => setForm({ ...form, storage_gb: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Max Connections
                  </label>
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.max_connections}
                    onChange={(e) => setForm({ ...form, max_connections: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Price
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-sm text-slate-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full border rounded-lg pl-7 pr-3 py-2 text-sm"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Billing Cycle
                  </label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.billing_cycle}
                    onChange={(e) => setForm({ ...form, billing_cycle: e.target.value as 'monthly' | 'yearly' })}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto_renew"
                  className="w-4 h-4 text-violet-600 rounded"
                  checked={form.auto_renew}
                  onChange={(e) => setForm({ ...form, auto_renew: e.target.checked })}
                />
                <label htmlFor="auto_renew" className="text-sm text-slate-700">
                  Enable auto-renewal
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700"
              >
                {editing ? 'Save Changes' : 'Create Database'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <XCircleIcon className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Delete Database?</h2>
                <p className="text-sm text-slate-600">
                  {deleteConfirm.name}
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              This will permanently delete this database and all its data. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700"
              >
                Delete Database
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
