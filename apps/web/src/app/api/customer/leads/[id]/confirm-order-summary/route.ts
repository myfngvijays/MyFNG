import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/customer/leads/[id]/confirm-order-summary
 *
 * Customer confirms Order Summary, making Customer Invoice visible and payable.
 * (Customer Invoice itself is created during billing finalization.)
 */
export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const leadId = params.id;

    // Fetch lead
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('id, customer_email, customer_phone, status, read_only')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if ((lead as any).read_only) {
      return NextResponse.json({ error: 'Lead is archived/read-only' }, { status: 400 });
    }

    const sessionEmail = (user.email || '').trim().toLowerCase();
    const sessionPhone = (user.phone || '').trim();
    const leadEmail = ((lead as any).customer_email || '').trim().toLowerCase();
    const leadPhone = ((lead as any).customer_phone || '').trim();

    // Allow if email OR phone matches (best-effort)
    const isOwner =
      (!!sessionEmail && !!leadEmail && sessionEmail === leadEmail) ||
      (!!sessionPhone && !!leadPhone && sessionPhone === leadPhone);

    if (!isOwner) {
      return NextResponse.json(
        { error: 'Forbidden', hint: 'This lead does not belong to the current customer session' },
        { status: 403 }
      );
    }

    // Find customer invoice
    const { data: ci, error: ciErr } = await supabase
      .from('invoices')
      .select('id, invoice_number, invoice_type, visible_to_customer, payment_status, status')
      .eq('lead_id', leadId)
      .eq('invoice_type', 'CUSTOMER_INVOICE')
      .maybeSingle();

    if (ciErr || !ci) {
      return NextResponse.json(
        {
          error: 'Customer invoice not ready yet',
          hint: 'Billing team must finalize the bill first',
        },
        { status: 400 }
      );
    }

    if (ci.payment_status === 'PAID') {
      return NextResponse.json({ error: 'Invoice already paid', invoice_id: ci.id }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Make CI visible + payable
    await supabase
      .from('invoices')
      .update({
        visible_to_customer: true,
        status: ci.status === 'APPROVED' ? 'AWAITING_PAYMENT' : ci.status,
        updated_at: now,
      })
      .eq('id', ci.id);

    // Keep lead in PAYMENT_AWAITING (or existing AWAITING_PAYMENT if older flow)
    if (!['PAYMENT_AWAITING', 'AWAITING_PAYMENT'].includes((lead as any).status)) {
      await supabase
        .from('service_leads')
        .update({ status: 'PAYMENT_AWAITING', updated_at: now })
        .eq('id', leadId);
    }

    // Activity log (best-effort)
    try {
      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        user_id: user.id,
        activity_type: 'CUSTOMER_CONFIRMED_ORDER_SUMMARY',
        description: 'Customer confirmed order summary',
        metadata: { customer_invoice_id: ci.id, customer_invoice_number: ci.invoice_number },
      });
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      message: 'Order summary confirmed. Customer invoice is now available for payment.',
      customer_invoice: {
        id: ci.id,
        invoice_number: ci.invoice_number,
      },
    });
  } catch (error: any) {
    console.error('Confirm order summary error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}


