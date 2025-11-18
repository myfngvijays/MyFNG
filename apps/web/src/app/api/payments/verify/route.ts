/**
 * Payment Verification API
 * Phase 4 - Task WA-501
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { orderId, paymentId, signature } = await request.json();

    // Verify signature
    const text = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(text)
      .digest('hex');

    const isValid = expectedSignature === signature;

    if (isValid) {
      // Payment verified successfully
      return NextResponse.json({
        verified: true,
        message: 'Payment verified successfully',
      });
    } else {
      return NextResponse.json({
        verified: false,
        message: 'Invalid signature',
      }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Error verifying payment:', error);
    return NextResponse.json(
      { verified: false, error: error.message },
      { status: 500 }
    );
  }
}

