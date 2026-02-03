import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/invoices/[id]/payment-intent
 * Create payment intent with allowed methods based on workshop policy
 */
export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();
    
    // Get authenticated user (optional for payment intents - can be public)
    const { data: { user } } = await supabase.auth.getUser();

    const invoiceId = params.id;
    const body = await request.json();
    
    const {
      customer_type = 'retail', // retail or corporate
      amount = null // Override amount for partial payments
    } = body;

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        lead:service_leads!inner(
          id, lead_number, workshop_id, customer_name
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Check if invoice is payable
    if (!['SENT', 'AWAITING_PAYMENT', 'PARTIALLY_PAID'].includes(invoice.status)) {
      return NextResponse.json({ 
        error: 'Invoice not ready for payment',
        invoice_status: invoice.status
      }, { status: 400 });
    }

    const lead = invoice.lead as any;

    // Get workshop payment policy
    const { data: paymentPolicy } = await supabase
      .from('workshop_payment_policy')
      .select('*')
      .eq('workshop_id', lead.workshop_id)
      .eq('is_active', true)
      .single();

    // Determine allowed payment methods
    let allowedMethods: string[] = [];
    
    if (paymentPolicy) {
      // Get methods based on customer type
      const methodsConfig = customer_type === 'corporate' 
        ? paymentPolicy.corporate_allowed_methods 
        : paymentPolicy.retail_allowed_methods;
      
      allowedMethods = Array.isArray(methodsConfig) ? methodsConfig : [];
      
      // Apply additional policy rules
      if (!paymentPolicy.allow_online_payment) {
        allowedMethods = allowedMethods.filter(m => !['UPI', 'CARD', 'NETBANKING', 'WALLET'].includes(m));
      }
      if (!paymentPolicy.allow_cash) {
        allowedMethods = allowedMethods.filter(m => m !== 'CASH');
      }
      if (!paymentPolicy.allow_pos) {
        allowedMethods = allowedMethods.filter(m => m !== 'POS');
      }
      if (!paymentPolicy.allow_cod) {
        allowedMethods = allowedMethods.filter(m => m !== 'COD');
      }
      if (!paymentPolicy.allow_credit) {
        allowedMethods = allowedMethods.filter(m => m !== 'CREDIT');
      }
    } else {
      // Default methods if no policy
      allowedMethods = ['UPI', 'CARD', 'NETBANKING', 'WALLET', 'CASH', 'POS'];
    }

    // Calculate payment amount
    const balanceDue = invoice.balance_due || invoice.total_amount;
    const paymentAmount = amount || balanceDue;

    // Validate amount
    if (paymentAmount <= 0) {
      return NextResponse.json({ 
        error: 'Invalid payment amount',
        balance_due: balanceDue
      }, { status: 400 });
    }

    if (paymentAmount > balanceDue) {
      return NextResponse.json({ 
        error: 'Payment amount exceeds balance due',
        balance_due: balanceDue,
        requested_amount: paymentAmount
      }, { status: 400 });
    }

    // Check partial payment policy
    const isPartialPayment = paymentAmount < balanceDue;
    if (isPartialPayment && paymentPolicy && !paymentPolicy.allow_partial_payment) {
      return NextResponse.json({ 
        error: 'Partial payments not allowed by workshop',
        balance_due: balanceDue,
        requested_amount: paymentAmount
      }, { status: 400 });
    }

    // Apply amount restrictions
    if (paymentPolicy) {
      // Min online amount
      if (allowedMethods.some(m => ['UPI', 'CARD', 'NETBANKING', 'WALLET'].includes(m))) {
        if (paymentAmount < (paymentPolicy.min_online_amount || 0)) {
          return NextResponse.json({ 
            error: 'Amount below minimum for online payment',
            min_amount: paymentPolicy.min_online_amount,
            requested_amount: paymentAmount
          }, { status: 400 });
        }
      }
      
      // Max cash amount
      if (allowedMethods.includes('CASH')) {
        if (paymentAmount > (paymentPolicy.max_cash_amount || 50000)) {
          allowedMethods = allowedMethods.filter(m => m !== 'CASH');
        }
      }
      
      // COD limits
      if (allowedMethods.includes('COD')) {
        if (paymentAmount > (paymentPolicy.cod_max_amount || 0)) {
          allowedMethods = allowedMethods.filter(m => m !== 'COD');
        }
      }
    }

    // Calculate expiry time (1 hour from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Check if payment intent already exists
    const { data: existingIntent } = await supabase
      .from('payment_intents')
      .select('*')
      .eq('invoice_id', invoiceId)
      .eq('status', 'CREATED')
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();

    let paymentIntent;

    if (existingIntent) {
      // Update existing intent
      const { data: updatedIntent } = await supabase
        .from('payment_intents')
        .update({
          amount: paymentAmount,
          allowed_methods: allowedMethods,
          expires_at: expiresAt.toISOString(),
          metadata: {
            customer_type,
            is_partial_payment: isPartialPayment,
            balance_due: balanceDue,
            policy_applied: !!paymentPolicy
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', existingIntent.id)
        .select()
        .single();
      
      paymentIntent = updatedIntent;
    } else {
      // Create new payment intent
      const { data: newIntent, error: intentError } = await supabase
        .from('payment_intents')
        .insert({
          invoice_id: invoiceId,
          lead_id: lead.id,
          amount: paymentAmount,
          currency: 'INR',
          allowed_methods: allowedMethods,
          status: 'CREATED',
          expires_at: expiresAt.toISOString(),
          metadata: {
            customer_type,
            is_partial_payment: isPartialPayment,
            balance_due: balanceDue,
            policy_applied: !!paymentPolicy,
            customer_name: lead.customer_name
          }
        })
        .select()
        .single();

      if (intentError) {
        console.error('Error creating payment intent:', intentError);
        return NextResponse.json({ 
          error: 'Failed to create payment intent',
          details: intentError.message
        }, { status: 500 });
      }

      paymentIntent = newIntent;
    }

    // Generate QR code if enabled and UPI is allowed
    let qrCodeData = null;
    if (paymentPolicy?.generate_qr_code && allowedMethods.includes('UPI')) {
      // Generate UPI QR code data
      // Format: upi://pay?pa=merchant@upi&pn=MerchantName&am=1000&cu=INR&tn=Invoice123
      qrCodeData = `upi://pay?pa=merchant@upi&pn=Workshop&am=${paymentAmount}&cu=INR&tn=${invoice.invoice_number}`;
      
      // Update intent with QR code
      await supabase
        .from('payment_intents')
        .update({
          qr_code_data: qrCodeData,
          qr_code_url: `/api/qr-code?data=${encodeURIComponent(qrCodeData)}`
        })
        .eq('id', paymentIntent.id);
    }

    // Prepare payment options with details
    const paymentOptions = allowedMethods.map(method => ({
      method,
      display_name: getPaymentMethodName(method),
      icon: getPaymentMethodIcon(method),
      description: getPaymentMethodDescription(method),
      recommended: method === 'UPI' // UPI is typically recommended
    }));

    return NextResponse.json({
      success: true,
      payment_intent: {
        id: paymentIntent.id,
        amount: paymentAmount,
        currency: 'INR',
        allowed_methods: allowedMethods,
        payment_options: paymentOptions,
        expires_at: paymentIntent.expires_at,
        qr_code_url: paymentIntent.qr_code_url,
        qr_code_data: qrCodeData
      },
      invoice: {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        total_amount: invoice.total_amount,
        balance_due: balanceDue,
        paid_amount: invoice.paid_amount || 0
      },
      policy: paymentPolicy ? {
        allow_partial: paymentPolicy.allow_partial_payment,
        allow_split: paymentPolicy.allow_split_payment,
        max_split_count: paymentPolicy.max_split_count,
        min_online_amount: paymentPolicy.min_online_amount,
        max_cash_amount: paymentPolicy.max_cash_amount,
        cod_max_amount: paymentPolicy.cod_max_amount
      } : null
    });

  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

// Helper functions
function getPaymentMethodName(method: string): string {
  const names: Record<string, string> = {
    'UPI': 'UPI Payment',
    'CARD': 'Debit/Credit Card',
    'NETBANKING': 'Net Banking',
    'WALLET': 'Digital Wallet',
    'CASH': 'Cash',
    'POS': 'Card at Workshop (POS)',
    'COD': 'Cash on Delivery',
    'CREDIT': 'Credit Terms'
  };
  return names[method] || method;
}

function getPaymentMethodIcon(method: string): string {
  const icons: Record<string, string> = {
    'UPI': '📱',
    'CARD': '💳',
    'NETBANKING': '🏦',
    'WALLET': '👛',
    'CASH': '💵',
    'POS': '💳',
    'COD': '💰',
    'CREDIT': '📄'
  };
  return icons[method] || '💰';
}

function getPaymentMethodDescription(method: string): string {
  const descriptions: Record<string, string> = {
    'UPI': 'Pay instantly via any UPI app (PhonePe, GPay, Paytm, etc.)',
    'CARD': 'Pay securely with Debit or Credit Card',
    'NETBANKING': 'Direct payment from your bank account',
    'WALLET': 'Pay using Paytm, PhonePe, or other wallets',
    'CASH': 'Pay in cash at the workshop',
    'POS': 'Swipe your card at the workshop counter',
    'COD': 'Pay cash when vehicle is delivered',
    'CREDIT': 'Pay later with approved credit terms'
  };
  return descriptions[method] || '';
}

