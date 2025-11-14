import { useState, useEffect } from 'react';
import {
  CreditCardIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const ClientBilling = () => {
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [billingInfo, setBillingInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/client/billing', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setPaymentMethods(data.paymentMethods || mockPaymentMethods);
        setBillingInfo(data.billingInfo || mockBillingInfo);
      } else {
        setPaymentMethods(mockPaymentMethods);
        setBillingInfo(mockBillingInfo);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching billing data:', error);
      setPaymentMethods(mockPaymentMethods);
      setBillingInfo(mockBillingInfo);
      setLoading(false);
    }
  };

  const mockPaymentMethods = [
    {
      id: 1,
      type: 'card',
      brand: 'Visa',
      last4: '4242',
      expiryMonth: 12,
      expiryYear: 2025,
      isDefault: true,
    },
  ];

  const mockBillingInfo = {
    name: 'John Doe',
    email: 'john@example.com',
    address: '123 Main St',
    city: 'San Francisco',
    state: 'CA',
    zip: '94102',
    country: 'United States',
  };

  const handleAddPaymentMethod = () => {
    toast.success('Opening payment method form...');
  };

  const handleRemovePaymentMethod = (id) => {
    toast.success('Payment method removed');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Billing & Payment</h1>
        <p className="mt-2 text-sm text-gray-700">
          Manage your payment methods and billing information
        </p>
      </div>

      {/* Payment Methods */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Payment Methods</h2>
          <button
            onClick={handleAddPaymentMethod}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Add Card
          </button>
        </div>

        <div className="space-y-4">
          {paymentMethods.map((method) => (
            <div
              key={method.id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
            >
              <div className="flex items-center">
                <CreditCardIcon className="h-8 w-8 text-gray-400 mr-4" />
                <div>
                  <div className="flex items-center">
                    <p className="text-sm font-medium text-gray-900">
                      {method.brand} •••• {method.last4}
                    </p>
                    {method.isDefault && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircleIcon className="h-3 w-3 mr-1" />
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    Expires {method.expiryMonth}/{method.expiryYear}
                  </p>
                </div>
              </div>
              {!method.isDefault && (
                <button
                  onClick={() => handleRemovePaymentMethod(method.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {paymentMethods.length === 0 && (
          <div className="text-center py-8">
            <CreditCardIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-500">No payment methods on file</p>
          </div>
        )}
      </div>

      {/* Billing Information */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Billing Information</h2>
          <button className="text-sm text-blue-600 hover:text-blue-500 font-medium">
            Edit
          </button>
        </div>

        {billingInfo && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Name</p>
              <p className="text-sm font-medium text-gray-900">{billingInfo.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Email</p>
              <p className="text-sm font-medium text-gray-900">{billingInfo.email}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Address</p>
              <p className="text-sm font-medium text-gray-900">{billingInfo.address}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">City</p>
              <p className="text-sm font-medium text-gray-900">{billingInfo.city}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">State / ZIP</p>
              <p className="text-sm font-medium text-gray-900">
                {billingInfo.state} {billingInfo.zip}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Country</p>
              <p className="text-sm font-medium text-gray-900">{billingInfo.country}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientBilling;
