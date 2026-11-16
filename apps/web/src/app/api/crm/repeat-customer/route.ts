import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getRequestUser } from '@/lib/supabase/requestUser';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { attachRepeatCustomerFlags } from '@/lib/crm/repeatCustomer';

export const dynamic = 'force-dynamic';

/** Repeat Customer tag for one lead. Used by telecaller and admin lead detail. */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const auth = await getRequestUser(supabase, request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const leadId = String(request.nextUrl.searchParams.get('lead_id') || '').trim();
    if (!leadId) return NextResponse.json({ error: 'lead_id is required' }, { status: 400 });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });

    const { data, error } = await supabaseAdmin
      .from('service_leads')
      .select('id, customer_phone, created_at, status, meta, completed_at, coupon_meta, problem_description, vehicle_number')
      .eq('id', leadId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ repeat_customer: false, repeat_remark: null });

    const [flagged] = await attachRepeatCustomerFlags(supabaseAdmin, [data]);
    return NextResponse.json({
      repeat_customer: Boolean(flagged?.repeat_customer),
      repeat_remark: flagged?.repeat_remark || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
