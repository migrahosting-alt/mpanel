// src/pages/OrderSuccessPage.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircleIcon, ShoppingCartIcon } from '@heroicons/react/24/outline';
import { useCartStore } from '../stores/cartStore';
import { apiClient } from '../lib/apiClient';
import toast from 'react-hot-toast';

export default function OrderSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clearCart } = useCartStore();
  const [loading, setLoading] = useState(true);
  const [orderProcessed, setOrderProcessed] = useState(false);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!sessionId) {
      navigate('/products');
      return;
    }

    processOrder();
  }, [sessionId]);

  const processOrder = async () => {
    try {
      setLoading(true);
      
      // Process the order on the backend
      await apiClient.post('/checkout/success', {
        sessionId: sessionId,
      });

      // Clear cart after successful order
      clearCart();
      setOrderProcessed(true);
      toast.success('Order completed successfully!');
    } catch (error: any) {
      console.error('Order processing error:', error);
      toast.error(error.response?.data?.error || 'Failed to process order');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Processing your order...</p>
        </div>
      </div>
    );
  }

  if (!orderProcessed) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">❌</span>
          </div>
          <h1 className="text-2xl font-semibold mb-2">Order Processing Failed</h1>
          <p className="text-slate-600 mb-6">
            There was an issue processing your order. Please contact support for assistance.
          </p>
          <button
            onClick={() => navigate('/products')}
            className="px-4 py-2 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700"
          >
            Return to Products
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 flex items-center justify-center min-h-screen">
      <div className="text-center max-w-2xl">
        {/* Success Icon */}
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
          <CheckCircleIcon className="w-12 h-12 text-green-600" />
        </div>

        {/* Success Message */}
        <h1 className="text-3xl font-bold text-slate-900 mb-3">
          Order Completed Successfully!
        </h1>
        <p className="text-lg text-slate-600 mb-8">
          Thank you for your purchase. Your services are being provisioned and will be available shortly.
        </p>

        {/* Order Details */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6 text-left">
          <h2 className="text-lg font-semibold mb-4">What's Next?</h2>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="text-green-500 mt-1">✓</span>
              <div>
                <p className="font-medium text-slate-900">Services Provisioned</p>
                <p className="text-sm text-slate-600">
                  Your services will be ready within the next few minutes.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-500 mt-1">✓</span>
              <div>
                <p className="font-medium text-slate-900">Email Confirmation Sent</p>
                <p className="text-sm text-slate-600">
                  Check your inbox for order details and login credentials.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-500 mt-1">✓</span>
              <div>
                <p className="font-medium text-slate-900">Access Your Services</p>
                <p className="text-sm text-slate-600">
                  Visit your dashboard to manage and configure your new services.
                </p>
              </div>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700"
          >
            Go to Dashboard
          </button>
          <button
            onClick={() => navigate('/services')}
            className="px-6 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50"
          >
            View Services
          </button>
          <button
            onClick={() => navigate('/products')}
            className="px-6 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 flex items-center justify-center gap-2"
          >
            <ShoppingCartIcon className="w-5 h-5" />
            Continue Shopping
          </button>
        </div>

        {/* Support Info */}
        <div className="mt-8 pt-8 border-t border-slate-200">
          <p className="text-sm text-slate-500">
            Need help? Contact our support team at{' '}
            <a href="mailto:support@migrahosting.com" className="text-violet-600 hover:underline">
              support@migrahosting.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
