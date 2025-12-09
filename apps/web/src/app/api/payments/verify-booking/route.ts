/**
 * Payment Verification API for Booking Flow
 * Verifies Razorpay payment signature (no authentication required)
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

export async function POST(request: Request) {
  try {
    const { orderId, paymentId, signature } = await request.json();

    if (!orderId || !paymentId || !signature) {
      return NextResponse.json({ 
        verified: false, 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    // Verify signature
    const text = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(text)
      .digest('hex');

    const isValid = expectedSignature === signature;

    if (!isValid) {
      return NextResponse.json({
        verified: false,
        message: 'Invalid signature',
      }, { status: 400 });
    }

    // Fetch payment details from Razorpay to confirm status
    const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
    const razorpayResponse = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`,
      },
    });

    if (!razorpayResponse.ok) {
      return NextResponse.json({
        verified: false,
        message: 'Failed to fetch payment details from Razorpay',
      }, { status: 500 });
    }

    const paymentDetails = await razorpayResponse.json();

    // Check if payment is captured or authorized
    if (paymentDetails.status !== 'captured' && paymentDetails.status !== 'authorized') {
      return NextResponse.json({
        verified: false,
        message: `Payment status: ${paymentDetails.status}`,
      }, { status: 400 });
    }

    // Payment verified successfully
    return NextResponse.json({
      verified: true,
      message: 'Payment verified successfully',
      payment_id: paymentId,
      order_id: orderId,
      amount: paymentDetails.amount ? parseFloat(paymentDetails.amount) / 100 : null,
      status: paymentDetails.status,
    });

  } catch (error: any) {
    console.error('Error verifying payment:', error);
    return NextResponse.json(
      { verified: false, error: error.message },
      { status: 500 }
    );
  }
}

