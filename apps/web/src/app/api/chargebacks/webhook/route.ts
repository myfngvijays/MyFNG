import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chargebacks/webhook
 * Handle payment gateway chargeback notifications
 */
export async function POST(request: NextRequest) {
  try {
    // Use service role for webhook (no user auth)
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json();
    
    // Extract chargeback data (format varies by PG)
    const {
      pg_provider = 'RAZORPAY',
      pg_case_id,
      pg_chargeback_id,
      payment_id, // Our payment transaction ID
      gateway_payment_id, // PG's payment ID
      chargeback_amount,
      chargeback_reason,
      chargeback_category = 'FRAUD',
      customer_statement = null,
      response_due_date,
      notification_data = {}
    } = body;

    // Validate required fields
    if (!pg_case_id || !chargeback_amount || !response_due_date) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        required: ['pg_case_id', 'chargeback_amount', 'response_due_date']
      }, { status: 400 });
    }

    // Find payment by gateway_payment_id or payment_id
    const { data: payment } = await supabase
      .from('payment_transactions')
      .select('*, invoice:invoices!inner(*, lead:service_leads!inner(*))')
      .or(`id.eq.${payment_id},gateway_payment_id.eq.${gateway_payment_id}`)
      .single();

    if (!payment) {
      return NextResponse.json({ 
        error: 'Payment not found',
        searched_for: { payment_id, gateway_payment_id }
      }, { status: 404 });
    }

    const invoice = payment.invoice as any;
    const lead = invoice.lead as any;

    // Check if chargeback case already exists
    const { data: existingCase } = await supabase
      .from('chargeback_cases')
      .select('*')
      .eq('pg_case_id', pg_case_id)
      .maybeSingle();

    if (existingCase) {
      return NextResponse.json({
        success: true,
        message: 'Chargeback case already exists',
        case_id: existingCase.id,
        already_exists: true
      });
    }

    // Auto-collect evidence
    const autoEvidence = await supabase.rpc('auto_collect_chargeback_evidence', {
      p_chargeback_id: '00000000-0000-0000-0000-000000000000' // Placeholder, will set after insert
    });

    // Create chargeback case
    const { data: chargebackCase, error: caseError } = await supabase
      .from('chargeback_cases')
      .insert({
        payment_id: payment.id,
        invoice_id: invoice.id,
        lead_id: lead.id,
        chargeback_amount: parseFloat(chargeback_amount),
        chargeback_reason,
        chargeback_category,
        pg_case_id,
        pg_chargeback_id,
        pg_provider,
        pg_notification_data: notification_data,
        pg_notification_received_at: new Date().toISOString(),
        status: 'RECEIVED',
        response_due_date,
        customer_name: lead.customer_name,
        customer_email: lead.customer_email,
        customer_phone: lead.customer_phone,
        customer_statement,
        workshop_id: lead.workshop_id,
        priority: parseFloat(chargeback_amount) > 10000 ? 'CRITICAL' : 'HIGH',
        evidence: autoEvidence || []
      })
      .select()
      .single();

    if (caseError) {
      console.error('Error creating chargeback case:', caseError);
      return NextResponse.json({ 
        error: 'Failed to create chargeback case',
        details: caseError.message
      }, { status: 500 });
    }

    // TODO: Notify relevant team (Finance, Super Admin)
    // TODO: Create task for evidence submission

    return NextResponse.json({
      success: true,
      message: 'Chargeback case created',
      case: {
        id: chargebackCase.id,
        pg_case_id: chargebackCase.pg_case_id,
        amount: chargebackCase.chargeback_amount,
        response_due_date: chargebackCase.response_due_date,
        status: chargebackCase.status
      }
    });

  } catch (error: any) {
    console.error('Chargeback webhook error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

