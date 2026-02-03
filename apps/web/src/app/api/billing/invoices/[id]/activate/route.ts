import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/**
 * POST /api/billing/invoices/[id]/activate
 * Supervisor/Admin activates a CUSTOMER_INVOICE for customer visibility and payment.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Robust profile lookup (email/phone/id) + role_code
    const email = (user.email || '').trim();
    const phone = (user.phone || '').trim();
    const selectProfile = 'id, email, phone, workshop_id, full_name, roles!inner(role_code)';

    const { data: byEmail } = email
      ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
      : { data: null };
    const { data: byPhone } = !byEmail && phone
      ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
      : { data: null };
    const { data: byId } = !byEmail && !byPhone
      ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
      : { data: null };

    const userProfile: any = byEmail || byPhone || byId;
    const roleCode = (userProfile?.roles as any)?.role_code;
    const allowed = ['SUPER_ADMIN', 'SUB_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'];
    if (!allowed.includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden', role: roleCode }, { status: 403 });
    }

    const { id: invoiceId } = await params;
    if (!invoiceId || !isUuid(String(invoiceId))) {
      return NextResponse.json({ error: 'Invalid invoice id' }, { status: 400 });
    }

    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('id, lead_id, workshop_id, invoice_type, visible_to_customer, status, invoice_number')
      .eq('id', invoiceId)
      .single();

    if (invErr || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if ((invoice as any).invoice_type !== 'CUSTOMER_INVOICE') {
      return NextResponse.json(
        { error: 'Only Customer Invoice can be activated', invoice_type: (invoice as any).invoice_type },
        { status: 400 }
      );
    }

    // Workshop scoping for workshop staff
    if (['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'].includes(roleCode)) {
      if (!userProfile?.workshop_id || userProfile.workshop_id !== (invoice as any).workshop_id) {
        return NextResponse.json({ error: 'Forbidden: Invoice not in your workshop' }, { status: 403 });
      }
    }

    const now = new Date().toISOString();
    await supabase
      .from('invoices')
      .update({
        visible_to_customer: true,
        status: (invoice as any).status === 'APPROVED' ? 'AWAITING_PAYMENT' : (invoice as any).status,
        updated_at: now,
      })
      .eq('id', invoiceId);

    // Keep lead in PAYMENT_AWAITING if not already
    if ((invoice as any).lead_id) {
      await supabase
        .from('service_leads')
        .update({
          status: 'PAYMENT_AWAITING',
          invoice_id: invoiceId,
          invoice_number: (invoice as any).invoice_number,
          updated_at: now,
        })
        .eq('id', (invoice as any).lead_id);
    }

    return NextResponse.json({
      success: true,
      message: 'Customer invoice activated for payment',
      invoice_id: invoiceId,
      invoice_number: (invoice as any).invoice_number,
    });
  } catch (error: any) {
    console.error('Activate CI error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}


