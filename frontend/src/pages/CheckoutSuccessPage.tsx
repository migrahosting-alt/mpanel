/**
 * Checkout Success Page
 * Displays order confirmation after successful Stripe payment
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../lib/apiClient';
import { formatPrice } from '../lib/priceCalculator';

export default function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!sessionId) {
      setError('No session ID provided');
      setLoading(false);
      return;
    }

    fetchSessionStatus();
  }, [sessionId]);

  const fetchSessionStatus = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getSessionStatus(sessionId!);

      if (response.success && response.data) {
        setSession(response.data);
        
        // If provisioning is still pending, poll
        if (response.data.status === 'pending') {
          setPolling(true);
          setTimeout(fetchSessionStatus, 3000); // Poll every 3 seconds
        } else {
          setPolling(false);
        }
      } else {
        setError(response.error || 'Failed to load session status');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify payment');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900">Verifying your payment...</h2>
          <p className="text-gray-600 mt-2">Please wait while we confirm your order</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Verification Failed</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/pricing')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
          >
            Return to Pricing
          </button>
        </div>
      </div>
    );
  }

  if (polling) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <div className="animate-pulse w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Setting up your account...</h1>
          <p className="text-gray-600 mb-4">
            We're provisioning your hosting environment. This usually takes 30-60 seconds.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span>Please don't close this page</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
          <p className="text-xl text-gray-600">Thank you for choosing MigraHosting</p>
        </div>

        {/* Order Details */}
        {session && (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
              <h2 className="text-white text-lg font-semibold">Order Confirmation</h2>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Subscription Details */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Plan Details</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="font-semibold text-lg">{session.subscription.plan}</p>
                  <p className="text-sm text-gray-600">Status: {session.subscription.status}</p>
                  <p className="text-sm text-gray-600">
                    Next billing date: {new Date(session.subscription.nextBillingDate).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Customer Info */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Account Information</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm">Email: {session.customer.email}</p>
                  <p className="text-sm">Customer ID: {session.customer.id}</p>
                </div>
              </div>

              {/* Portal Access */}
              {session.portal && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-blue-900 mb-3">
                    🎉 Your Control Panel is Ready!
                  </h3>
                  <div className="space-y-2 text-sm mb-4">
                    <p className="text-blue-800">
                      <strong>Portal URL:</strong>{' '}
                      <a href={session.portal.url} className="underline hover:no-underline" target="_blank" rel="noopener noreferrer">
                        {session.portal.url}
                      </a>
                    </p>
                    <p className="text-blue-800">
                      <strong>Username:</strong> {session.portal.username}
                    </p>
                    <p className="text-blue-800 italic">
                      Check your email for login credentials
                    </p>
                  </div>
                  <a
                    href={session.portal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                  >
                    Go to Control Panel →
                  </a>
                </div>
              )}

              {/* What's Next */}
              <div>
                <h3 className="text-lg font-semibold mb-3">What's Next?</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                      1
                    </div>
                    <div>
                      <p className="font-medium">Check your email</p>
                      <p className="text-sm text-gray-600">
                        We've sent you a welcome email with your login credentials and setup instructions
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                      2
                    </div>
                    <div>
                      <p className="font-medium">Access your control panel</p>
                      <p className="text-sm text-gray-600">
                        Log in to manage your hosting, domains, and settings
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                      3
                    </div>
                    <div>
                      <p className="font-medium">Deploy your website</p>
                      <p className="text-sm text-gray-600">
                        Upload your files via FTP, SSH, or our file manager
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Support */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-3">Need Help?</h3>
                <p className="text-gray-600 mb-4">
                  Our support team is available 24/7 to help you get started.
                </p>
                <div className="flex flex-wrap gap-3">
                  <a
                    href="https://migrahosting.com/docs"
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Documentation
                  </a>
                  <a
                    href="mailto:support@migrahosting.com"
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Email Support
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
