import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/invoices/[id]/internal-approve
 * Optional internal review for Tax Invoice (post-payment).
 * Sets invoice_approved flag and stores checklist snapshot in invoice_reviews.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invoiceId = params.id;
    const body = await request.json().catch(() => ({}));
    const { checklist_data = {}, review_notes = '' } = body || {};

    // Role check via users_login.roles join (best-effort)
    const { data: userProfile } = await supabase
      .from('users_login')
      .select('id, role_id, roles!inner(role_code)')
      .eq('id', user.id)
      .maybeSingle();

    const roleCode = (userProfile?.roles as any)?.role_code;
    const allowedRoles = ['SUPER_ADMIN', 'SUB_ADMIN', 'FINANCE_MANAGER', 'BILLING_SPECIALIST', 'BILLING'];
    if (!allowedRoles.includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden', role: roleCode }, { status: 403 });
    }

    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('id, invoice_number, invoice_type, invoice_approved, lead_id')
      .eq('id', invoiceId)
      .single();

    if (invErr || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if ((invoice as any).invoice_type !== 'TAX_INVOICE') {
      return NextResponse.json(
        { error: 'Only Tax Invoice can be internally approved', invoice_type: (invoice as any).invoice_type },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    await supabase
      .from('invoices')
      .update({
        invoice_approved: true,
        invoice_approved_by: user.id,
        invoice_approved_at: now,
        updated_at: now,
      })
      .eq('id', invoiceId);

    // Record review snapshot (best-effort)
    try {
      await supabase.from('invoice_reviews').insert({
        invoice_id: invoiceId,
        reviewed_by: user.id,
        review_status: 'APPROVED',
        review_notes: review_notes || 'Internal invoice review approved',
        reviewed_at: now,
        checklist_data,
        review_stage: 'INTERNAL_TAX_INVOICE',
      });
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      message: 'Tax invoice internally approved',
      invoice_id: invoiceId,
      invoice_number: (invoice as any).invoice_number,
    });
  } catch (error: any) {
    console.error('Internal invoice approve error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}


