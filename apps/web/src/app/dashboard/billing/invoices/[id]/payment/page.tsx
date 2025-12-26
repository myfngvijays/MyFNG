'use client';

/**
 * Payment Collection Page
 * Step 6: Collect Payment - Complete payment interface
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { DollarSign, CreditCard, Wallet, Smartphone, Receipt, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import RazorpayPaymentButton from '@/components/payment/RazorpayPaymentButton';
import toast from 'react-hot-toast';

interface Invoice {
  id: string;
  invoice_number: string;
  final_amount: number;
  paid_amount: number;
  payment_status: string;
  status: string;
  lead: {
    id: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    vehicle_number: string;
  };
}

export default function PaymentCollectionPage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentMode, setPaymentMode] = useState<'online' | 'cash' | 'pos' | null>(null);
  const [cashAmount, setCashAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [staffName, setStaffName] = useState('');
  const [paymentRemarks, setPaymentRemarks] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);

  useEffect(() => {
    fetchInvoice();
  }, [invoiceId]);

  async function fetchInvoice() {
    const supabase = createClient();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: invoiceData, error } = await supabase
        .from('invoices')
        .select(`
          *,
          lead:service_leads!lead_id(
            id,
            customer_name,
            customer_email,
            customer_phone,
            vehicle_number
          )
        `)
        .eq('id', invoiceId)
        .single();

      if (error || !invoiceData) {
        toast.error('Invoice not found');
        router.push('/dashboard/billing');
        return;
      }

      setInvoice(invoiceData as Invoice);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  }

  async function recordOfflinePayment() {
    if (!paymentMode || !cashAmount || parseFloat(cashAmount) <= 0) {
      toast.error('Please enter valid payment details');
      return;
    }

    // Backend requires audit-friendly fields for offline payments
    if (paymentMode !== 'online') {
      if (!staffName || staffName.trim().length < 2) {
        toast.error('Staff name is required for offline payments');
        return;
      }
      if (!paymentRemarks || paymentRemarks.trim().length < 3) {
        toast.error('Payment remarks are required for offline payments');
        return;
      }
    }

    setRecordingPayment(true);

    try {
      const response = await fetch(`/api/payments/invoices/${invoiceId}/record-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment_mode: paymentMode.toUpperCase(),
          paid_amount: parseFloat(cashAmount),
          payment_txn_id: paymentReference || undefined,
          payment_reference: paymentReference || undefined,
          payment_remarks: paymentRemarks || undefined,
          staff_name: staffName || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to record payment');
      }

      toast.success('Payment recorded successfully!');
      
      // Refresh invoice data
      await fetchInvoice();
      
      // Reset form
      setPaymentMode(null);
      setCashAmount('');
      setPaymentReference('');
      setStaffName('');
      setPaymentRemarks('');

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push(`/dashboard/billing/invoices/${invoiceId}`);
      }, 2000);

    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Failed to record payment');
    } finally {
      setRecordingPayment(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="billing">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-12 h-12 animate-spin text-brand-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!invoice) {
    return (
      <DashboardLayout role="billing">
        <div className="card text-center py-12">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Invoice Not Found</h3>
          <button onClick={() => router.push('/dashboard/billing')} className="btn-primary mt-4">
            Back to Billing
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const remainingAmount = invoice.final_amount - (invoice.paid_amount || 0);
  const isPaid = invoice.payment_status === 'PAID';
  const isPartial = invoice.payment_status === 'PARTIAL';

  return (
    <DashboardLayout role="billing">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-primary to-brand-secondary text-white p-6 rounded-lg shadow-lg">
          <h1 className="text-3xl font-bold text-yellow-300 drop-shadow-lg">💳 Collect Payment</h1>
          <p className="text-white font-medium mt-1">Invoice: {invoice.invoice_number}</p>
        </div>

        {/* Invoice Summary */}
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600">Customer</p>
              <p className="font-semibold text-lg">{invoice.lead?.customer_name}</p>
              <p className="text-sm text-gray-500">{invoice.lead?.vehicle_number}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Invoice Amount</p>
              <p className="font-bold text-2xl text-green-600">₹{invoice.final_amount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">
                {isPaid ? 'Paid Amount' : isPartial ? 'Remaining Amount' : 'Amount Due'}
              </p>
              <p className={`font-bold text-2xl ${isPaid ? 'text-green-600' : 'text-orange-600'}`}>
                {isPaid 
                  ? `₹${invoice.paid_amount.toFixed(2)}` 
                  : `₹${remainingAmount.toFixed(2)}`}
              </p>
            </div>
          </div>

          {isPaid && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="w-5 h-5" />
                <span className="font-semibold">Payment Completed</span>
              </div>
            </div>
          )}
        </div>

        {!isPaid && (
          <>
            {/* Payment Methods */}
            <div className="card">
              <h2 className="text-xl font-bold mb-4">Select Payment Method</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <button
                  onClick={() => setPaymentMode('online')}
                  className={`p-4 border-2 rounded-lg transition ${
                    paymentMode === 'online'
                      ? 'border-brand-primary bg-brand-primary bg-opacity-10'
                      : 'border-gray-200 hover:border-brand-primary'
                  }`}
                >
                  <CreditCard className="w-8 h-8 mx-auto mb-2 text-brand-primary" />
                  <p className="font-semibold">Online Payment</p>
                  <p className="text-sm text-gray-500">UPI / Card / Netbanking</p>
                </button>

                <button
                  onClick={() => setPaymentMode('cash')}
                  className={`p-4 border-2 rounded-lg transition ${
                    paymentMode === 'cash'
                      ? 'border-brand-primary bg-brand-primary bg-opacity-10'
                      : 'border-gray-200 hover:border-brand-primary'
                  }`}
                >
                  <DollarSign className="w-8 h-8 mx-auto mb-2 text-brand-primary" />
                  <p className="font-semibold">Cash Payment</p>
                  <p className="text-sm text-gray-500">Cash at counter</p>
                </button>

                <button
                  onClick={() => setPaymentMode('pos')}
                  className={`p-4 border-2 rounded-lg transition ${
                    paymentMode === 'pos'
                      ? 'border-brand-primary bg-brand-primary bg-opacity-10'
                      : 'border-gray-200 hover:border-brand-primary'
                  }`}
                >
                  <Receipt className="w-8 h-8 mx-auto mb-2 text-brand-primary" />
                  <p className="font-semibold">POS Machine</p>
                  <p className="text-sm text-gray-500">Card swipe at counter</p>
                </button>
              </div>

              {/* Online Payment */}
              {paymentMode === 'online' && invoice.lead && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Pay Online via Razorpay</h3>
                  <RazorpayPaymentButton
                    invoiceId={invoiceId}
                    amount={remainingAmount}
                    customerName={invoice.lead.customer_name}
                    customerEmail={invoice.lead.customer_email || ''}
                    customerPhone={invoice.lead.customer_phone || ''}
                    invoiceNumber={invoice.invoice_number}
                    onPaymentSuccess={() => {
                      fetchInvoice();
                    }}
                    onPaymentFailure={(error) => {
                      console.error('Payment failed:', error);
                    }}
                    className="w-full"
                  />
                </div>
              )}

              {/* Cash/POS Payment Form */}
              {(paymentMode === 'cash' || paymentMode === 'pos') && (
                <div className="border-t pt-6 space-y-4">
                  <h3 className="text-lg font-semibold">
                    Record {paymentMode === 'cash' ? 'Cash' : 'POS'} Payment
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Amount Received (₹)
                      </label>
                      <input
                        type="number"
                        value={cashAmount}
                        onChange={(e) => setCashAmount(e.target.value)}
                        placeholder={remainingAmount.toFixed(2)}
                        max={remainingAmount}
                        min="0"
                        step="0.01"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Remaining: ₹{remainingAmount.toFixed(2)}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Transaction Reference (Optional)
                      </label>
                      <input
                        type="text"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        placeholder="TXN123456 or Receipt No."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Staff Name (Optional)
                      </label>
                      <input
                        type="text"
                        value={staffName}
                        onChange={(e) => setStaffName(e.target.value)}
                        placeholder="Who received the payment"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Payment Remarks (Optional)
                      </label>
                      <input
                        type="text"
                        value={paymentRemarks}
                        onChange={(e) => setPaymentRemarks(e.target.value)}
                        placeholder="e.g., Cash received at counter"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                      />
                    </div>
                  </div>

                  <button
                    onClick={recordOfflinePayment}
                    disabled={recordingPayment || !cashAmount || parseFloat(cashAmount) <= 0}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    {recordingPayment ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Recording Payment...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Record Payment
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Back Button */}
        <div className="flex justify-end">
          <button
            onClick={() => router.push(`/dashboard/billing/invoices/${invoiceId}`)}
            className="btn-secondary"
          >
            Back to Invoice
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

