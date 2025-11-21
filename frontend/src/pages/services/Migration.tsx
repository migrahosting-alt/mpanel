import { useState } from 'react';
import { ArrowRight, Upload, CheckCircle, Loader } from 'lucide-react';

export default function Migration() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formData, setFormData] = useState({
    domain: '',
    currentHost: '',
    migrationType: 'cpanel',
    cpanelUrl: '',
    cpanelUsername: '',
    cpanelPassword: '',
    ftpHost: '',
    ftpUsername: '',
    ftpPassword: '',
    contactEmail: '',
    contactPhone: '',
    notes: ''
  });
  const [migrationId, setMigrationId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.domain || !formData.contactEmail) {
      alert('Please fill in all required fields');
      return;
    }
    
    try {
      setSubmitting(true);
      
      const token = localStorage.getItem('token');
      
      const response = await fetch('http://localhost:2271/api/service-management/migration/request', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Migration request failed');
      }
      
      setMigrationId(result.data.migrationId);
      setStep(3);
    } catch (error) {
      console.error('Migration request error:', error);
      alert(error instanceof Error ? error.message : 'Failed to submit migration request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="container mx-auto px-6 py-8">
        {/* Hero Section */}
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold text-white">Website Migration</h1>
          <p className="text-lg text-white/70">
            We'll handle the entire migration process for you - zero downtime guaranteed
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mx-auto mb-12 flex max-w-3xl items-center justify-center gap-4">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-[#8A4DFF]' : 'text-white/30'}`}>
            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
              step >= 1 ? 'bg-[#8A4DFF]' : 'bg-white/10'
            }`}>
              1
            </div>
            <span className="text-sm font-medium">Details</span>
          </div>
          
          <ArrowRight className="text-white/30" />
          
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-[#8A4DFF]' : 'text-white/30'}`}>
            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
              step >= 2 ? 'bg-[#8A4DFF]' : 'bg-white/10'
            }`}>
              2
            </div>
            <span className="text-sm font-medium">Access Info</span>
          </div>
          
          <ArrowRight className="text-white/30" />
          
          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-[#8A4DFF]' : 'text-white/30'}`}>
            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
              step >= 3 ? 'bg-[#8A4DFF]' : 'bg-white/10'
            }`}>
              3
            </div>
            <span className="text-sm font-medium">Confirmation</span>
          </div>
        </div>

        {/* Form Content */}
        <div className="mx-auto max-w-3xl">
          {step === 1 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
              <h2 className="mb-6 text-2xl font-bold text-white">Migration Details</h2>
              
              <form onSubmit={(e) => { e.preventDefault(); setStep(2); }} className="space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-medium text-white/70">
                    Domain to Migrate <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.domain}
                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                    placeholder="example.com"
                    required
                    className="w-full rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-white placeholder:text-white/40"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/70">
                    Current Hosting Provider <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.currentHost}
                    onChange={(e) => setFormData({ ...formData, currentHost: e.target.value })}
                    placeholder="e.g., GoDaddy, Bluehost, HostGator"
                    required
                    className="w-full rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-white placeholder:text-white/40"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/70">
                    Contact Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    placeholder="your@email.com"
                    required
                    className="w-full rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-white placeholder:text-white/40"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/70">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    placeholder="+1 (555) 123-4567"
                    className="w-full rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-white placeholder:text-white/40"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/70">
                    Additional Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Any specific requirements or concerns..."
                    rows={4}
                    className="w-full rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-white placeholder:text-white/40"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-gradient-to-r from-[#6A5CFF] to-[#8A4DFF] py-3 font-medium text-white transition hover:brightness-110"
                >
                  Continue to Access Information
                </button>
              </form>
            </div>
          )}

          {step === 2 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
              <h2 className="mb-6 text-2xl font-bold text-white">Access Information</h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-medium text-white/70">
                    Migration Method
                  </label>
                  <select
                    value={formData.migrationType}
                    onChange={(e) => setFormData({ ...formData, migrationType: e.target.value })}
                    className="w-full rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-white"
                  >
                    <option value="cpanel">cPanel Access</option>
                    <option value="ftp">FTP Access</option>
                    <option value="manual">Manual (We'll Contact You)</option>
                  </select>
                </div>

                {formData.migrationType === 'cpanel' && (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/70">
                        cPanel URL
                      </label>
                      <input
                        type="url"
                        value={formData.cpanelUrl}
                        onChange={(e) => setFormData({ ...formData, cpanelUrl: e.target.value })}
                        placeholder="https://example.com:2083"
                        className="w-full rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-white placeholder:text-white/40"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/70">
                        cPanel Username
                      </label>
                      <input
                        type="text"
                        value={formData.cpanelUsername}
                        onChange={(e) => setFormData({ ...formData, cpanelUsername: e.target.value })}
                        placeholder="username"
                        className="w-full rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-white placeholder:text-white/40"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/70">
                        cPanel Password
                      </label>
                      <input
                        type="password"
                        value={formData.cpanelPassword}
                        onChange={(e) => setFormData({ ...formData, cpanelPassword: e.target.value })}
                        placeholder="••••••••"
                        className="w-full rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-white placeholder:text-white/40"
                      />
                    </div>
                  </>
                )}

                {formData.migrationType === 'ftp' && (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/70">
                        FTP Host
                      </label>
                      <input
                        type="text"
                        value={formData.ftpHost}
                        onChange={(e) => setFormData({ ...formData, ftpHost: e.target.value })}
                        placeholder="ftp.example.com"
                        className="w-full rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-white placeholder:text-white/40"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/70">
                        FTP Username
                      </label>
                      <input
                        type="text"
                        value={formData.ftpUsername}
                        onChange={(e) => setFormData({ ...formData, ftpUsername: e.target.value })}
                        placeholder="ftpuser"
                        className="w-full rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-white placeholder:text-white/40"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/70">
                        FTP Password
                      </label>
                      <input
                        type="password"
                        value={formData.ftpPassword}
                        onChange={(e) => setFormData({ ...formData, ftpPassword: e.target.value })}
                        placeholder="••••••••"
                        className="w-full rounded-xl border border-white/20 bg-slate-800 px-4 py-3 text-white placeholder:text-white/40"
                      />
                    </div>
                  </>
                )}

                <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
                  <p className="text-sm text-blue-300">
                    🔒 Your credentials are encrypted and only used for migration purposes. 
                    They will be deleted after migration is complete.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 rounded-xl border border-white/20 py-3 font-medium text-white transition hover:bg-white/10"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-xl bg-gradient-to-r from-[#6A5CFF] to-[#8A4DFF] py-3 font-medium text-white transition hover:brightness-110 disabled:opacity-50"
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader className="h-4 w-4 animate-spin" />
                        Submitting...
                      </span>
                    ) : (
                      'Submit Migration Request'
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {step === 3 && (
            <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-12 text-center">
              <CheckCircle className="mx-auto mb-6 h-20 w-20 text-green-400" />
              <h2 className="mb-4 text-3xl font-bold text-white">Migration Request Submitted!</h2>
              <p className="mb-6 text-lg text-white/70">
                Your migration request ID: <span className="font-mono text-[#8A4DFF]">{migrationId}</span>
              </p>
              
              <div className="mx-auto max-w-xl space-y-4 text-left text-white/70">
                <p>✅ Our migration team has received your request</p>
                <p>📧 You'll receive a confirmation email within 1 hour</p>
                <p>🚀 Migration typically completes within 24-48 hours</p>
                <p>📞 We'll contact you if we need any additional information</p>
              </div>

              <div className="mt-8">
                <a
                  href="/support"
                  className="inline-block rounded-xl bg-gradient-to-r from-[#6A5CFF] to-[#8A4DFF] px-8 py-3 font-medium text-white transition hover:brightness-110"
                >
                  Contact Support
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Info Section */}
        {step !== 3 && (
          <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-blue-500/20 bg-blue-500/10 p-6">
            <h3 className="mb-3 text-lg font-semibold text-white">Migration Process</h3>
            <ul className="space-y-2 text-sm text-white/70">
              <li>✅ <strong>Zero Downtime:</strong> Your site stays live during migration</li>
              <li>✅ <strong>Complete Transfer:</strong> Files, databases, emails - everything</li>
              <li>✅ <strong>DNS Assistance:</strong> We help update your domain settings</li>
              <li>✅ <strong>Free Service:</strong> No additional charges for migration</li>
              <li>✅ <strong>Expert Support:</strong> Experienced migration specialists</li>
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
