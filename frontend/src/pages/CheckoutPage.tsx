// src/pages/CheckoutPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CreditCardIcon, ShoppingCartIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useCartStore } from '../lib/cartStore';
import { apiClient } from '../lib/apiClient';
import toast from 'react-hot-toast';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cartStore = useCartStore();
  const [loading, setLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zip: '',
    country: 'United States',
    password: '',
    domainValue: '',
    couponCode: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [couponApplied, setCouponApplied] = useState(false);

  // Load cart from URL params on mount
  useEffect(() => {
    cartStore.loadFromQuery(searchParams);
  }, [searchParams]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    if (!formData.addressLine1.trim()) newErrors.addressLine1 = 'Address is required';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.state.trim()) newErrors.state = 'State/Province is required';
    if (!formData.zip.trim()) newErrors.zip = 'Postal code is required';
    if (!formData.password.trim()) newErrors.password = 'Password is required';
    else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (!cartStore.plan) newErrors.plan = 'No plan selected';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleApplyCoupon = async () => {
    if (!formData.couponCode.trim()) {
      toast.error('Please enter a coupon code');
      return;
    }

    try {
      const isValid = await cartStore.applyCoupon(formData.couponCode);
      if (isValid) {
        setCouponApplied(true);
        toast.success('Coupon applied successfully!');
      } else {
        toast.error('Invalid or expired coupon code');
      }
    } catch (error) {
      toast.error('Failed to validate coupon');
    }
  };

  const handleCheckout = async () => {
    if (!validateForm()) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!cartStore.plan) {
      toast.error('No plan selected');
      navigate('/hosting');
      return;
    }

    try {
      setLoading(true);

      const payload = {
        planId: cartStore.plan.id,
        billingCycle: cartStore.billingCycle,
        trialActive: cartStore.trialActive,
        addonIds: cartStore.selectedAddonIds,
        couponCode: cartStore.coupon?.code || null,
        customer: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          company: formData.company || undefined,
          address: {
            line1: formData.addressLine1,
            city: formData.city,
            state: formData.state,
            zip: formData.zip,
            country: formData.country,
          },
        },
        domain: {
          mode: formData.domainValue ? 'register' : 'subdomain',
          value: formData.domainValue || `${formData.firstName.toLowerCase()}-${Date.now()}.migrahosting.com`,
        },
        account: {
          password: formData.password,
        },
      };

      const response = await apiClient.createCheckout(payload);

      if (response.success && response.data?.checkoutUrl) {
        // Redirect to Stripe or success page
        window.location.href = response.data.checkoutUrl;
      } else {
        toast.error('Failed to create checkout session');
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to initiate checkout');
      setLoading(false);
    }
  };

  // Show empty state if no plan selected
  if (!cartStore.plan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
          <ShoppingCartIcon className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">No Plan Selected</h3>
          <p className="text-slate-600 mb-6">
            Please select a hosting plan before proceeding to checkout
          </p>
          <button
            onClick={() => navigate('/hosting')}
            className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold hover:from-violet-700 hover:to-fuchsia-700 transition-all"
          >
            Browse Hosting Plans
          </button>
        </div>
      </div>
    );
  }

  const { subtotal, discount, total: calculatedTotal } = cartStore.totals;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Complete Your Order</h1>
          <p className="text-slate-300">
            {cart Store.plan.name} • {cartStore.billingCycle === 'yearly' ? 'Yearly' : 'Monthly'} Billing
          </p>
          {cartStore.trialActive && (
            <div className="mt-3 inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-full px-4 py-2">
              <CheckCircleIcon className="w-5 h-5 text-green-400" />
              <span className="text-sm font-medium text-green-400">14-Day Free Trial</span>
            </div>
          )}
        </div>

        {/* Checkout Form */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8">
          {/* Personal Information */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Personal Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  First Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  placeholder="John"
                />
                {errors.firstName && <p className="mt-1 text-sm text-red-400">{errors.firstName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Last Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  placeholder="Doe"
                />
                {errors.lastName && <p className="mt-1 text-sm text-red-400">{errors.lastName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  placeholder="john@example.com"
                />
                {errors.email && <p className="mt-1 text-sm text-red-400">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Phone Number <span className="text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  placeholder="555-123-4567"
                />
                {errors.phone && <p className="mt-1 text-sm text-red-400">{errors.phone}</p>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Company (Optional)
                </label>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  placeholder="Acme Inc"
                />
              </div>
            </div>
          </div>

          {/* Billing Address */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Billing Address</h2>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Address Line 1 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="addressLine1"
                  value={formData.addressLine1}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  placeholder="123 Main St"
                />
                {errors.addressLine1 && <p className="mt-1 text-sm text-red-400">{errors.addressLine1}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Address Line 2 (Optional)
                </label>
                <input
                  type="text"
                  name="addressLine2"
                  value={formData.addressLine2}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  placeholder="Apt 4B"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    City <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    placeholder="New York"
                  />
                  {errors.city && <p className="mt-1 text-sm text-red-400">{errors.city}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    State/Province <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    placeholder="NY"
                  />
                  {errors.state && <p className="mt-1 text-sm text-red-400">{errors.state}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Postal/ZIP Code <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="zip"
                    value={formData.zip}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    placeholder="10001"
                  />
                  {errors.zip && <p className="mt-1 text-sm text-red-400">{errors.zip}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Country <span className="text-red-400">*</span>
                  </label>
                  <select
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  >
                    <option value="United States">United States</option>
                    <option value="Canada">Canada</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="Australia">Australia</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Panel Password */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Panel Password</h2>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password <span className="text-red-400">*</span>
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                placeholder="••••••••"
              />
              <p className="mt-1 text-xs text-slate-400">
                For accessing your hosting control panel (minimum 8 characters)
              </p>
              {errors.password && <p className="mt-1 text-sm text-red-400">{errors.password}</p>}
            </div>
          </div>

          {/* Domain Name */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Domain Name (Optional)</h2>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Domain
              </label>
              <input
                type="text"
                name="domainValue"
                value={formData.domainValue}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                placeholder="example.com (can be added later)"
              />
              <p className="mt-1 text-xs text-slate-400">
                You can add or transfer a domain later from your control panel
              </p>
            </div>
          </div>

          {/* Promo Code */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Promo Code (Optional)</h2>
            <div className="flex gap-3">
              <input
                type="text"
                name="couponCode"
                value={formData.couponCode}
                onChange={handleInputChange}
                placeholder="ENTER PROMO CODE"
                className="flex-1 px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent uppercase"
              />
              <button
                type="button"
                onClick={handleApplyCoupon}
                disabled={!formData.couponCode.trim() || couponApplied}
                className="px-6 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white font-medium hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Apply
              </button>
            </div>
            {couponApplied && cartStore.coupon && (
              <div className="mt-2 flex items-center gap-2 text-green-400 text-sm">
                <CheckCircleIcon className="w-4 h-4" />
                <span>Coupon "{cartStore.coupon.code}" applied!</span>
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="bg-slate-700/30 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">Order Summary</h3>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-slate-300">
                <span>{cartStore.plan.name}</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-400">
                  <span>Discount ({cartStore.coupon?.code})</span>
                  <span>-${discount.toFixed(2)}</span>
                </div>
              )}
              {cartStore.trialActive && (
                <div className="flex justify-between text-yellow-400">
                  <span>Trial Credit</span>
                  <span>-${subtotal.toFixed(2)}</span>
                </div>
              )}
            </div>
            <div className="pt-4 border-t border-slate-600 flex justify-between items-center">
              <span className="text-lg font-semibold text-white">Total</span>
              <span className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                ${calculatedTotal.toFixed(2)}
              </span>
            </div>
            {cartStore.trialActive && (
              <p className="mt-3 text-xs text-slate-400 text-center">
                $0 due today. After your 14-day trial, you'll be charged ${subtotal.toFixed(2)}/{cartStore.billingCycle === 'yearly' ? 'year' : 'month'}
              </p>
            )}
          </div>

          {/* Missing Fields Warning */}
          {Object.keys(errors).length > 0 && (
            <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-sm text-yellow-400">Missing required fields</p>
            </div>
          )}

          {/* Complete Order Button */}
          <button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold text-lg hover:from-violet-700 hover:to-fuchsia-700 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Processing...
              </>
            ) : (
              <>
                <CreditCardIcon className="w-6 h-6" />
                Complete Order (${calculatedTotal.toFixed(2)})
              </>
            )}
          </button>

          <p className="mt-4 text-xs text-slate-400 text-center">
            Secure payment powered by Stripe • Your data is encrypted and protected
          </p>
        </div>
      </div>
    </div>
  );
}
