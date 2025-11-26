/**
 * Payment Service - Razorpay Integration
 * Phase 4 - Task WA-501
 * 
 * Features:
 * - Create payment orders
 * - Verify payments
 * - Handle webhooks
 * - Process refunds
 */

import { createClient } from '@/lib/supabase/client';

// Razorpay configuration
// Note: Key ID is public and can be used in frontend
// Key Secret should NEVER be exposed in frontend code
const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
// Key Secret is only used in server-side APIs, not in this client-side service

if (!RAZORPAY_KEY_ID) {
  console.error('RAZORPAY_KEY_ID not found. Please add it to .env.local file.');
}

export interface PaymentOrder {
  orderId: string;
  amount: number;
  currency: string;
  receipt: string;
}

export interface PaymentDetails {
  paymentId: string;
  orderId: string;
  signature: string;
  amount: number;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
}

/**
 * Create a Razorpay order
 */
export async function createPaymentOrder(
  invoiceId: string,
  amount: number,
  customerEmail: string,
  customerPhone: string
): Promise<PaymentOrder | null> {
  try {
    const response = await fetch('/api/payments/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoiceId,
        amount,
        customerEmail,
        customerPhone,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create payment order');
    }

    const data = await response.json();
    return data.order;
  } catch (error) {
    console.error('Error creating payment order:', error);
    return null;
  }
}

/**
 * Verify payment signature
 */
export async function verifyPayment(
  orderId: string,
  paymentId: string,
  signature: string
): Promise<boolean> {
  try {
    const response = await fetch('/api/payments/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId,
        paymentId,
        signature,
      }),
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.verified;
  } catch (error) {
    console.error('Error verifying payment:', error);
    return false;
  }
}

/**
 * Initialize Razorpay checkout
 */
export function initializeRazorpayCheckout(
  order: PaymentOrder,
  customerName: string,
  customerEmail: string,
  customerPhone: string,
  onSuccess: (response: any) => void,
  onFailure: (error: any) => void
) {
  // Check if Razorpay script is loaded
  if (typeof window === 'undefined' || !(window as any).Razorpay) {
    console.error('Razorpay SDK not loaded');
    onFailure({ message: 'Payment gateway not available' });
    return;
  }

  const options = {
    key: RAZORPAY_KEY_ID,
    amount: order.amount,
    currency: order.currency,
    name: 'MyFNG Workshop',
    description: 'Service Payment',
    order_id: order.orderId,
    handler: async function (response: any) {
      // Verify payment
      const verified = await verifyPayment(
        response.razorpay_order_id,
        response.razorpay_payment_id,
        response.razorpay_signature
      );

      if (verified) {
        onSuccess(response);
      } else {
        onFailure({ message: 'Payment verification failed' });
      }
    },
    prefill: {
      name: customerName,
      email: customerEmail,
      contact: customerPhone,
    },
    theme: {
      color: '#3B82F6', // Brand primary color
    },
    modal: {
      ondismiss: function () {
        onFailure({ message: 'Payment cancelled by user' });
      },
    },
  };

  const razorpay = new (window as any).Razorpay(options);
  razorpay.open();
}

/**
 * Get payment status
 */
export async function getPaymentStatus(paymentId: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/payments/${paymentId}/status`);
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.status;
  } catch (error) {
    console.error('Error getting payment status:', error);
    return null;
  }
}

/**
 * Process refund
 */
export async function processRefund(
  paymentId: string,
  amount: number,
  reason: string
): Promise<boolean> {
  try {
    const response = await fetch('/api/payments/refund', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentId,
        amount,
        reason,
      }),
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Error processing refund:', error);
    return false;
  }
}

/**
 * Save payment record to database
 */
export async function savePaymentRecord(
  invoiceId: string,
  paymentData: {
    gatewayPaymentId: string;
    gatewayOrderId: string;
    amount: number;
    paymentMethod: string;
    status: string;
    metadata?: any;
  }
): Promise<boolean> {
  const supabase = await createClient();

  try {
    const { error } = await supabase.from('payments').insert({
      invoice_id: invoiceId,
      gateway_payment_id: paymentData.gatewayPaymentId,
      gateway_order_id: paymentData.gatewayOrderId,
      amount: paymentData.amount,
      payment_method: paymentData.paymentMethod,
      payment_gateway: 'RAZORPAY',
      status: paymentData.status,
      metadata: paymentData.metadata || {},
    });

    if (error) throw error;

    // Update invoice status
    await supabase
      .from('invoices')
      .update({ payment_status: 'PAID' })
      .eq('id', invoiceId);

    return true;
  } catch (error) {
    console.error('Error saving payment record:', error);
    return false;
  }
}

/**
 * Load Razorpay script dynamically
 */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;

    script.onload = () => {
      resolve(true);
    };

    script.onerror = () => {
      resolve(false);
    };

    document.body.appendChild(script);
  });
}

/**
 * Format amount for display
 */
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount / 100); // Razorpay uses paise
}

/**
 * Convert rupees to paise
 */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/**
 * Convert paise to rupees
 */
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

