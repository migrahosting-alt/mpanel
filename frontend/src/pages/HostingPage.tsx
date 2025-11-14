// src/pages/HostingPage.tsx
import React, { useState, useEffect } from 'react';
import { ServerIcon, PlusIcon, PencilIcon, TrashIcon, FolderIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { apiClient } from '../lib/apiClient';
import toast from 'react-hot-toast';

type HostingAccount = {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'suspended';
  configuration: {
    domain: string;
    disk_quota_gb: number;
    bandwidth_quota_gb: number;
    ftp_enabled: boolean;
    ssh_enabled: boolean;
  };
  price: number;
  billing_cycle: 'monthly' | 'yearly';
  auto_renew: boolean;
  renewal_date: string;
  created_at: string;
};

export default function HostingPage() {
  const [accounts, setAccounts] = useState<HostingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<HostingAccount | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<HostingAccount | null>(null);
  const [form, setForm] = useState({
    name: '',
    disk_quota_gb: 10,
    bandwidth_quota_gb: 100,
    ftp_enabled: true,
    ssh_enabled: false,
    price: 9.99,
    billing_cycle: 'monthly' as 'monthly' | 'yearly',
    auto_renew: true,
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ services: HostingAccount[] }>('/services?type=hosting');
      setAccounts(response.services);
    } catch (error) {
      toast.error('Failed to load hosting accounts');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      disk_quota_gb: 10,
      bandwidth_quota_gb: 100,
      ftp_enabled: true,
      ssh_enabled: false,
      price: 9.99,
      billing_cycle: 'monthly',
      auto_renew: true,
    });
    setModalOpen(true);
  };

  const openEdit = (account: HostingAccount) => {
    setEditing(account);
    setForm({
      name: account.name,
      disk_quota_gb: account.configuration?.disk_quota_gb || 10,
      bandwidth_quota_gb: account.configuration?.bandwidth_quota_gb || 100,
      ftp_enabled: account.configuration?.ftp_enabled ?? true,
      ssh_enabled: account.configuration?.ssh_enabled ?? false,
      price: account.price,
      billing_cycle: account.billing_cycle,
      auto_renew: account.auto_renew,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name) {
      toast.error('Please enter a domain name');
      return;
    }

    try {
      if (editing) {
        await apiClient.put(`/services/${editing.id}`, {
          name: form.name,
          configuration: {
            domain: form.name,
            disk_quota_gb: form.disk_quota_gb,
            bandwidth_quota_gb: form.bandwidth_quota_gb,
            ftp_enabled: form.ftp_enabled,
            ssh_enabled: form.ssh_enabled,
          },
          price: form.price,
          billing_cycle: form.billing_cycle,
          auto_renew: form.auto_renew,
        });
        toast.success('Hosting account updated successfully');
      } else {
        await apiClient.post('/services', {
          type: 'hosting',
          name: form.name,
          configuration: {
            domain: form.name,
            disk_quota_gb: form.disk_quota_gb,
            bandwidth_quota_gb: form.bandwidth_quota_gb,
            ftp_enabled: form.ftp_enabled,
            ssh_enabled: form.ssh_enabled,
          },
          price: form.price,
          billing_cycle: form.billing_cycle,
          auto_renew: form.auto_renew,
        });
        toast.success('Hosting account created successfully');
      }
      
      setModalOpen(false);
      fetchAccounts();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save hosting account');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    
    try {
      await apiClient.delete(`/services/${deleteConfirm.id}`);
      toast.success('Hosting account deleted successfully');
      setDeleteConfirm(null);
      fetchAccounts();
    } catch (error) {
      toast.error('Failed to delete hosting account');
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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ServerIcon className="w-7 h-7 text-violet-600" />
            Hosting Accounts
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your web hosting accounts and resources
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700 flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Create Hosting Account
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
        </div>
      ) : accounts.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-12 text-center">
          <ServerIcon className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No hosting accounts yet</h3>
          <p className="text-slate-500 mb-4">
            Create your first hosting account to get started
          </p>
          <button
            onClick={openCreate}
            className="px-4 py-2 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700"
          >
            Create Hosting Account
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {account.name}
                    </h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(account.status)}`}>
                      {account.status}
                    </span>
                    {account.auto_renew && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
                        <CheckCircleIcon className="w-3 h-3" />
                        Auto-renew
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Disk Space</p>
                      <p className="text-sm text-slate-900 font-medium">
                        {account.configuration?.disk_quota_gb || 0} GB
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Bandwidth</p>
                      <p className="text-sm text-slate-900 font-medium">
                        {account.configuration?.bandwidth_quota_gb || 0} GB/mo
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Features</p>
                      <div className="flex gap-2">
                        {account.configuration?.ftp_enabled && (
                          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">FTP</span>
                        )}
                        {account.configuration?.ssh_enabled && (
                          <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">SSH</span>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Billing</p>
                      <p className="text-sm text-slate-900">
                        ${account.price.toFixed(2)}/{account.billing_cycle === 'yearly' ? 'yr' : 'mo'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <button className="text-sm text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1">
                      <FolderIcon className="w-4 h-4" />
                      Open File Manager
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => openEdit(account)}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                    title="Edit account"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(account)}
                    className="p-2 rounded-lg border border-red-200 hover:bg-red-50 text-red-600"
                    title="Delete account"
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
                {editing ? 'Edit Hosting Account' : 'Create Hosting Account'}
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
                  Domain Name *
                </label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="example.com"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Disk Space (GB)
                  </label>
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.disk_quota_gb}
                    onChange={(e) => setForm({ ...form, disk_quota_gb: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Bandwidth (GB/mo)
                  </label>
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.bandwidth_quota_gb}
                    onChange={(e) => setForm({ ...form, bandwidth_quota_gb: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="ftp_enabled"
                    className="w-4 h-4 text-violet-600 rounded"
                    checked={form.ftp_enabled}
                    onChange={(e) => setForm({ ...form, ftp_enabled: e.target.checked })}
                  />
                  <label htmlFor="ftp_enabled" className="text-sm text-slate-700">
                    Enable FTP
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="ssh_enabled"
                    className="w-4 h-4 text-violet-600 rounded"
                    checked={form.ssh_enabled}
                    onChange={(e) => setForm({ ...form, ssh_enabled: e.target.checked })}
                  />
                  <label htmlFor="ssh_enabled" className="text-sm text-slate-700">
                    Enable SSH
                  </label>
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
                {editing ? 'Save Changes' : 'Create Account'}
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
                <h2 className="text-lg font-semibold">Delete Hosting Account?</h2>
                <p className="text-sm text-slate-600">
                  {deleteConfirm.name}
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              This will permanently delete this hosting account and all associated files. This action cannot be undone.
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
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
