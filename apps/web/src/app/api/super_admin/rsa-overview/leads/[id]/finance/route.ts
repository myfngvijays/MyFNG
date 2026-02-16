import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function assertSuperAdmin(supabase: any) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();
  if (roleError || !userData) {
    return { ok: false, status: 403, error: 'Forbidden - Role check failed' };
  }

  const roleCode = String((userData as any).roles?.role_code || '').trim();
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden - Not super admin' };
  }
  return { ok: true, status: 200, error: null };
}

function toNullableNumber(value: any) {
  if (value === '' || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : NaN;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const auth = await assertSuperAdmin(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const leadId = String(id || '').trim();
    if (!leadId) {
      return NextResponse.json({ error: 'Lead id is required' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const quoted = toNullableNumber((body as any)?.customer_quoted_amount);
    const mechanic = toNullableNumber((body as any)?.payment_to_mechanic);
    const advanceRaw = (body as any)?.advance_payment;
    const advance =
      advanceRaw === '' || advanceRaw === null || advanceRaw === undefined ? null : String(advanceRaw).trim();

    if (Number.isNaN(quoted) || Number.isNaN(mechanic)) {
      return NextResponse.json({ error: 'Quoted and mechanic must be valid numbers' }, { status: 400 });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }
    const db = supabaseAdmin as any;

    const { data, error } = await db
      .from('rsa_leads')
      .update({
        customer_quoted_amount: quoted,
        advance_payment: advance,
        payment_to_mechanic: mechanic,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId)
      .eq('delete_status', false)
      .select('id, customer_quoted_amount, advance_payment, payment_to_mechanic')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Failed to update lead finance', details: error.message }, { status: 500 });
    }
    if (!data?.id) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, lead: data });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}
