// Updated checkout.tsx with full billing information
// Replace the existing checkout.tsx in marketing site with this version

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import toast from 'react-hot-toast';

// Plan slug mapping (marketing → mPanel)
const PLAN_SLUG_MAP: Record<string, string> = {
  student: 'shared_student',
  starter: 'shared_starter',
  premium: 'shared_premium',
  business: 'shared_business',
};

// Billing cycle mapping
const BILLING_CYCLE_MAP: Record<string, string> = {
  monthly: 'monthly',
  annually: 'yearly',
  biennially: 'biennial',
  triennially: 'triennial',
};

interface CheckoutFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  company: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  phone: string;
  domain: string;
  domainMode: 'new' | 'existing' | 'later';
}

export default function CheckoutPage() {
  const { cart, clearCart } = useCart();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'review' | 'details'>('review');
  
  const [formData, setFormData] = useState<CheckoutFormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    company: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postcode: '',
    country: 'US',
    phone: '',
    domain: '',
    domainMode: 'later',
  });

  const apiKey = import.meta.env.VITE_MPANEL_API_KEY;

  if (!apiKey) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Configuration Error</h2>
          <p className="text-gray-600">API key not configured. Please contact support.</p>
        </div>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Your cart is empty</h2>
          <button
            onClick={() => navigate('/pricing')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Browse Plans
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!formData.address1 || !formData.city || !formData.state || !formData.postcode || !formData.country) {
      toast.error('Please complete your billing address');
      return;
    }

    if (!formData.phone) {
      toast.error('Phone number is required');
      return;
    }

    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const mainItem = cart.items.find(item => item.type === 'plan');
      if (!mainItem) {
        toast.error('No hosting plan selected');
        return;
      }

      const planSlug = PLAN_SLUG_MAP[mainItem.planId] || mainItem.planId;
      const billingCycle = BILLING_CYCLE_MAP[mainItem.term] || mainItem.term;

      const payload = {
        planSlug,
        billingCycle,
        customer: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          company: formData.company || null,
          address1: formData.address1,
          address2: formData.address2 || null,
          city: formData.city,
          state: formData.state,
          postcode: formData.postcode,
          country: formData.country,
          phone: formData.phone,
        },
        account: {
          email: formData.email,
          password: formData.password,
        },
        domain: formData.domainMode === 'later' ? null : formData.domain,
        testMode: true, // Test mode - no payment required
        promoCode: 'OVERRIDE100', // Override discount for testing
        autoProvision: true,
      };

      const response = await fetch('https://migrapanel.com/api/marketing/checkout-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Checkout failed');
      }

      // Clear cart
      clearCart();

      // Redirect based on response
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (data.paymentRequired === false) {
        // Test mode success
        toast.success('Account created successfully!');
        navigate('/thank-you');
      } else {
        toast.error('Unexpected response from server');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to process checkout');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    return cart.items.reduce((sum, item) => sum + item.price, 0);
  };

  if (step === 'review') {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/cart')}
            className="text-blue-600 hover:text-blue-700 mb-6 flex items-center gap-2"
          >
            ← Back to Cart
          </button>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold mb-8">Order Summary</h1>

            <div className="space-y-4 mb-8">
              {cart.items.map((item, index) => (
                <div key={index} className="flex justify-between items-center border-b pb-4">
                  <div>
                    <h3 className="font-semibold">{item.name}</h3>
                    <p className="text-sm text-gray-600">{item.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">${item.price.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">/{item.term}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 mb-8">
              <div className="flex justify-between items-center text-xl font-bold">
                <span>Total Due Today</span>
                <span>${calculateTotal().toFixed(2)}</span>
              </div>
              <p className="text-sm text-green-600 mt-2">Test mode active - no payment required</p>
            </div>

            <button
              onClick={() => setStep('details')}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition"
            >
              Continue to Account Details
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => setStep('review')}
          className="text-blue-600 hover:text-blue-700 mb-6 flex items-center gap-2"
        >
          ← Back to cart
        </button>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold mb-8">Account & Billing Details</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Personal Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">Company (Optional)</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Billing Address */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Billing Address</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Address Line 1 *</label>
                  <input
                    type="text"
                    required
                    value={formData.address1}
                    onChange={(e) => setFormData({ ...formData, address1: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Address Line 2 (Optional)</label>
                  <input
                    type="text"
                    value={formData.address2}
                    onChange={(e) => setFormData({ ...formData, address2: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">City *</label>
                    <input
                      type="text"
                      required
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">State/Province *</label>
                    <input
                      type="text"
                      required
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Postal/ZIP Code *</label>
                    <input
                      type="text"
                      required
                      value={formData.postcode}
                      onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Country *</label>
                    <select
                      required
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="US">United States</option>
                      <option value="CA">Canada</option>
                      <option value="GB">United Kingdom</option>
                      <option value="AU">Australia</option>
                      <option value="DE">Germany</option>
                      <option value="FR">France</option>
                      <option value="NL">Netherlands</option>
                      <option value="HT">Haiti</option>
                      {/* Add more countries as needed */}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Security */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Panel Password</h2>
              <div>
                <label className="block text-sm font-medium mb-2">Password *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">For accessing your hosting control panel</p>
              </div>
            </div>

            {/* Domain Configuration */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Domain Name (Optional)</h2>
              <div>
                <input
                  type="text"
                  placeholder="example.com (can be added later)"
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">You can add or transfer a domain later from your control panel</p>
              </div>
            </div>

            <div className="border-t pt-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xl font-bold">Total Due Today</span>
                <span className="text-2xl font-bold text-green-600">$0.00</span>
              </div>
              <p className="text-sm text-green-600 mb-6">Test mode active - no payment required</p>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-pink-600 text-white py-4 rounded-lg font-semibold hover:from-blue-700 hover:to-pink-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating Account...' : 'Complete Order ($0.00)'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
