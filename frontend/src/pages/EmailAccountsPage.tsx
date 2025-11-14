// src/pages/EmailAccountsPage.tsx
import React, { useState, useEffect } from 'react';
import { EnvelopeIcon, PlusIcon, PencilIcon, TrashIcon, KeyIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { apiClient } from '../lib/apiClient';
import toast from 'react-hot-toast';

type EmailAccount = {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'suspended';
  configuration: {
    email_address: string;
    mailbox_quota_gb: number;
    aliases: string[];
    password?: string;
  };
  price: number;
  billing_cycle: 'monthly' | 'yearly';
  auto_renew: boolean;
  renewal_date: string;
  created_at: string;
};

export default function EmailAccountsPage() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EmailAccount | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<EmailAccount | null>(null);
  const [showPassword, setShowPassword] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    mailbox_quota_gb: 5,
    aliases: '',
    price: 2.99,
    billing_cycle: 'monthly' as 'monthly' | 'yearly',
    auto_renew: true,
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ services: EmailAccount[] }>('/services?type=email');
      setAccounts(response.services);
    } catch (error) {
      toast.error('Failed to load email accounts');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      mailbox_quota_gb: 5,
      aliases: '',
      price: 2.99,
      billing_cycle: 'monthly',
      auto_renew: true,
    });
    setModalOpen(true);
  };

  const openEdit = (account: EmailAccount) => {
    setEditing(account);
    setForm({
      name: account.name,
      mailbox_quota_gb: account.configuration?.mailbox_quota_gb || 5,
      aliases: (account.configuration?.aliases || []).join(', '),
      price: account.price,
      billing_cycle: account.billing_cycle,
      auto_renew: account.auto_renew,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.name.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      const aliasesArray = form.aliases
        .split(',')
        .map(alias => alias.trim())
        .filter(alias => alias.length > 0);

      if (editing) {
        await apiClient.put(`/services/${editing.id}`, {
          name: form.name,
          configuration: {
            email_address: form.name,
            mailbox_quota_gb: form.mailbox_quota_gb,
            aliases: aliasesArray,
          },
          price: form.price,
          billing_cycle: form.billing_cycle,
          auto_renew: form.auto_renew,
        });
        toast.success('Email account updated successfully');
      } else {
        await apiClient.post('/services', {
          type: 'email',
          name: form.name,
          configuration: {
            email_address: form.name,
            mailbox_quota_gb: form.mailbox_quota_gb,
            aliases: aliasesArray,
          },
          price: form.price,
          billing_cycle: form.billing_cycle,
          auto_renew: form.auto_renew,
        });
        toast.success('Email account created successfully');
      }
      
      setModalOpen(false);
      fetchAccounts();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save email account');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    
    try {
      await apiClient.delete(`/services/${deleteConfirm.id}`);
      toast.success('Email account deleted successfully');
      setDeleteConfirm(null);
      fetchAccounts();
    } catch (error) {
      toast.error('Failed to delete email account');
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
            <EnvelopeIcon className="w-7 h-7 text-violet-600" />
            Email Accounts
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your professional email accounts and aliases
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700 flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Create Email Account
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
        </div>
      ) : accounts.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-12 text-center">
          <EnvelopeIcon className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No email accounts yet</h3>
          <p className="text-slate-500 mb-4">
            Create your first professional email account
          </p>
          <button
            onClick={openCreate}
            className="px-4 py-2 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700"
          >
            Create Email Account
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
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Mailbox Quota</p>
                      <p className="text-sm text-slate-900 font-medium">
                        {account.configuration?.mailbox_quota_gb || 0} GB
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Aliases</p>
                      <p className="text-sm text-slate-900">
                        {account.configuration?.aliases?.length || 0} configured
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Billing</p>
                      <p className="text-sm text-slate-900">
                        ${account.price.toFixed(2)}/{account.billing_cycle === 'yearly' ? 'yr' : 'mo'}
                      </p>
                    </div>
                  </div>

                  {account.configuration?.aliases && account.configuration.aliases.length > 0 && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <p className="text-xs font-semibold text-blue-900 mb-1">Email Aliases:</p>
                      <div className="flex flex-wrap gap-2">
                        {account.configuration.aliases.map((alias, idx) => (
                          <span key={idx} className="px-2 py-1 text-xs bg-white text-blue-700 rounded border border-blue-200">
                            {alias}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {showPassword === account.id && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-slate-900">Email Settings</h4>
                        <button
                          onClick={() => setShowPassword(null)}
                          className="text-xs text-slate-500 hover:text-slate-700"
                        >
                          Hide
                        </button>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-slate-500 font-semibold mb-1">Incoming (IMAP)</p>
                            <p className="font-mono text-slate-900">mail.migrahosting.com</p>
                            <p className="text-slate-500">Port: 993 (SSL)</p>
                          </div>
                          <div>
                            <p className="text-slate-500 font-semibold mb-1">Outgoing (SMTP)</p>
                            <p className="font-mono text-slate-900">mail.migrahosting.com</p>
                            <p className="text-slate-500">Port: 465 (SSL)</p>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-slate-200">
                          <p className="text-slate-500">Username: <span className="font-mono text-slate-900">{account.name}</span></p>
                          <p className="text-slate-500">Password: <span className="font-mono text-slate-900">••••••••</span></p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-slate-100 flex gap-4">
                    <button
                      onClick={() => setShowPassword(showPassword === account.id ? null : account.id)}
                      className="text-sm text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1"
                    >
                      <KeyIcon className="w-4 h-4" />
                      {showPassword === account.id ? 'Hide' : 'Show'} Mail Settings
                    </button>
                    <a
                      href={`https://webmail.migrahosting.com?user=${encodeURIComponent(account.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Open Webmail →
                    </a>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => openEdit(account)}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                    title="Edit email account"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(account)}
                    className="p-2 rounded-lg border border-red-200 hover:bg-red-50 text-red-600"
                    title="Delete email account"
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
                {editing ? 'Edit Email Account' : 'Create Email Account'}
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
                  Email Address *
                </label>
                <input
                  type="email"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="user@example.com"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  Mailbox Quota (GB)
                </label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.mailbox_quota_gb}
                  onChange={(e) => setForm({ ...form, mailbox_quota_gb: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  Email Aliases
                </label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  rows={3}
                  placeholder="alias1@example.com, alias2@example.com"
                  value={form.aliases}
                  onChange={(e) => setForm({ ...form, aliases: e.target.value })}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Comma-separated list of email aliases
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
                <h2 className="text-lg font-semibold">Delete Email Account?</h2>
                <p className="text-sm text-slate-600">
                  {deleteConfirm.name}
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              This will permanently delete this email account and all associated messages. This action cannot be undone.
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
