import { useState, useEffect } from 'react';
import { Database, Download, RotateCcw, Trash2, Plus, Clock } from 'lucide-react';

interface Backup {
  id: string;
  domain: string;
  createdAt: string;
  size: string;
  type: 'automatic' | 'manual';
}

export default function BackupManagement() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDomain, setSelectedDomain] = useState('example.com');
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    loadBackups();
  }, [selectedDomain]);

  async function loadBackups() {
    try {
      setLoading(true);
      
      const token = localStorage.getItem('token');
      
      const response = await fetch(`http://localhost:2271/api/service-management/backups?domain=${selectedDomain}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      
      if (response.ok) {
        setBackups(result.data);
      }
    } catch (error) {
      console.error('Error loading backups:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createBackup() {
    try {
      setCreating(true);
      
      const label = prompt('Enter a label for this backup (optional):');
      
      const token = localStorage.getItem('token');
      
      const response = await fetch('http://localhost:2271/api/service-management/backups/create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ domain: selectedDomain, label })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Backup creation failed');
      }
      
      alert('Backup creation started! This may take a few minutes.');
      
      // Reload backups after delay
      setTimeout(() => {
        loadBackups();
      }, 3000);
    } catch (error) {
      console.error('Backup creation error:', error);
      alert(error instanceof Error ? error.message : 'Failed to create backup');
    } finally {
      setCreating(false);
    }
  }

  async function restoreBackup(backupId: string, domain: string) {
    const confirmed = confirm(
      `⚠️ WARNING: This will restore ${domain} to a previous state.\n\n` +
      `Your current website will be replaced with this backup.\n` +
      `This action cannot be undone.\n\n` +
      `Are you sure you want to continue?`
    );
    
    if (!confirmed) return;
    
    try {
      setRestoring(backupId);
      
      const token = localStorage.getItem('token');
      
      const response = await fetch('http://localhost:2271/api/service-management/backups/restore', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ backupId, domain })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Restore failed');
      }
      
      alert('Restore started! Your website will be briefly unavailable during the restore process.');
    } catch (error) {
      console.error('Restore error:', error);
      alert(error instanceof Error ? error.message : 'Failed to restore backup');
    } finally {
      setRestoring(null);
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="container mx-auto px-6 py-8">
        {/* Hero Section */}
        <div className="mb-12 text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <Database className="h-12 w-12 text-[#8A4DFF]" />
            <h1 className="text-4xl font-bold text-white">Backup Management</h1>
          </div>
          <p className="text-lg text-white/70">
            Automatic daily backups with one-click restore
          </p>
        </div>

        {/* Domain Selector & Create Backup */}
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
              onClick={createBackup}
              disabled={creating}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#6A5CFF] to-[#8A4DFF] px-6 py-3 font-medium text-white transition hover:brightness-110 disabled:opacity-50"
            >
              <Plus className="h-5 w-5" />
              {creating ? 'Creating...' : 'Create Manual Backup'}
            </button>
          </div>
        </div>

        {/* Backups List */}
        <div className="mx-auto max-w-5xl">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
              <Clock className="mx-auto mb-4 h-12 w-12 animate-spin text-[#8A4DFF]" />
              <p className="text-white/70">Loading backups...</p>
            </div>
          ) : backups.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
              <Database className="mx-auto mb-4 h-16 w-16 text-white/30" />
              <h3 className="mb-2 text-xl font-semibold text-white">No Backups Found</h3>
              <p className="text-white/70">Create your first backup using the button above</p>
            </div>
          ) : (
            <div className="space-y-4">
              {backups.map((backup) => (
                <div
                  key={backup.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:bg-white/10"
                >
                  <div className="flex items-center justify-between">
                    {/* Backup Info */}
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <Database className="h-6 w-6 text-[#8A4DFF]" />
                        <div>
                          <h3 className="text-lg font-semibold text-white">
                            {backup.domain}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-white/70">
                            <span>{formatDate(backup.createdAt)}</span>
                            <span>•</span>
                            <span>{backup.size}</span>
                            <span>•</span>
                            <span className={
                              backup.type === 'automatic' 
                                ? 'text-blue-400' 
                                : 'text-green-400'
                            }>
                              {backup.type === 'automatic' ? '🔄 Automatic' : '👤 Manual'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => restoreBackup(backup.id, backup.domain)}
                        disabled={restoring === backup.id}
                        className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
                      >
                        <RotateCcw className="h-4 w-4" />
                        {restoring === backup.id ? 'Restoring...' : 'Restore'}
                      </button>
                      
                      <button
                        className="flex items-center gap-2 rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-600"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </button>
                      
                      {backup.type === 'manual' && (
                        <button
                          className="rounded-xl border border-red-500/50 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info Section */}
          <div className="mt-8 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-6">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
              <Database className="h-5 w-5 text-blue-400" />
              Backup Information
            </h3>
            <div className="space-y-2 text-sm text-white/70">
              <p>
                🔄 <strong>Automatic backups</strong> run daily at 2:00 AM server time
              </p>
              <p>
                💾 Backups include all website files and databases
              </p>
              <p>
                📅 Retention: 30 days for automatic backups, unlimited for manual backups
              </p>
              <p>
                ⚡ One-click restore to any previous backup point
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
