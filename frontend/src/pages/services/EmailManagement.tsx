import { useState, useEffect } from 'react';
import { Mail, Plus, Trash2, Key, HardDrive } from 'lucide-react';

interface EmailAccount {
  email: string;
  quota: string;
  used: string;
  created: string;
}

export default function EmailManagement() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDomain, setSelectedDomain] = useState('example.com');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newAccount, setNewAccount] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    quota: 5000
  });

  useEffect(() => {
    loadAccounts();
  }, [selectedDomain]);

  async function loadAccounts() {
    try {
      setLoading(true);
      
      const token = localStorage.getItem('token');
      
      const response = await fetch(`http://localhost:2271/api/service-management/email/list?domain=${selectedDomain}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      
      if (response.ok) {
        setAccounts(result.data || []);
      } else {
        // Set empty array for non-implemented features
        setAccounts([]);
      }
    } catch (error) {
      console.error('Error loading email accounts:', error);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }

  async function createAccount() {
    // Validation
    if (!newAccount.username.trim()) {
      alert('Please enter a username');
      return;
    }
    
    if (newAccount.password.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }
    
    if (newAccount.password !== newAccount.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    try {
      setCreating(true);
      
      const email = `${newAccount.username}@${selectedDomain}`;
      
      const token = localStorage.getItem('token');
      
      const response = await fetch('http://localhost:2271/api/service-management/email/create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email,
          password: newAccount.password,
          quota: newAccount.quota
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create email account');
      }
      
      alert(`Email account created: ${email}`);
      
      // Reset form
      setNewAccount({
        username: '',
        password: '',
        confirmPassword: '',
        quota: 5000
      });
      setShowCreateForm(false);
      
      // Reload accounts
      loadAccounts();
    } catch (error) {
      console.error('Email creation error:', error);
      alert(error instanceof Error ? error.message : 'Failed to create email account');
    } finally {
      setCreating(false);
    }
  }

  function getUsagePercentage(used: string, quota: string): number {
    const usedMB = parseFloat(used);
    const quotaMB = parseFloat(quota);
    return (usedMB / quotaMB) * 100;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="container mx-auto px-6 py-8">
        {/* Hero Section */}
        <div className="mb-12 text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <Mail className="h-12 w-12 text-[#8A4DFF]" />
            <h1 className="text-4xl font-bold text-white">Email Account Management</h1>
          </div>
          <p className="text-lg text-white/70">
            Create and manage professional email accounts for your domains
          </p>
        </div>

        {/* Domain Selector & Create Button */}
        <div className="mx-auto mb-8 max-w-5xl">
          <div className="flex items-center justify-between">
            <div>
              <label className="block mb-2 text-sm font-medium text-white/70">Select Domain</label>
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="rounded-xl border border-white/20 bg-slate-800 px-4 py-2 text-white"
              >
                <option value="example.com">example.com</option>
                <option value="testsite.net">testsite.net</option>
                <option value="myshop.org">myshop.org</option>
              </select>
            </div>
            
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#6A5CFF] to-[#8A4DFF] px-6 py-3 font-medium text-white transition hover:brightness-110"
            >
              <Plus className="h-5 w-5" />
              Create Email Account
            </button>
          </div>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="mx-auto mb-8 max-w-5xl rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="mb-4 text-xl font-semibold text-white">New Email Account</h3>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block mb-2 text-sm font-medium text-white/70">Username</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newAccount.username}
                    onChange={(e) => setNewAccount({ ...newAccount, username: e.target.value })}
                    placeholder="admin"
                    className="flex-1 rounded-xl border border-white/20 bg-slate-800 px-4 py-2 text-white placeholder:text-white/40"
                  />
                  <span className="text-white/70">@{selectedDomain}</span>
                </div>
              </div>
              
              <div>
                <label className="block mb-2 text-sm font-medium text-white/70">Mailbox Quota</label>
                <select
                  value={newAccount.quota}
                  onChange={(e) => setNewAccount({ ...newAccount, quota: Number(e.target.value) })}
                  className="w-full rounded-xl border border-white/20 bg-slate-800 px-4 py-2 text-white"
                >
                  <option value={1000}>1 GB</option>
                  <option value={5000}>5 GB</option>
                  <option value={10000}>10 GB</option>
                  <option value={25000}>25 GB</option>
                </select>
              </div>
              
              <div>
                <label className="block mb-2 text-sm font-medium text-white/70">Password</label>
                <input
                  type="password"
                  value={newAccount.password}
                  onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })}
                  placeholder="Minimum 8 characters"
                  className="w-full rounded-xl border border-white/20 bg-slate-800 px-4 py-2 text-white placeholder:text-white/40"
                />
              </div>
              
              <div>
                <label className="block mb-2 text-sm font-medium text-white/70">Confirm Password</label>
                <input
                  type="password"
                  value={newAccount.confirmPassword}
                  onChange={(e) => setNewAccount({ ...newAccount, confirmPassword: e.target.value })}
                  placeholder="Re-enter password"
                  className="w-full rounded-xl border border-white/20 bg-slate-800 px-4 py-2 text-white placeholder:text-white/40"
                />
              </div>
            </div>
            
            <div className="mt-6 flex gap-3">
              <button
                onClick={createAccount}
                disabled={creating}
                className="rounded-xl bg-gradient-to-r from-[#6A5CFF] to-[#8A4DFF] px-6 py-2 font-medium text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Account'}
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="rounded-xl border border-white/20 px-6 py-2 font-medium text-white transition hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Email Accounts List */}
        <div className="mx-auto max-w-5xl">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
              <Mail className="mx-auto mb-4 h-12 w-12 animate-pulse text-[#8A4DFF]" />
              <p className="text-white/70">Loading email accounts...</p>
            </div>
          ) : accounts.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
              <Mail className="mx-auto mb-4 h-16 w-16 text-white/30" />
              <h3 className="mb-2 text-xl font-semibold text-white">Email Management Coming Soon</h3>
              <p className="text-white/70 mb-2">
                Email account management is not enabled yet in your environment.
              </p>
              <p className="text-white/50 text-sm">
                This module will be available in a future update.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {accounts.map((account) => {
                const usagePercent = getUsagePercentage(account.used, account.quota);
                
                return (
                  <div
                    key={account.email}
                    className="rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:bg-white/10"
                  >
                    <div className="flex items-center justify-between">
                      {/* Account Info */}
                      <div className="flex-1">
                        <div className="mb-3 flex items-center gap-3">
                          <Mail className="h-6 w-6 text-[#8A4DFF]" />
                          <div>
                            <h3 className="text-lg font-semibold text-white">{account.email}</h3>
                            <p className="text-sm text-white/70">
                              Created: {new Date(account.created).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        
                        {/* Storage Usage Bar */}
                        <div className="mb-2">
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="text-white/70">Storage Usage</span>
                            <span className="text-white">{account.used} / {account.quota}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-700">
                            <div
                              className={`h-full rounded-full transition-all ${
                                usagePercent > 90 ? 'bg-red-500' :
                                usagePercent > 70 ? 'bg-yellow-500' :
                                'bg-green-500'
                              }`}
                              style={{ width: `${usagePercent}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="ml-6 flex gap-3">
                        <button
                          className="flex items-center gap-2 rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-600"
                        >
                          <Key className="h-4 w-4" />
                          Reset Password
                        </button>
                        
                        <button
                          className="flex items-center gap-2 rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-600"
                        >
                          <HardDrive className="h-4 w-4" />
                          Change Quota
                        </button>
                        
                        <button
                          className="rounded-xl border border-red-500/50 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Info Section */}
          <div className="mt-8 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-6">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
              <Mail className="h-5 w-5 text-blue-400" />
              Email Setup Instructions
            </h3>
            <div className="space-y-2 text-sm text-white/70">
              <p>
                <strong>Incoming (IMAP):</strong> mail.{selectedDomain} | Port: 993 (SSL)
              </p>
              <p>
                <strong>Outgoing (SMTP):</strong> mail.{selectedDomain} | Port: 465 (SSL)
              </p>
              <p>
                📧 Use your full email address as the username
              </p>
              <p>
                🔒 All connections use SSL/TLS encryption for security
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
