import { useState, useEffect } from 'react';
import { Shield, CheckCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react';

interface SSLCertificate {
  domain: string;
  hasSSL: boolean;
  issuer: string;
  expiresAt: string;
  autoRenew: boolean;
}

export default function SSLManagement() {
  const [domains, setDomains] = useState<SSLCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [installing, setInstalling] = useState(false);

  // Load SSL status for all domains
  useEffect(() => {
    loadSSLStatus();
  }, []);

  async function loadSSLStatus() {
    try {
      setLoading(true);
      
      // Get JWT token from localStorage
      const token = localStorage.getItem('token');
      
      // TODO: Get list of user's domains first
      const mockDomains = ['example.com', 'testsite.net', 'myshop.org'];
      
      const sslStatuses = await Promise.all(
        mockDomains.map(async (domain) => {
          try {
            const response = await fetch(`http://localhost:2271/api/service-management/ssl/status/${domain}`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            const result = await response.json();
            return result.data;
          } catch (err) {
            console.error(`Failed to load SSL for ${domain}:`, err);
            return {
              domain,
              hasSSL: false,
              issuer: 'N/A',
              expiresAt: '',
              autoRenew: false
            };
          }
        })
      );
      
      setDomains(sslStatuses);
    } catch (error) {
      console.error('Error loading SSL status:', error);
    } finally {
      setLoading(false);
    }
  }

  async function installSSL(domain: string) {
    try {
      setInstalling(true);
      
      const token = localStorage.getItem('token');
      
      const response = await fetch('http://localhost:2271/api/service-management/ssl/install', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ domain, type: 'lets-encrypt' })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'SSL installation failed');
      }
      
      alert(`SSL installation started for ${domain}. This may take a few minutes.`);
      
      // Reload status after a delay
      setTimeout(() => {
        loadSSLStatus();
      }, 3000);
    } catch (error) {
      console.error('SSL installation error:', error);
      alert(error instanceof Error ? error.message : 'Failed to install SSL');
    } finally {
      setInstalling(false);
    }
  }

  function getDaysUntilExpiry(expiresAt: string): number {
    if (!expiresAt) return 0;
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  function getExpiryStatus(daysLeft: number): { color: string; icon: JSX.Element; text: string } {
    if (daysLeft > 30) {
      return {
        color: 'text-green-400',
        icon: <CheckCircle className="h-5 w-5" />,
        text: 'Valid'
      };
    } else if (daysLeft > 7) {
      return {
        color: 'text-yellow-400',
        icon: <Clock className="h-5 w-5" />,
        text: 'Expiring Soon'
      };
    } else {
      return {
        color: 'text-red-400',
        icon: <AlertTriangle className="h-5 w-5" />,
        text: 'Expiring Very Soon'
      };
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="container mx-auto px-6 py-8">
        {/* Hero Section */}
        <div className="mb-12 text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <Shield className="h-12 w-12 text-[#8A4DFF]" />
            <h1 className="text-4xl font-bold text-white">SSL Certificate Management</h1>
          </div>
          <p className="text-lg text-white/70">
            Secure your websites with free Let's Encrypt SSL certificates
          </p>
        </div>

        {/* SSL Certificates List */}
        <div className="mx-auto max-w-5xl">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
              <RefreshCw className="mx-auto mb-4 h-12 w-12 animate-spin text-[#8A4DFF]" />
              <p className="text-white/70">Loading SSL certificates...</p>
            </div>
          ) : domains.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
              <Shield className="mx-auto mb-4 h-16 w-16 text-white/30" />
              <h3 className="mb-2 text-xl font-semibold text-white">No Domains Found</h3>
              <p className="text-white/70">Add a domain to your hosting plan to install SSL certificates</p>
            </div>
          ) : (
            <div className="space-y-4">
              {domains.map((cert) => {
                const daysLeft = getDaysUntilExpiry(cert.expiresAt);
                const status = getExpiryStatus(daysLeft);
                
                return (
                  <div
                    key={cert.domain}
                    className="rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:bg-white/10"
                  >
                    <div className="flex items-center justify-between">
                      {/* Domain Info */}
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-3">
                          <h3 className="text-xl font-semibold text-white">{cert.domain}</h3>
                          {cert.hasSSL && (
                            <div className={`flex items-center gap-2 ${status.color}`}>
                              {status.icon}
                              <span className="text-sm font-medium">{status.text}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="space-y-1 text-sm text-white/70">
                          {cert.hasSSL ? (
                            <>
                              <p>Issuer: {cert.issuer}</p>
                              <p>Expires: {new Date(cert.expiresAt).toLocaleDateString()} ({daysLeft} days)</p>
                              <p>Auto-renew: {cert.autoRenew ? '✅ Enabled' : '❌ Disabled'}</p>
                            </>
                          ) : (
                            <p className="text-red-400">⚠️ No SSL certificate installed</p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-3">
                        {cert.hasSSL ? (
                          <>
                            <button
                              onClick={() => installSSL(cert.domain)}
                              disabled={installing}
                              className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-600 disabled:opacity-50"
                            >
                              Renew Now
                            </button>
                            <button
                              className="rounded-xl border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                            >
                              Toggle Auto-Renew
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => installSSL(cert.domain)}
                            disabled={installing}
                            className="rounded-xl bg-gradient-to-r from-[#6A5CFF] to-[#8A4DFF] px-6 py-2 font-medium text-white transition hover:brightness-110 disabled:opacity-50"
                          >
                            {installing ? 'Installing...' : 'Install SSL'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Help Text */}
          <div className="mt-8 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-6">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
              <Shield className="h-5 w-5 text-blue-400" />
              About SSL Certificates
            </h3>
            <div className="space-y-2 text-sm text-white/70">
              <p>
                ✅ All SSL certificates are provided by <strong>Let's Encrypt</strong> at no additional cost
              </p>
              <p>
                🔄 Certificates are automatically renewed 30 days before expiration
              </p>
              <p>
                🔒 SSL certificates enable HTTPS for secure, encrypted connections
              </p>
              <p>
                ⚡ Installation typically completes within 5-10 minutes
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
