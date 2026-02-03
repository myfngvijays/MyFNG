/**
 * Create Payment Intent API
 * Phase 1.3 - Payment Options
 * Purpose: Create payment intent with allowed methods based on workshop policy
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invoiceId = params.id;
    const body = await request.json();
    const { amount, customer_type } = body; // customer_type: 'retail' | 'corporate'

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        lead:service_leads!lead_id(
          id,
          customer_id,
          customer_type
        ),
        workshop:workshops!workshop_id(
          id
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Verify invoice is ready for payment
    if (!['APPROVED', 'SENT', 'AWAITING_PAYMENT'].includes(invoice.status)) {
      return NextResponse.json({
        error: 'Invoice not ready for payment',
        current_status: invoice.status,
      }, { status: 400 });
    }

    // Get workshop payment policy
    const { data: policy, error: policyError } = await supabase
      .from('workshop_payment_policy')
      .select('*')
      .eq('workshop_id', invoice.workshop_id)
      .eq('is_active', true)
      .single();

    // If no policy exists, create default policy
    let paymentPolicy = policy;
    if (policyError || !policy) {
      // Use default policy
      paymentPolicy = {
        allow_online_payment: true,
        allow_cash: true,
        allow_pos: true,
        allow_cod: false,
        allow_credit: false,
        allow_partial_payment: false,
        allowed_online_methods: ['UPI', 'CARD', 'NETBANKING', 'WALLET'],
        corporate_allowed_methods: ['UPI', 'CARD', 'NETBANKING', 'CREDIT'],
        retail_allowed_methods: ['UPI', 'CARD', 'WALLET', 'CASH', 'POS'],
        generate_qr_code: true,
      };
    }

    // Determine customer type
    const customerType = customer_type || invoice.lead?.customer_type || 'retail';
    const isCorporate = customerType === 'corporate' || customerType === 'B2B';

    // Build allowed methods based on policy and customer type
    const allowedMethods: string[] = [];
    
    if (paymentPolicy.allow_online_payment) {
      const onlineMethods = isCorporate 
        ? paymentPolicy.corporate_allowed_methods || []
        : paymentPolicy.retail_allowed_methods || [];
      allowedMethods.push(...onlineMethods);
    }

    if (paymentPolicy.allow_cash && !isCorporate) {
      allowedMethods.push('CASH');
    }

    if (paymentPolicy.allow_pos && !isCorporate) {
      allowedMethods.push('POS');
    }

    if (paymentPolicy.allow_cod && !isCorporate) {
      const invoiceAmount = parseFloat(invoice.final_amount || '0');
      if (invoiceAmount <= (paymentPolicy.cod_max_amount || 0)) {
        allowedMethods.push('COD');
      }
    }

    if (paymentPolicy.allow_credit && isCorporate) {
      allowedMethods.push('CREDIT');
    }

    // Remove duplicates
    const uniqueMethods = [...new Set(allowedMethods)];

    // Calculate payment amount
    const paymentAmount = amount || parseFloat(invoice.final_amount || '0');
    const balanceDue = parseFloat(invoice.balance_due || invoice.final_amount || '0');
    const finalAmount = paymentAmount > balanceDue ? balanceDue : paymentAmount;

    // Check if partial payment is allowed
    if (finalAmount < balanceDue && !paymentPolicy.allow_partial_payment) {
      return NextResponse.json({
        error: 'Partial payment not allowed',
        required_amount: balanceDue,
        provided_amount: finalAmount,
      }, { status: 400 });
    }

    // Check minimum online amount
    if (uniqueMethods.includes('UPI') || uniqueMethods.includes('CARD')) {
      const minAmount = parseFloat(paymentPolicy.min_online_amount || '0');
      if (finalAmount < minAmount) {
        return NextResponse.json({
          error: `Minimum online payment amount is ₹${minAmount}`,
          provided_amount: finalAmount,
        }, { status: 400 });
      }
    }

    // Check maximum cash amount
    if (uniqueMethods.includes('CASH')) {
      const maxCash = parseFloat(paymentPolicy.max_cash_amount || '50000');
      if (finalAmount > maxCash) {
        return NextResponse.json({
          error: `Maximum cash payment is ₹${maxCash}`,
          provided_amount: finalAmount,
        }, { status: 400 });
      }
    }

    // Create payment intent
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours expiry

    const { data: paymentIntent, error: intentError } = await supabase
      .from('payment_intents')
      .insert({
        invoice_id: invoiceId,
        lead_id: invoice.lead_id,
        amount: finalAmount,
        currency: 'INR',
        allowed_methods: uniqueMethods,
        status: 'CREATED',
        expires_at: expiresAt.toISOString(),
        metadata: {
          customer_type: customerType,
          is_corporate: isCorporate,
          balance_due: balanceDue,
          is_partial: finalAmount < balanceDue,
        },
      })
      .select()
      .single();

    if (intentError) {
      console.error('Error creating payment intent:', intentError);
      return NextResponse.json({ error: 'Failed to create payment intent' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      payment_intent: paymentIntent,
      allowed_methods: uniqueMethods,
      amount: finalAmount,
      balance_due: balanceDue,
      is_partial: finalAmount < balanceDue,
      expires_at: expiresAt.toISOString(),
    }, { status: 201 });

  } catch (error) {
    console.error('Error in create payment intent API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

