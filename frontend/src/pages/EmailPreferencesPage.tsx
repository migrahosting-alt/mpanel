// src/pages/EmailPreferencesPage.tsx
import React, { useState, useEffect } from 'react';
import { 
  EnvelopeIcon, 
  BellAlertIcon, 
  ShieldCheckIcon, 
  MegaphoneIcon,
  CheckCircleIcon 
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import apiClient from '../lib/apiClient';

type EmailPreferences = {
  user_id: number;
  invoice_emails: boolean;
  payment_emails: boolean;
  service_emails: boolean;
  marketing_emails: boolean;
  security_emails: boolean;
  created_at: string;
  updated_at: string;
};

function EmailPreferencesPage() {
  const [preferences, setPreferences] = useState<EmailPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/email-preferences');
      setPreferences(response.data.preferences);
    } catch (error) {
      console.error('Failed to fetch email preferences:', error);
      toast.error('Failed to load email preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key: keyof EmailPreferences) => {
    if (!preferences) return;
    
    setPreferences({
      ...preferences,
      [key]: !preferences[key],
    });
  };

  const handleSave = async () => {
    if (!preferences) return;

    try {
      setSaving(true);
      await apiClient.put('/email-preferences', {
        invoice_emails: preferences.invoice_emails,
        payment_emails: preferences.payment_emails,
        service_emails: preferences.service_emails,
        marketing_emails: preferences.marketing_emails,
        security_emails: preferences.security_emails,
      });
      
      toast.success('Email preferences saved successfully');
    } catch (error) {
      console.error('Failed to save email preferences:', error);
      toast.error('Failed to save email preferences');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm text-slate-500">Loading email preferences…</div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="p-6">
        <div className="text-sm text-red-600">Failed to load email preferences</div>
      </div>
    );
  }

  const preferenceItems = [
    {
      key: 'invoice_emails' as const,
      icon: EnvelopeIcon,
      title: 'Invoice Emails',
      description: 'Receive emails when new invoices are generated',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      recommended: true,
    },
    {
      key: 'payment_emails' as const,
      icon: CheckCircleIcon,
      title: 'Payment Receipts',
      description: 'Get confirmation emails for successful payments and order confirmations',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      recommended: true,
    },
    {
      key: 'service_emails' as const,
      icon: BellAlertIcon,
      title: 'Service Notifications',
      description: 'Updates about service provisioning, renewals, and important changes',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      recommended: true,
    },
    {
      key: 'security_emails' as const,
      icon: ShieldCheckIcon,
      title: 'Security Alerts',
      description: 'Critical security notifications, password resets, and login alerts',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      required: true,
    },
    {
      key: 'marketing_emails' as const,
      icon: MegaphoneIcon,
      title: 'Marketing & Updates',
      description: 'Product updates, special offers, and newsletters',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      recommended: false,
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Email Preferences</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage which email notifications you want to receive
        </p>
      </div>

      <div className="space-y-4 max-w-3xl">
        {preferenceItems.map((item) => {
          const Icon = item.icon;
          const isEnabled = preferences[item.key];

          return (
            <div
              key={item.key}
              className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4 flex-1">
                  <div className={`p-3 rounded-xl ${item.bgColor}`}>
                    <Icon className={`w-6 h-6 ${item.color}`} />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-base font-semibold">{item.title}</h3>
                      {item.required && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                          Required
                        </span>
                      )}
                      {item.recommended && !item.required && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mt-1">
                      {item.description}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => !item.required && handleToggle(item.key)}
                  disabled={item.required}
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                    ${isEnabled ? 'bg-violet-600' : 'bg-slate-300'}
                    ${item.required ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                  aria-label={`Toggle ${item.title}`}
                >
                  <span
                    className={`
                      inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                      ${isEnabled ? 'translate-x-6' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 max-w-3xl">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-sm text-slate-600">
            <strong className="text-slate-800">Note:</strong> Security alerts are required and cannot be disabled. 
            These emails contain critical information about your account security, including password resets and login notifications.
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center space-x-3 max-w-3xl">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>
        <button
          onClick={fetchPreferences}
          disabled={saving}
          className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          Reset
        </button>
      </div>

      <div className="mt-8 max-w-3xl">
        <div className="border-t border-slate-200 pt-6">
          <h3 className="text-sm font-semibold text-slate-800 mb-2">
            Email Templates
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            Here are the types of emails you might receive based on your preferences:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <div className="font-medium text-slate-800">📧 Welcome Email</div>
              <div className="text-xs text-slate-500 mt-1">Sent when your account is created</div>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <div className="font-medium text-slate-800">🔐 Password Reset</div>
              <div className="text-xs text-slate-500 mt-1">Secure link to reset your password</div>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <div className="font-medium text-slate-800">📄 Invoice Notification</div>
              <div className="text-xs text-slate-500 mt-1">New invoice with PDF attachment</div>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <div className="font-medium text-slate-800">✅ Payment Receipt</div>
              <div className="text-xs text-slate-500 mt-1">Confirmation of successful payment</div>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <div className="font-medium text-slate-800">🛒 Order Confirmation</div>
              <div className="text-xs text-slate-500 mt-1">Details of your purchase and services</div>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <div className="font-medium text-slate-800">🚀 Service Ready</div>
              <div className="text-xs text-slate-500 mt-1">Notification when service is provisioned</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmailPreferencesPage;
