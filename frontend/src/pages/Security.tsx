import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { apiClient } from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';
import LoadingSkeleton from '../components/LoadingSkeleton';

interface TwoFactorStatus {
  enabled: boolean;
  remainingBackupCodes: number;
}

interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

interface Session {
  id: number;
  device_info: {
    browser?: string;
    os?: string;
    device?: string;
  };
  ip_address: string;
  location?: string;
  created_at: string;
  last_activity: string;
}

interface AuditLog {
  id: number;
  action: string;
  resource_type?: string;
  details?: { message?: string };
  ip_address?: string;
  created_at: string;
}

export default function Security() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [activeTab, setActiveTab] = useState<'2fa' | 'sessions' | 'audit'>('2fa');

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const fetchSecurityData = async () => {
    try {
      setLoading(true);
      const [statusRes, sessionsRes, logsRes] = await Promise.all([
        apiClient.get('/security/2fa/status', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        apiClient.get('/security/sessions', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        apiClient.get('/security/audit-logs?limit=20', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setTwoFactorStatus(statusRes.data);
      setSessions(sessionsRes.data.sessions || []);
      setAuditLogs(logsRes.data.logs || []);
    } catch (error: any) {
      console.error('Error fetching security data:', error);
      toast.error('Failed to load security settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupTwoFactor = async () => {
    try {
      const response = await apiClient.post(
        '/security/2fa/setup',
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSetup(response.data);
      setShowSetup(true);
      setShowBackupCodes(true);
    } catch (error: any) {
      console.error('Error setting up 2FA:', error);
      toast.error('Failed to setup two-factor authentication');
    }
  };

  const handleVerifyAndEnable = async () => {
    if (!setup || !verificationCode) {
      toast.error('Please enter the verification code');
      return;
    }

    try {
      await apiClient.post(
        '/security/2fa/enable',
        {
          secret: setup.secret,
          token: verificationCode,
          backupCodes: setup.backupCodes,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Two-factor authentication enabled successfully');
      setShowSetup(false);
      setVerificationCode('');
      fetchSecurityData();
    } catch (error: any) {
      console.error('Error enabling 2FA:', error);
      toast.error(error.response?.data?.error || 'Invalid verification code');
    }
  };

  const handleDisableTwoFactor = async () => {
    if (!confirm('Are you sure you want to disable two-factor authentication?')) {
      return;
    }

    const token2fa = prompt('Enter a verification code from your authenticator app:');
    if (!token2fa) return;

    try {
      await apiClient.post(
        '/security/2fa/disable',
        { token: token2fa },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Two-factor authentication disabled');
      fetchSecurityData();
    } catch (error: any) {
      console.error('Error disabling 2FA:', error);
      toast.error('Failed to disable two-factor authentication');
    }
  };

  const handleRegenerateBackupCodes = async () => {
    if (!confirm('Regenerate backup codes? This will invalidate your current codes.')) {
      return;
    }

    const password = prompt('Enter your password to confirm:');
    if (!password) return;

    try {
      const response = await apiClient.post(
        '/security/2fa/backup-codes/regenerate',
        { password },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSetup({
        secret: '',
        qrCodeUrl: '',
        backupCodes: response.data.backupCodes,
      });
      setShowBackupCodes(true);
      toast.success('Backup codes regenerated successfully');
    } catch (error: any) {
      console.error('Error regenerating backup codes:', error);
      toast.error('Failed to regenerate backup codes');
    }
  };

  const handleRevokeSession = async (sessionId: number) => {
    if (!confirm('Revoke this session?')) return;

    try {
      await apiClient.delete(`/security/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success('Session revoked successfully');
      fetchSecurityData();
    } catch (error: any) {
      console.error('Error revoking session:', error);
      toast.error('Failed to revoke session');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="p-6">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Security Settings
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Manage your account security, two-factor authentication, and active sessions
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('2fa')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === '2fa'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            Two-Factor Authentication
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'sessions'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            Active Sessions ({sessions.length})
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'audit'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            Audit Log
          </button>
        </nav>
      </div>

      {/* Two-Factor Authentication Tab */}
      {activeTab === '2fa' && (
        <div className="space-y-6">
          {/* 2FA Status Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Two-Factor Authentication
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Add an extra layer of security to your account by requiring a verification code in addition to your password.
                </p>
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      twoFactorStatus?.enabled
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}
                  >
                    {twoFactorStatus?.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  {twoFactorStatus?.enabled && (
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {twoFactorStatus.remainingBackupCodes} backup codes remaining
                    </span>
                  )}
                </div>
              </div>
              <div>
                {twoFactorStatus?.enabled ? (
                  <button
                    onClick={handleDisableTwoFactor}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Disable 2FA
                  </button>
                ) : (
                  <button
                    onClick={handleSetupTwoFactor}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Enable 2FA
                  </button>
                )}
              </div>
            </div>

            {twoFactorStatus?.enabled && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleRegenerateBackupCodes}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  Regenerate Backup Codes
                </button>
              </div>
            )}
          </div>

          {/* Setup Modal */}
          {showSetup && setup && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  Setup Two-Factor Authentication
                </h2>

                <div className="space-y-6">
                  {/* Step 1 */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Step 1: Scan QR Code
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                    </p>
                    <div className="flex justify-center p-4 bg-white rounded-lg">
                      <img src={setup.qrCodeUrl} alt="2FA QR Code" className="w-64 h-64" />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                      Or manually enter this key: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{setup.secret}</code>
                    </p>
                  </div>

                  {/* Step 2 */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Step 2: Enter Verification Code
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Enter the 6-digit code from your authenticator app to verify the setup
                    </p>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center text-2xl tracking-widest"
                    />
                  </div>

                  {/* Backup Codes */}
                  {showBackupCodes && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Step 3: Save Backup Codes
                      </h3>
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          <strong>Important:</strong> Save these backup codes in a secure location. You can use them to access your account if you lose your authenticator device.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                        {setup.backupCodes.map((code, index) => (
                          <code key={index} className="text-sm font-mono text-gray-900 dark:text-white">
                            {code}
                          </code>
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(setup.backupCodes.join('\n'));
                          toast.success('Backup codes copied to clipboard');
                        }}
                        className="mt-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        Copy to Clipboard
                      </button>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => {
                        setShowSetup(false);
                        setVerificationCode('');
                        setShowBackupCodes(false);
                      }}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleVerifyAndEnable}
                      disabled={verificationCode.length !== 6}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Verify and Enable
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active Sessions Tab */}
      {activeTab === 'sessions' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Active Sessions
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Manage your active sessions and revoke access from devices
            </p>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {sessions.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                No active sessions
              </div>
            ) : (
              sessions.map((session) => (
                <div key={session.id} className="p-6 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {session.device_info?.browser || 'Unknown Browser'}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">·</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {session.device_info?.os || 'Unknown OS'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <div>IP: {session.ip_address}</div>
                      {session.location && <div>Location: {session.location}</div>}
                      <div>Last active: {formatDate(session.last_activity)}</div>
                      <div>Created: {formatDate(session.created_at)}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevokeSession(session.id)}
                    className="px-3 py-1 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    Revoke
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Audit Log Tab */}
      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Security Audit Log
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              View recent security-related activities on your account
            </p>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {auditLogs.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                No audit logs
              </div>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {log.action.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        {log.resource_type && (
                          <>
                            <span className="text-sm text-gray-500">·</span>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {log.resource_type}
                            </span>
                          </>
                        )}
                      </div>
                      {log.details?.message && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                          {log.details.message}
                        </p>
                      )}
                      <div className="text-xs text-gray-500 dark:text-gray-500">
                        {formatDate(log.created_at)}
                        {log.ip_address && ` · IP: ${log.ip_address}`}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
