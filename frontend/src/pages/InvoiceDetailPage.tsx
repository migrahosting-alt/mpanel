// frontend/src/pages/InvoiceDetailPage.tsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { apiClient } from '../lib/apiClient';
import toast from 'react-hot-toast';
import { 
  DocumentArrowDownIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  CreditCardIcon
} from '@heroicons/react/24/outline';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_dummy');

type Invoice = {
  id: number;
  invoice_number: string;
  user_id: string;
  customer_email: string;
  total: number;
  amount_paid: number;
  status: 'draft' | 'unpaid' | 'paid' | 'overdue' | 'cancelled';
  due_date: string;
  created_at: string;
  paid_at: string | null;
  line_items: Array<{
    description: string;
    quantity: number;
    price: number;
    amount: number;
  }>;
};

function PaymentForm({ invoice, onSuccess }: { invoice: Invoice; onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/invoices/${invoice.id}?success=true`,
        },
        redirect: 'if_required',
      });

      if (error) {
        toast.error(error.message || 'Payment failed');
      } else {
        toast.success('Payment successful!');
        onSuccess();
      }
    } catch (err) {
      console.error('Payment error:', err);
      toast.error('Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed font-medium"
      >
        {processing ? 'Processing...' : `Pay $${(invoice.total - invoice.amount_paid).toFixed(2)}`}
      </button>
    </form>
  );
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  useEffect(() => {
    fetchInvoice();
    
    // Check for successful payment redirect
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      toast.success('Payment successful!');
      // Remove success param from URL
      window.history.replaceState({}, '', `/invoices/${id}`);
    }
  }, [id]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<Invoice>(`/invoices/${id}`);
      setInvoice(data);
    } catch (error) {
      console.error('Failed to fetch invoice:', error);
      toast.error('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    if (!invoice) return;

    try {
      const blob = await apiClient.get<Blob>(`/invoices/${id}/pdf`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice-${invoice.invoice_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success('Invoice downloaded');
    } catch (error) {
      console.error('Failed to download PDF:', error);
      toast.error('Failed to download PDF');
    }
  };

  const initiatePayment = async () => {
    try {
      const response = await apiClient.post<{ clientSecret: string; amount: number }>(`/invoices/${id}/payment-intent`, {});
      setClientSecret(response.clientSecret);
      setShowPaymentForm(true);
    } catch (error) {
      console.error('Failed to create payment intent:', error);
      toast.error('Failed to initialize payment');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-700';
      case 'unpaid':
        return 'bg-yellow-100 text-yellow-700';
      case 'overdue':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-blue-100 text-blue-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircleIcon className="w-5 h-5" />;
      case 'overdue':
        return <ExclamationCircleIcon className="w-5 h-5" />;
      default:
        return <ClockIcon className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-violet-600"></div>
          <p className="mt-4 text-sm text-slate-500">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg text-slate-900 font-semibold">Invoice not found</p>
          <p className="text-sm text-slate-500 mt-2">The invoice you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  const amountDue = invoice.total - invoice.amount_paid;

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Invoice Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Invoice</h1>
              <p className="text-slate-500 mt-1">{invoice.invoice_number}</p>
            </div>
            <div className="text-right">
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(invoice.status)}`}>
                {getStatusIcon(invoice.status)}
                {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
              </span>
            </div>
          </div>

          {/* Invoice Details Grid */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-3">Invoice Details</h3>
              <dl className="space-y-2">
                <div>
                  <dt className="text-sm text-slate-500">Invoice Date</dt>
                  <dd className="text-sm font-medium text-slate-900">
                    {new Date(invoice.created_at).toLocaleDateString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Due Date</dt>
                  <dd className="text-sm font-medium text-slate-900">
                    {new Date(invoice.due_date).toLocaleDateString()}
                  </dd>
                </div>
                {invoice.paid_at && (
                  <div>
                    <dt className="text-sm text-slate-500">Paid Date</dt>
                    <dd className="text-sm font-medium text-green-600">
                      {new Date(invoice.paid_at).toLocaleDateString()}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div>
              <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-3">Bill To</h3>
              <p className="text-sm font-medium text-slate-900">{invoice.customer_email}</p>
            </div>
          </div>

          {/* Line Items Table */}
          {invoice.line_items && invoice.line_items.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-3">Items</h3>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Description</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Qty</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Price</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {invoice.line_items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3 text-sm text-slate-900">{item.description}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 text-right">{item.quantity}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 text-right">${item.price.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900 text-right">
                          ${item.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="border-t border-slate-200 pt-6">
            <dl className="space-y-2 max-w-xs ml-auto">
              <div className="flex justify-between">
                <dt className="text-sm text-slate-500">Subtotal</dt>
                <dd className="text-sm font-medium text-slate-900">${invoice.total.toFixed(2)}</dd>
              </div>
              {invoice.amount_paid > 0 && (
                <div className="flex justify-between">
                  <dt className="text-sm text-green-600">Amount Paid</dt>
                  <dd className="text-sm font-medium text-green-600">-${invoice.amount_paid.toFixed(2)}</dd>
                </div>
              )}
              <div className="flex justify-between pt-4 border-t border-slate-200">
                <dt className="text-base font-semibold text-slate-900">Amount Due</dt>
                <dd className="text-base font-bold text-slate-900">${amountDue.toFixed(2)}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          {invoice.status === 'paid' ? (
            <div className="text-center py-4">
              <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Invoice Paid</h3>
              <p className="text-sm text-slate-500 mb-6">
                This invoice was paid on {invoice.paid_at && new Date(invoice.paid_at).toLocaleDateString()}
              </p>
              <button
                onClick={downloadPDF}
                className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium"
              >
                <DocumentArrowDownIcon className="w-5 h-5" />
                Download Receipt
              </button>
            </div>
          ) : showPaymentForm && clientSecret ? (
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Pay Invoice</h3>
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <PaymentForm invoice={invoice} onSuccess={fetchInvoice} />
              </Elements>
              <button
                onClick={() => setShowPaymentForm(false)}
                className="w-full mt-3 px-6 py-2 text-slate-600 hover:text-slate-900 font-medium"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={initiatePayment}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium"
              >
                <CreditCardIcon className="w-5 h-5" />
                Pay ${amountDue.toFixed(2)} Now
              </button>
              <button
                onClick={downloadPDF}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
              >
                <DocumentArrowDownIcon className="w-5 h-5" />
                Download Invoice
              </button>
            </div>
          )}
        </div>

        {/* Payment Instructions */}
        {invoice.status !== 'paid' && (
          <div className="mt-6 text-center text-sm text-slate-500">
            <p>Questions about this invoice? Contact support@migrahosting.com</p>
          </div>
        )}
      </div>
    </div>
  );
}
