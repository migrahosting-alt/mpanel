// src/pages/CartPage.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCartIcon, TrashIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useCartStore } from '../stores/cartStore';

export default function CartPage() {
  const navigate = useNavigate();
  const { items, removeItem, updateQuantity, clearCart, getTotal } = useCartStore();
  const total = getTotal();

  const handleCheckout = () => {
    if (items.length === 0) return;
    navigate('/checkout');
  };

  if (items.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">Shopping Cart</h1>
        <div className="border-2 border-dashed rounded-xl p-12 text-center">
          <ShoppingCartIcon className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">Your cart is empty</h3>
          <p className="text-slate-500 mb-4">
            Browse our catalog to add products and services
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
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ShoppingCartIcon className="w-7 h-7 text-violet-600" />
            Shopping Cart
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {items.length} {items.length === 1 ? 'item' : 'items'} in cart
          </p>
        </div>
        <button
          onClick={clearCart}
          className="px-4 py-2 rounded-xl border border-red-200 text-red-600 font-medium hover:bg-red-50"
        >
          Clear Cart
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div
              key={item.productId}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 mb-1">{item.name}</h3>
                  <p className="text-sm text-slate-600 mb-2">
                    {item.category} • {item.billing_cycle}
                  </p>
                  
                  {item.configuration?.domain && (
                    <p className="text-xs text-slate-500 mb-2">
                      Domain: <span className="font-mono">{item.configuration.domain}</span>
                    </p>
                  )}
                  {item.configuration?.email_address && (
                    <p className="text-xs text-slate-500 mb-2">
                      Email: <span className="font-mono">{item.configuration.email_address}</span>
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-4">
                    <div className="flex items-center border rounded-lg">
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        className="p-2 hover:bg-slate-50 rounded-l-lg"
                        disabled={item.quantity <= 1}
                      >
                        <MinusIcon className="w-4 h-4" />
                      </button>
                      <span className="px-4 py-2 text-sm font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        className="p-2 hover:bg-slate-50 rounded-r-lg"
                      >
                        <PlusIcon className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeItem(item.productId)}
                      className="p-2 rounded-lg border border-red-200 hover:bg-red-50 text-red-600"
                      title="Remove from cart"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="text-right ml-6">
                  <p className="text-lg font-bold text-slate-900">
                    ${(item.price * item.quantity).toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-500">
                    ${item.price.toFixed(2)} each
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sticky top-6">
            <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
            
            <div className="space-y-3 mb-4">
              {items.map((item) => (
                <div key={item.productId} className="flex justify-between text-sm">
                  <span className="text-slate-600">
                    {item.name} × {item.quantity}
                  </span>
                  <span className="font-medium text-slate-900">
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 pt-4 mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-slate-600">Subtotal</span>
                <span className="text-sm font-medium text-slate-900">
                  ${total.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-slate-600">Tax (estimated)</span>
                <span className="text-sm font-medium text-slate-900">
                  ${(total * 0.1).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between pt-4 border-t border-slate-200">
                <span className="font-semibold text-slate-900">Total</span>
                <span className="text-xl font-bold text-violet-600">
                  ${(total * 1.1).toFixed(2)}
                </span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              className="w-full px-4 py-3 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700 mb-2"
            >
              Proceed to Checkout
            </button>
            
            <button
              onClick={() => navigate('/products')}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
