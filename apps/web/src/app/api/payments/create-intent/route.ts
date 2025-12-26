import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { ensureInvoiceForLead } from '@/lib/payments/chatInvoice';
import { resolvePayable } from '@/lib/payments/chatPaymentTypes';
import { createShortUrl } from '@/lib/services/urlShortener';

export const dynamic = 'force-dynamic';

// Best-effort, in-memory rate limiting (helps prevent accidental spam from UI).
// Note: serverless environments may reset state; still useful for local/proxy deployments.
const RL_WINDOW_MS = 60_000; // 1 minute
const RL_MAX = 12; // per window per ip
const rateMap = new Map<string, { count: number; resetAt: number }>();

/**
 * POST /api/payments/create-intent
 * Create payment intent for online payment (Razorpay)
 *
 * Supports:
 * - invoice payment (default): computes remaining from invoice and charges remaining
 * - chat payments: BOOKING_TOKEN / ADVANCE (requires lead_id, may create/update invoice first)
 */
export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const nowMs = Date.now();
    const slot = rateMap.get(ip);
    if (!slot || slot.resetAt <= nowMs) {
      rateMap.set(ip, { count: 1, resetAt: nowMs + RL_WINDOW_MS });
    } else {
      slot.count += 1;
      if (slot.count > RL_MAX) {
        return NextResponse.json({ error: 'Too many payment requests. Please wait a moment and try again.' }, { status: 429 });
      }
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const body = await request.json();
    const {
      invoice_id,
      lead_id,
      payment_type, // BOOKING_TOKEN | ADVANCE | INVOICE
      amount, // optional override (used for ADVANCE)
      payment_method = 'RAZORPAY',
      metadata = {},
    } = body || {};

    // Prefer service-role client when available (public flows + webhook parity).
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_ADMIN_KEY;
    const admin = supabaseUrl && serviceRoleKey
      ? createSupabaseAdminClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
      : null;
    const db = admin || supabase;

    // Best-effort request logging (ignore failures to avoid blocking payments)
    const requestStartedAt = Date.now();

    // Determine mode
    const normalizedType = (typeof payment_type === 'string' ? payment_type.toUpperCase() : '') || 'INVOICE';

    // For chat flows, allow invoice creation/adjustment from lead_id
    let invoiceId = typeof invoice_id === 'string' ? invoice_id : null;
    let leadId = typeof lead_id === 'string' ? lead_id : null;

    if (normalizedType === 'BOOKING_TOKEN' || normalizedType === 'ADVANCE') {
      if (!leadId) {
        return NextResponse.json({ error: 'Lead ID required for chat payments' }, { status: 400 });
      }

      const payable = await resolvePayable({
        paymentType: normalizedType,
        leadId,
        invoiceId,
        amountOverride: amount,
      } as any);

      // Ensure invoice exists for the lead and has at least desired amount (for token/advance).
      const ensured = await ensureInvoiceForLead({
        leadId,
        desiredAmount: payable.amount,
        purpose: normalizedType,
      });
      invoiceId = ensured.id;
      leadId = ensured.lead_id;
    }

    // Full payment: allow creating/fetching invoice using lead_id when invoice_id is not provided.
    if (normalizedType === 'INVOICE' && !invoiceId && leadId) {
      const ensured = await ensureInvoiceForLead({
        leadId,
        desiredAmount: null,
        purpose: 'INVOICE',
      });
      invoiceId = ensured.id;
      leadId = ensured.lead_id;
    }

    // Get invoice details
    if (!invoiceId) {
      return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 });
    }

    const { data: invoice, error: invoiceError } = await db
      .from('invoices')
      .select(`
        *,
        lead:service_leads!inner(
          id, lead_number, customer_name, customer_phone, customer_email
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // NEW FLOW: payments should be based on Customer Invoice (CI), not Order Summary (OS)
    if ((invoice as any).invoice_type === 'ORDER_SUMMARY') {
      return NextResponse.json(
        {
          error: 'Payment cannot be initiated for Order Summary',
          hint: 'Please confirm the Order Summary to generate/activate the Customer Invoice, then pay against CI.',
        },
        { status: 400 }
      );
    }

    if (invoice.payment_status === 'PAID') {
      return NextResponse.json({ 
        error: 'Invoice already paid',
        payment_status: invoice.payment_status
      }, { status: 400 });
    }

    const lead = invoice.lead as any;
    const invoiceAmount = parseFloat(invoice.final_amount || invoice.total_amount || '0');
    const currentPaid = parseFloat(invoice.paid_amount || '0');

    // Amount to charge:
    // - BOOKING_TOKEN/ADVANCE: charge requested amount (but cap to balance due)
    // - INVOICE: charge remaining amount
    const balanceDue = Math.max(0, invoiceAmount - currentPaid);
    let chargeAmount = balanceDue;
    if (normalizedType === 'BOOKING_TOKEN' || normalizedType === 'ADVANCE') {
      const requested = typeof amount === 'number' ? amount : parseFloat(String(amount || '0'));
      if (requested > 0) chargeAmount = Math.min(balanceDue, requested);
      // For booking token, if no amount override, charge full balance due (which equals token amount when invoice was created)
      if (normalizedType === 'BOOKING_TOKEN' && !(requested > 0)) chargeAmount = balanceDue;
    }

    if (chargeAmount <= 0) {
      return NextResponse.json({
        error: 'Invoice already settled',
        payment_status: invoice.payment_status,
        remaining_amount: balanceDue
      }, { status: 400 });
    }

    // Idempotency / anti-spam: reuse a recent unexpired intent for same invoice+amount+type
    try {
      const nowIso = new Date().toISOString();
      const { data: existingIntent } = await db
        .from('payment_intents')
        .select('id, gateway_order_id, amount, currency, expires_at')
        .eq('invoice_id', invoiceId)
        .eq('status', 'CREATED')
        .gte('expires_at', nowIso)
        .eq('amount', chargeAmount)
        .contains('metadata', { payment_type: normalizedType })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if ((existingIntent as any)?.gateway_order_id) {
        return NextResponse.json({
          success: true,
          order: {
            orderId: (existingIntent as any).gateway_order_id,
            amount: Math.round(chargeAmount * 100),
            currency: 'INR',
            receipt: null,
          },
          payment_intent: {
            id: (existingIntent as any).id,
            order_id: (existingIntent as any).gateway_order_id,
            amount: chargeAmount,
            amount_paise: Math.round(chargeAmount * 100),
            currency: 'INR',
            razorpay_key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
            invoice_id: invoiceId,
            invoice_number: invoice.invoice_number,
            payment_type: normalizedType,
          },
          invoice: {
            id: invoice.id,
            invoice_number: invoice.invoice_number,
            total_amount: invoice.total_amount,
            final_amount: invoice.final_amount,
            paid_amount: invoice.paid_amount,
            remaining_amount: balanceDue,
          },
          customer: {
            name: lead.customer_name,
            phone: lead.customer_phone,
            email: lead.customer_email,
          },
          reused: true,
        });
      }
    } catch {
      // ignore idempotency lookup errors; continue to create fresh order
    }

    const amountInPaise = Math.round(chargeAmount * 100);

    const razorpayKeyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || '';
    if (!razorpayKeyId || !razorpayKeySecret) {
      return NextResponse.json({
        error: 'Payment gateway not configured',
        hint: 'Missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET'
      }, { status: 500 });
    }

    // Create Razorpay order
    const receipt = `INV_${invoice.invoice_number || invoice_id.substring(0, 8)}`;
    const orderData = {
      amount: amountInPaise,
      currency: 'INR',
      receipt,
      notes: {
        invoice_id: invoice_id,
        invoice_number: invoice.invoice_number,
        lead_id: lead.id,
        lead_number: lead.lead_number,
        customer_name: lead.customer_name,
        customer_phone: lead.customer_phone,
      },
    };

    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64')}`,
      },
      body: JSON.stringify(orderData),
    });

    if (!razorpayResponse.ok) {
      let errMsg = 'Failed to create Razorpay order';
      try {
        const err = await razorpayResponse.json();
        errMsg = err?.error?.description || errMsg;
      } catch {}
      return NextResponse.json({ error: errMsg }, { status: razorpayResponse.status });
    }

    const razorpayOrder = await razorpayResponse.json();

    const now = new Date().toISOString();

    // Create payment_intent record (source of truth for intent/linking)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    const { data: paymentIntent, error: intentErr } = await db
      .from('payment_intents')
      .insert({
        invoice_id: invoiceId,
        lead_id: lead.id,
        amount: chargeAmount,
        currency: 'INR',
        allowed_methods: ['UPI', 'CARD', 'NETBANKING', 'WALLET'],
        status: 'CREATED',
        gateway_order_id: razorpayOrder.id,
        expires_at: expiresAt.toISOString(),
        metadata: {
          ...(metadata && typeof metadata === 'object' ? metadata : {}),
          ...(normalizedType ? { payment_type: normalizedType } : {}),
          source: 'api/payments/create-intent',
        },
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (intentErr || !paymentIntent) {
      console.error('Payment intent creation error:', intentErr);
      return NextResponse.json({ error: 'Failed to create payment intent' }, { status: 500 });
    }

    // Create payment transaction record (PENDING) for webhook lookup compatibility
    const { data: paymentTxn, error: txnError } = await db
      .from('payment_transactions')
      .insert({
        invoice_id: invoiceId,
        lead_id: lead.id,
        amount: chargeAmount,
        currency: 'INR',
        payment_method: payment_method === 'RAZORPAY' ? 'ONLINE' : payment_method,
        payment_gateway: 'RAZORPAY',
        gateway_order_id: razorpayOrder.id,
        transaction_id: `TXN-${Date.now()}-${String(invoiceId).substring(0, 8)}`,
        status: 'PENDING',
        initiated_at: now,
        created_by: user?.id || null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (txnError || !paymentTxn) {
      console.error('Payment transaction creation error:', txnError);
      // Keep intent created; webhook can still reconcile by order id in payment_intents.
    }

    // Create a shareable short pay link tied to payment_intent (best-effort)
    let payLink: string | null = null;
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const longUrl = `${appUrl}/invoice/${invoice.invoice_number}`;
      const short = await createShortUrl(longUrl, 'payment', (paymentIntent as any).id);
      payLink = short.shortUrl || longUrl;
    } catch {
      payLink = null;
    }

    // Write api_request_logs best-effort
    try {
      await db.from('api_request_logs').insert({
        api_endpoint: '/api/payments/create-intent',
        http_method: 'POST',
        user_id: user?.id || null,
        request_body: { invoice_id: invoiceId, lead_id: leadId, payment_type: normalizedType, amount: chargeAmount },
        response_status: 200,
        response_body: { order_id: razorpayOrder.id, payment_intent_id: (paymentIntent as any)?.id },
        execution_time_ms: Date.now() - requestStartedAt,
        ip_address: ip,
        user_agent: request.headers.get('user-agent') || null,
        created_at: now,
      });
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      order: {
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt,
      },
      payment_intent: {
        id: (paymentIntent as any).id,
        order_id: razorpayOrder.id,
        amount: chargeAmount,
        amount_paise: amountInPaise,
        currency: 'INR',
        razorpay_key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
        invoice_id: invoiceId,
        invoice_number: invoice.invoice_number,
        payment_type: normalizedType,
      },
      invoice: {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        total_amount: invoice.total_amount,
        final_amount: invoice.final_amount,
        paid_amount: invoice.paid_amount,
        remaining_amount: balanceDue,
      },
      customer: {
        name: lead.customer_name,
        phone: lead.customer_phone,
        email: lead.customer_email
      },
      pay_link: payLink,
    });

  } catch (error: any) {
    console.error('Payment intent creation error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

