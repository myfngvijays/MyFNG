'use client';

/**
 * Razorpay Payment Button Component
 * Step 6: Collect Payment - Online payment via Razorpay
 */

import { useState, useEffect } from 'react';
import { CreditCard, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { loadRazorpayScript, initializeRazorpayCheckout, createPaymentOrder } from '@/lib/services/paymentService';
import toast from 'react-hot-toast';

interface RazorpayPaymentButtonProps {
  invoiceId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  invoiceNumber: string;
  onPaymentSuccess?: (paymentData: any) => void;
  onPaymentFailure?: (error: any) => void;
  className?: string;
}

export default function RazorpayPaymentButton({
  invoiceId,
  amount,
  customerName,
  customerEmail,
  customerPhone,
  invoiceNumber,
  onPaymentSuccess,
  onPaymentFailure,
  className = '',
}: RazorpayPaymentButtonProps) {
  const [loading, setLoading] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');

  useEffect(() => {
    // Load Razorpay script
    loadRazorpayScript().then((loaded) => {
      setRazorpayLoaded(loaded);
      if (!loaded) {
        toast.error('Failed to load payment gateway');
      }
    });
  }, []);

  const handlePayment = async () => {
    if (!razorpayLoaded) {
      toast.error('Payment gateway not ready. Please wait...');
      return;
    }

    if (amount <= 0) {
      toast.error('Invalid payment amount');
      return;
    }

    setLoading(true);
    setPaymentStatus('processing');

    try {
      // Create payment order
      const order = await createPaymentOrder(
        invoiceId,
        amount,
        customerEmail,
        customerPhone
      );

      if (!order) {
        throw new Error('Failed to create payment order');
      }

      // Initialize Razorpay checkout
      initializeRazorpayCheckout(
        order,
        customerName,
        customerEmail,
        customerPhone,
        async (response: any) => {
          // Payment successful - verify on server
          try {
            const verifyResponse = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                invoiceId: invoiceId,
              }),
            });

            const verifyData = await verifyResponse.json();

            if (verifyData.verified) {
              setPaymentStatus('success');
              toast.success('Payment successful!');
              onPaymentSuccess?.(verifyData);
              
              // Refresh page after 2 seconds
              setTimeout(() => {
                window.location.reload();
              }, 2000);
            } else {
              setPaymentStatus('failed');
              toast.error(verifyData.message || 'Payment verification failed');
              onPaymentFailure?.(verifyData);
            }
          } catch (error: any) {
            setPaymentStatus('failed');
            toast.error('Payment verification error');
            onPaymentFailure?.(error);
          } finally {
            setLoading(false);
          }
        },
        (error: any) => {
          setPaymentStatus('failed');
          setLoading(false);
          toast.error(error.message || 'Payment failed');
          onPaymentFailure?.(error);
        }
      );
    } catch (error: any) {
      setPaymentStatus('failed');
      setLoading(false);
      toast.error(error.message || 'Failed to initiate payment');
      onPaymentFailure?.(error);
    }
  };

  if (paymentStatus === 'success') {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle className="w-5 h-5" />
        <span className="font-semibold">Payment Successful</span>
      </div>
    );
  }

  if (paymentStatus === 'failed') {
    return (
      <button
        onClick={handlePayment}
        className={`btn-primary flex items-center gap-2 ${className}`}
      >
        <XCircle className="w-4 h-4" />
        Retry Payment
      </button>
    );
  }

  return (
    <button
      onClick={handlePayment}
      disabled={loading || !razorpayLoaded || amount <= 0}
      className={`btn-primary flex items-center justify-center gap-2 ${className} ${
        loading || !razorpayLoaded ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Processing...
        </>
      ) : (
        <>
          <CreditCard className="w-4 h-4" />
          Pay ₹{amount.toFixed(2)}
        </>
      )}
    </button>
  );
}

