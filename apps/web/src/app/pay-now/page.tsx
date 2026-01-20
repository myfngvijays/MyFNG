'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { loadRazorpayScript, initializeRazorpayCheckout } from '@/lib/services/paymentService';
import { CreditCard, CheckCircle, AlertCircle } from 'lucide-react';

type OrderResponse = {
  orderId: string;
  amount: number;
  currency: string;
  receipt: string | null;
};

type PaymentSummary = {
  orderId: string;
  paymentId: string;
  amount: number | null;
  status: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
};

export default function PayNowPage() {
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [razorpayReady, setRazorpayReady] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);
  const [dbUpdateStatus, setDbUpdateStatus] = useState<string | null>(null);

  useEffect(() => {
    loadRazorpayScript().then((ok) => setRazorpayReady(ok));
  }, []);

  async function handlePay() {
    const amt = Number(amount);
    if (!razorpayReady) {
      setStatus('error');
      setStatusMessage('Payment gateway is not ready yet.');
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setStatus('error');
      setStatusMessage('Please enter a valid amount.');
      return;
    }
    if (!name.trim()) {
      setStatus('error');
      setStatusMessage('Please enter your name.');
      return;
    }
    if (!phone.trim()) {
      setStatus('error');
      setStatusMessage('Please enter your phone.');
      return;
    }

    setLoading(true);
    setStatus('idle');
    setStatusMessage('');

    try {
      const res = await fetch('/api/payments/create-direct-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          customerName: name.trim(),
          customerEmail: email.trim() || null,
          customerPhone: phone.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to create payment order');

      const order: OrderResponse = json.order;
      initializeRazorpayCheckout(
        order,
        name.trim(),
        email.trim(),
        phone.trim(),
        async (response: any) => {
          try {
            const verifyRes = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: response?.razorpay_order_id,
                paymentId: response?.razorpay_payment_id,
                signature: response?.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData?.verified) {
              throw new Error(verifyData?.message || 'Payment verification failed');
            }
            setStatus('success');
            setStatusMessage('Payment successful.');
            if (verifyData?.direct_pay_updated) {
              setDbUpdateStatus('DB updated successfully.');
            } else if (verifyData?.direct_pay_error) {
              setDbUpdateStatus(`DB update failed: ${verifyData.direct_pay_error}`);
            } else {
              setDbUpdateStatus('DB update status unknown.');
            }
            setPaymentSummary({
              orderId: verifyData.order_id || response?.razorpay_order_id,
              paymentId: verifyData.payment_id || response?.razorpay_payment_id,
              amount: typeof verifyData.amount === 'number' ? verifyData.amount : null,
              status: verifyData.status || null,
              customerName: name.trim(),
              customerEmail: email.trim() || null,
              customerPhone: phone.trim(),
            });
          } catch (err: any) {
            setStatus('error');
            setStatusMessage(err?.message || 'Payment verification failed.');
          } finally {
            setLoading(false);
          }
        },
        (error: any) => {
          setStatus('error');
          setStatusMessage(error?.message || 'Payment failed.');
          setLoading(false);
        }
      );
    } catch (err: any) {
      setStatus('error');
      setStatusMessage(err?.message || 'Failed to initiate payment.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white font-poppins">
      <Navbar />
      <main className="pt-16 sm:pt-20 md:pt-24 pb-12 sm:pb-16 md:pb-20">
        <div className="container mx-auto px-3 sm:px-4 md:px-6">
          <div className="max-w-xl mx-auto bg-white border border-gray-100 rounded-2xl shadow-lg p-6 sm:p-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-brand-secondary mb-2">Pay Now</h1>
            <p className="text-sm text-gray-600 mb-6">
              Enter the amount and complete payment securely with Razorpay.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary"
                  placeholder="Enter amount"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email (optional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary"
                  placeholder="9876543210"
                />
              </div>
            </div>

            {status !== 'idle' && (
              <div className={`mt-4 flex items-center gap-2 text-sm ${status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {status === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{statusMessage}</span>
              </div>
            )}

            {paymentSummary && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                <div className="font-semibold mb-1">Order Details</div>
                <div>Order ID: {paymentSummary.orderId}</div>
                <div>Payment ID: {paymentSummary.paymentId}</div>
                <div>Amount: {paymentSummary.amount != null ? `₹${paymentSummary.amount}` : '—'}</div>
                <div>Status: {paymentSummary.status || 'SUCCESS'}</div>
                <div>Name: {paymentSummary.customerName}</div>
                <div>Email: {paymentSummary.customerEmail || '—'}</div>
                <div>Phone: {paymentSummary.customerPhone}</div>
                {dbUpdateStatus && <div className="mt-2 text-xs text-green-700">{dbUpdateStatus}</div>}
              </div>
            )}

            <button
              onClick={handlePay}
              disabled={loading}
              className="mt-6 w-full bg-brand-primary hover:bg-brand-primary-hover text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <CreditCard className="w-4 h-4" />
              {loading ? 'Processing...' : 'Pay Now'}
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

