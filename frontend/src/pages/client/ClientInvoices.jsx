import { useState, useEffect } from 'react';
import {
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const ClientInvoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:2271/api/client/invoices', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setInvoices(data.invoices || mockInvoices);
      } else {
        setInvoices(mockInvoices);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      setInvoices(mockInvoices);
      setLoading(false);
    }
  };

  const mockInvoices = [
    {
      id: 'INV-2025-001',
      date: '2025-11-01',
      dueDate: '2025-11-15',
      amount: 19.99,
      status: 'paid',
      description: 'Shared Hosting - Business',
    },
    {
      id: 'INV-2025-002',
      date: '2025-11-12',
      dueDate: '2025-11-26',
      amount: 49.99,
      status: 'unpaid',
      description: 'VPS Server - Premium',
    },
    {
      id: 'INV-2025-003',
      date: '2025-10-01',
      dueDate: '2025-10-15',
      amount: 19.99,
      status: 'paid',
      description: 'Shared Hosting - Business',
    },
  ];

  const filteredInvoices = invoices.filter(
    (invoice) => filter === 'all' || invoice.status === filter
  );

  const getStatusBadge = (status) => {
    const badges = {
      paid: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircleIcon },
      unpaid: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: ClockIcon },
      overdue: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircleIcon },
    };

    const badge = badges[status] || badges.unpaid;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        <Icon className="mr-1 h-4 w-4" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const handlePayInvoice = (invoiceId) => {
    toast.success(`Redirecting to payment for ${invoiceId}`);
    // Implement payment logic here
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
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <p className="mt-2 text-sm text-gray-700">
          View and manage your billing invoices
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <nav className="flex space-x-4" aria-label="Tabs">
          {['all', 'paid', 'unpaid', 'overdue'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-2 font-medium text-sm rounded-md ${
                filter === tab
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Invoices Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Invoice
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Due Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredInvoices.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-2" />
                    <span className="text-sm font-medium text-gray-900">{invoice.id}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">{invoice.description}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">
                    {new Date(invoice.date).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">
                    {new Date(invoice.dueDate).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    ${invoice.amount.toFixed(2)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(invoice.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end space-x-2">
                    <button className="text-gray-600 hover:text-gray-900">
                      <ArrowDownTrayIcon className="h-5 w-5" />
                    </button>
                    {invoice.status === 'unpaid' && (
                      <button
                        onClick={() => handlePayInvoice(invoice.id)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Pay Now
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredInvoices.length === 0 && (
          <div className="text-center py-12">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No invoices found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {filter === 'all'
                ? "You don't have any invoices yet."
                : `You don't have any ${filter} invoices.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientInvoices;
