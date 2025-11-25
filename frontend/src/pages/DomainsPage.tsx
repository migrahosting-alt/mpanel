// src/pages/DomainsPage.tsx
import React, { useState, useEffect } from 'react';
import { GlobeAltIcon, PlusIcon, PencilIcon, TrashIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import apiClient from '../lib/apiClient';
import toast from 'react-hot-toast';

type Domain = {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'suspended';
  configuration: {
    domain: string;
    nameservers: string[];
    auto_renew_enabled: boolean;
  };
  price: number;
  billing_cycle: 'monthly' | 'yearly';
  auto_renew: boolean;
  renewal_date: string;
  created_at: string;
};

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Domain | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Domain | null>(null);
  const [form, setForm] = useState({
    name: '',
    nameservers: 'ns1.migrahosting.com\nns2.migrahosting.com',
    price: 12.99,
    billing_cycle: 'yearly' as 'monthly' | 'yearly',
    auto_renew: true,
  });

  useEffect(() => {
    fetchDomains();
  }, []);

  const fetchDomains = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ services: Domain[] }>('/services?type=domain');
      setDomains(response.services);
    } catch (error) {
      toast.error('Failed to load domains');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      nameservers: 'ns1.migrahosting.com\nns2.migrahosting.com',
      price: 12.99,
      billing_cycle: 'yearly',
      auto_renew: true,
    });
    setModalOpen(true);
  };

  const openEdit = (domain: Domain) => {
    setEditing(domain);
    setForm({
      name: domain.name,
      nameservers: (domain.configuration?.nameservers || []).join('\n'),
      price: domain.price,
      billing_cycle: domain.billing_cycle,
      auto_renew: domain.auto_renew,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.name.includes('.')) {
      toast.error('Please enter a valid domain name (e.g., example.com)');
      return;
    }

    try {
      const nameserversArray = form.nameservers
        .split('\n')
        .map(ns => ns.trim())
        .filter(ns => ns.length > 0);

      if (editing) {
        await apiClient.put(`/services/${editing.id}`, {
          name: form.name,
          configuration: {
            domain: form.name,
            nameservers: nameserversArray,
            auto_renew_enabled: form.auto_renew,
          },
          price: form.price,
          billing_cycle: form.billing_cycle,
          auto_renew: form.auto_renew,
        });
        toast.success('Domain updated successfully');
      } else {
        await apiClient.post('/services', {
          type: 'domain',
          name: form.name,
          configuration: {
            domain: form.name,
            nameservers: nameserversArray,
            auto_renew_enabled: form.auto_renew,
          },
          price: form.price,
          billing_cycle: form.billing_cycle,
          auto_renew: form.auto_renew,
        });
        toast.success('Domain registered successfully');
      }
      
      setModalOpen(false);
      fetchDomains();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save domain');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    
    try {
      await apiClient.delete(`/services/${deleteConfirm.id}`);
      toast.success('Domain deleted successfully');
      setDeleteConfirm(null);
      fetchDomains();
    } catch (error) {
      toast.error('Failed to delete domain');
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
            <GlobeAltIcon className="w-7 h-7 text-violet-600" />
            Domains
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your domain names and DNS settings
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700 flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Register Domain
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
        </div>
      ) : domains.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-12 text-center">
          <GlobeAltIcon className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No domains yet</h3>
          <p className="text-slate-500 mb-4">
            Get started by registering your first domain name
          </p>
          <button
            onClick={openCreate}
            className="px-4 py-2 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700"
          >
            Register Domain
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {domains.map((domain) => (
            <div
              key={domain.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {domain.name}
                    </h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(domain.status)}`}>
                      {domain.status}
                    </span>
                    {domain.auto_renew && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
                        <CheckCircleIcon className="w-3 h-3" />
                        Auto-renew
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Nameservers</p>
                      <div className="text-sm text-slate-700">
                        {domain.configuration?.nameservers?.map((ns, idx) => (
                          <div key={idx} className="font-mono text-xs">{ns}</div>
                        )) || 'Not configured'}
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Renewal Date</p>
                      <p className="text-sm text-slate-900">
                        {new Date(domain.renewal_date).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Billing</p>
                      <p className="text-sm text-slate-900">
                        ${domain.price.toFixed(2)}/{domain.billing_cycle === 'yearly' ? 'yr' : 'mo'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => openEdit(domain)}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                    title="Edit domain"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(domain)}
                    className="p-2 rounded-lg border border-red-200 hover:bg-red-50 text-red-600"
                    title="Delete domain"
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
                {editing ? 'Edit Domain' : 'Register Domain'}
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
                <p className="text-xs text-slate-500 mt-1">
                  Enter the full domain name (e.g., example.com)
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  Nameservers
                </label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                  rows={4}
                  placeholder="ns1.migrahosting.com&#10;ns2.migrahosting.com"
                  value={form.nameservers}
                  onChange={(e) => setForm({ ...form, nameservers: e.target.value })}
                />
                <p className="text-xs text-slate-500 mt-1">
                  One nameserver per line
                </p>
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
                {editing ? 'Save Changes' : 'Register Domain'}
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
                <h2 className="text-lg font-semibold">Delete Domain?</h2>
                <p className="text-sm text-slate-600">
                  {deleteConfirm.name}
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              This will permanently delete this domain registration. This action cannot be undone.
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
                Delete Domain
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
