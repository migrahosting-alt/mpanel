// src/pages/SSLCertificatesPage.tsx
import React, { useState, useEffect } from 'react';
import {
  LockClosedIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
  DocumentPlusIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import apiClient from '../lib/apiClient';

type SSLCertificate = {
  id: number;
  domain: string;
  type: 'letsencrypt' | 'custom';
  status: 'active' | 'expiring' | 'expired' | 'revoked' | 'renewing';
  issued_at: string;
  expires_at: string;
  auto_renew: boolean;
  days_until_expiry: number;
};

function SSLCertificatesPage() {
  const [certificates, setCertificates] = useState<SSLCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [issueForm, setIssueForm] = useState({ domain: '', email: '' });
  const [uploadForm, setUploadForm] = useState({
    domain: '',
    certificate: '',
    private_key: '',
    chain: '',
  });

  useEffect(() => {
    fetchCertificates();
  }, []);

  const fetchCertificates = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/ssl');
      setCertificates(response.data.certificates);
    } catch (error) {
      console.error('Failed to fetch SSL certificates:', error);
      toast.error('Failed to load SSL certificates');
    } finally {
      setLoading(false);
    }
  };

  const handleIssueCertificate = async () => {
    if (!issueForm.domain || !issueForm.email) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      await apiClient.post('/ssl/issue', issueForm);
      toast.success(`SSL certificate issued for ${issueForm.domain}`);
      setIssueModalOpen(false);
      setIssueForm({ domain: '', email: '' });
      fetchCertificates();
    } catch (error: any) {
      console.error('Failed to issue certificate:', error);
      toast.error(error.response?.data?.error || 'Failed to issue certificate');
    }
  };

  const handleUploadCertificate = async () => {
    if (!uploadForm.domain || !uploadForm.certificate || !uploadForm.private_key) {
      toast.error('Domain, certificate, and private key are required');
      return;
    }

    try {
      await apiClient.post('/ssl/upload', uploadForm);
      toast.success(`SSL certificate uploaded for ${uploadForm.domain}`);
      setUploadModalOpen(false);
      setUploadForm({ domain: '', certificate: '', private_key: '', chain: '' });
      fetchCertificates();
    } catch (error: any) {
      console.error('Failed to upload certificate:', error);
      toast.error(error.response?.data?.error || 'Failed to upload certificate');
    }
  };

  const handleRenewCertificate = async (id: number, domain: string) => {
    try {
      await apiClient.post(`/ssl/${id}/renew`);
      toast.success(`Certificate renewal initiated for ${domain}`);
      fetchCertificates();
    } catch (error: any) {
      console.error('Failed to renew certificate:', error);
      toast.error(error.response?.data?.error || 'Failed to renew certificate');
    }
  };

  const handleToggleAutoRenew = async (id: number, currentValue: boolean) => {
    try {
      await apiClient.put(`/ssl/${id}/auto-renew`, { auto_renew: !currentValue });
      toast.success(`Auto-renewal ${!currentValue ? 'enabled' : 'disabled'}`);
      fetchCertificates();
    } catch (error) {
      console.error('Failed to toggle auto-renew:', error);
      toast.error('Failed to update auto-renewal setting');
    }
  };

  const handleRevokeCertificate = async (id: number, domain: string) => {
    if (!confirm(`Are you sure you want to revoke the certificate for ${domain}?`)) {
      return;
    }

    try {
      await apiClient.delete(`/ssl/${id}`);
      toast.success(`Certificate revoked for ${domain}`);
      fetchCertificates();
    } catch (error) {
      console.error('Failed to revoke certificate:', error);
      toast.error('Failed to revoke certificate');
    }
  };

  const getStatusBadge = (cert: SSLCertificate) => {
    if (cert.status === 'revoked') {
      return { color: 'bg-red-100 text-red-700', icon: XCircleIcon, text: 'Revoked' };
    }
    if (cert.status === 'renewing') {
      return { color: 'bg-blue-100 text-blue-700', icon: ArrowPathIcon, text: 'Renewing' };
    }
    if (cert.days_until_expiry < 0) {
      return { color: 'bg-red-100 text-red-700', icon: ExclamationTriangleIcon, text: 'Expired' };
    }
    if (cert.days_until_expiry < 30) {
      return { color: 'bg-yellow-100 text-yellow-700', icon: ExclamationTriangleIcon, text: 'Expiring Soon' };
    }
    return { color: 'bg-green-100 text-green-700', icon: CheckCircleIcon, text: 'Active' };
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">SSL Certificates</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage SSL/TLS certificates for your domains
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setIssueModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700 flex items-center space-x-2"
          >
            <ShieldCheckIcon className="w-4 h-4" />
            <span>Issue Let's Encrypt</span>
          </button>
          <button
            onClick={() => setUploadModalOpen(true)}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 flex items-center space-x-2"
          >
            <DocumentPlusIcon className="w-4 h-4" />
            <span>Upload Custom</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Loading SSL certificates…</div>
      ) : certificates.length === 0 ? (
        <div className="border border-dashed rounded-xl p-12 text-center">
          <LockClosedIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No SSL Certificates</h3>
          <p className="text-sm text-slate-500 mb-6">
            Secure your domains with free Let's Encrypt SSL certificates
          </p>
          <button
            onClick={() => setIssueModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700"
          >
            Issue Your First Certificate
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {certificates.map((cert) => {
            const statusBadge = getStatusBadge(cert);
            const StatusIcon = statusBadge.icon;

            return (
              <div key={cert.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <LockClosedIcon className="w-5 h-5 text-violet-600" />
                    <h3 className="font-semibold text-slate-800">{cert.domain}</h3>
                  </div>
                  <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${statusBadge.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    <span>{statusBadge.text}</span>
                  </span>
                </div>

                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Type:</span>
                    <span className="font-medium">
                      {cert.type === 'letsencrypt' ? "Let's Encrypt" : 'Custom'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Issued:</span>
                    <span className="font-medium">
                      {new Date(cert.issued_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Expires:</span>
                    <span className="font-medium">
                      {new Date(cert.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Days Left:</span>
                    <span className={`font-medium ${cert.days_until_expiry < 30 ? 'text-red-600' : 'text-green-600'}`}>
                      {Math.max(0, Math.floor(cert.days_until_expiry))} days
                    </span>
                  </div>
                  {cert.type === 'letsencrypt' && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Auto-Renew:</span>
                      <button
                        onClick={() => handleToggleAutoRenew(cert.id, cert.auto_renew)}
                        className={`
                          relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                          ${cert.auto_renew ? 'bg-violet-600' : 'bg-slate-300'}
                        `}
                      >
                        <span
                          className={`
                            inline-block h-3 w-3 transform rounded-full bg-white transition-transform
                            ${cert.auto_renew ? 'translate-x-5' : 'translate-x-1'}
                          `}
                        />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex space-x-2">
                  {cert.type === 'letsencrypt' && cert.status === 'active' && (
                    <button
                      onClick={() => handleRenewCertificate(cert.id, cert.domain)}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 flex items-center justify-center space-x-1"
                    >
                      <ArrowPathIcon className="w-3 h-3" />
                      <span>Renew</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleRevokeCertificate(cert.id, cert.domain)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Issue Let's Encrypt Modal */}
      {issueModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Issue Let's Encrypt Certificate</h2>
              <button onClick={() => setIssueModalOpen(false)}>✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Domain Name</label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="example.com"
                  value={issueForm.domain}
                  onChange={(e) => setIssueForm({ ...issueForm, domain: e.target.value })}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Certificate will also cover www.{issueForm.domain || 'example.com'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Email Address</label>
                <input
                  type="email"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="admin@example.com"
                  value={issueForm.email}
                  onChange={(e) => setIssueForm({ ...issueForm, email: e.target.value })}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Used for renewal reminders and certificate notifications
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                <strong>Note:</strong> Make sure your domain points to this server and is accessible via HTTP before issuing a certificate.
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-2">
              <button
                onClick={() => setIssueModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleIssueCertificate}
                className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium"
              >
                Issue Certificate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Custom Certificate Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Upload Custom SSL Certificate</h2>
              <button onClick={() => setUploadModalOpen(false)}>✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Domain Name</label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="example.com"
                  value={uploadForm.domain}
                  onChange={(e) => setUploadForm({ ...uploadForm, domain: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Certificate (PEM)</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-xs font-mono"
                  rows={8}
                  placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                  value={uploadForm.certificate}
                  onChange={(e) => setUploadForm({ ...uploadForm, certificate: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Private Key (PEM)</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-xs font-mono"
                  rows={8}
                  placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                  value={uploadForm.private_key}
                  onChange={(e) => setUploadForm({ ...uploadForm, private_key: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Certificate Chain (Optional)</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-xs font-mono"
                  rows={6}
                  placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                  value={uploadForm.chain}
                  onChange={(e) => setUploadForm({ ...uploadForm, chain: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-2">
              <button
                onClick={() => setUploadModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadCertificate}
                className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium"
              >
                Upload Certificate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SSLCertificatesPage;
