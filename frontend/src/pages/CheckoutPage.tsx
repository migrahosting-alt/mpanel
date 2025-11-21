// src/pages/CheckoutPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCardIcon, ShoppingCartIcon } from '@heroicons/react/24/outline';
import { useCartStore } from '../stores/cartStore';
import { apiClient } from '../lib/apiClient';
import toast from 'react-hot-toast';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, getTotal, clearCart } = useCartStore();
  const [loading, setLoading] = useState(false);
  const total = getTotal();

  const handleCheckout = async () => {
    if (items.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    try {
      setLoading(true);

      const response = await apiClient.post<{ sessionId: string; url: string }>('/checkout/create-session', {
        items: items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          configuration: item.configuration,
          name: item.name,
        })),
        successUrl: `${window.location.origin}/checkout/success`,
        cancelUrl: `${window.location.origin}/cart`,
      });

      // Redirect to Stripe Checkout
      if (response.url) {
        window.location.href = response.url;
      } else {
        toast.error('Failed to create checkout session');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.response?.data?.error || 'Failed to initiate checkout');
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">Checkout</h1>
        <div className="border-2 border-dashed rounded-xl p-12 text-center">
          <ShoppingCartIcon className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">Your cart is empty</h3>
          <p className="text-slate-500 mb-4">
            Add some products before proceeding to checkout
          </p>
          <button
            onClick={() => navigate('/products')}
            className="px-4 py-2 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700"
          >
            Browse Products
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6 flex items-center gap-2">
        <CreditCardIcon className="w-7 h-7 text-violet-600" />
        Checkout
      </h1>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Order Review */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Order Review</h2>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.productId} className="flex justify-between items-start py-3 border-b border-slate-100 last:border-0">
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{item.name}</p>
                    <p className="text-sm text-slate-600">
                      {item.category} • {item.billing_cycle}
                    </p>
                    {item.configuration?.domain && (
                      <p className="text-xs text-slate-500 mt-1">
                        Domain: <span className="font-mono">{item.configuration.domain}</span>
                      </p>
                    )}
                    {item.configuration?.email_address && (
                      <p className="text-xs text-slate-500 mt-1">
                        Email: <span className="font-mono">{item.configuration.email_address}</span>
                      </p>
                    )}
                    <p className="text-sm text-slate-600 mt-1">Quantity: {item.quantity}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-semibold text-slate-900">
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <CreditCardIcon className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">Secure Payment</h3>
                <p className="text-sm text-blue-700">
                  You'll be redirected to Stripe's secure checkout page to complete your payment.
                  Your payment information is never stored on our servers.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sticky top-6">
            <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
            
            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-medium text-slate-900">${total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Tax (estimated)</span>
                <span className="font-medium text-slate-900">${(total * 0.1).toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-slate-200">
                <span className="font-semibold text-slate-900">Total</span>
                <span className="text-xl font-bold text-violet-600">
                  ${(total * 1.1).toFixed(2)}
                </span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed mb-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Processing...
                </>
              ) : (
                <>
                  <CreditCardIcon className="w-5 h-5" />
                  Pay with Stripe
                </>
              )}
            </button>
            
            <button
              onClick={() => navigate('/cart')}
              disabled={loading}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              Back to Cart
            </button>

            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-xs text-slate-500 text-center">
                Powered by Stripe • Secure SSL Encryption
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
