import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userData } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();
  const roleCode = (userData as any)?.roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }
  return { ok: true as const, status: 200, error: null };
}

/**
 * POST { ids: string[] } — permanently delete selected app customers.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await assertAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids)
      ? [...new Set(body.ids.map((id: unknown) => String(id || '').trim()).filter(Boolean))]
      : [];

    if (!ids.length) {
      return NextResponse.json({ error: 'Select at least one customer' }, { status: 400 });
    }
    if (ids.length > 200) {
      return NextResponse.json({ error: 'Max 200 customers per delete' }, { status: 400 });
    }

    const [asReferee, asReferrer] = await Promise.all([
      supabaseAdmin.from('referral_events').select('id').in('referee_customer_id', ids).limit(5000),
      supabaseAdmin.from('referral_events').select('id').in('referrer_customer_id', ids).limit(5000),
    ]);

    const eventIds = [
      ...new Set(
        [...(asReferee.data || []), ...(asReferrer.data || [])]
          .map((e: any) => String(e.id || ''))
          .filter(Boolean),
      ),
    ];

    if (eventIds.length) {
      await supabaseAdmin.from('referral_rewards').delete().in('referral_event_id', eventIds);
      await supabaseAdmin.from('referral_events').delete().in('id', eventIds);
    }

    // Best-effort related cleanup (some tables cascade from customers)
    const relatedDeletes = [
      supabaseAdmin.from('customer_sessions').delete().in('customer_id', ids),
      supabaseAdmin.from('customer_notification_preferences').delete().in('customer_id', ids),
      supabaseAdmin.from('notification_devices').delete().in('customer_id', ids),
      supabaseAdmin.from('wallet_transactions').delete().in('customer_id', ids),
      supabaseAdmin.from('wallet_accounts').delete().in('customer_id', ids),
      supabaseAdmin.from('customer_analytics_events').delete().in('customer_id', ids),
      supabaseAdmin.from('customer_vehicles').delete().in('customer_id', ids),
      supabaseAdmin.from('customer_addresses').delete().in('customer_id', ids),
      supabaseAdmin.from('customer_coupon_assignments').delete().in('customer_id', ids),
      supabaseAdmin.from('customer_memberships').delete().in('customer_id', ids),
      supabaseAdmin.from('referral_codes').delete().in('customer_id', ids),
    ];
    await Promise.allSettled(relatedDeletes);

    const { error: delErr, count } = await supabaseAdmin
      .from('customers')
      .delete({ count: 'exact' })
      .in('id', ids);

    if (delErr) {
      return NextResponse.json(
        { error: delErr.message || 'Failed to delete customers' },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      deleted: count ?? ids.length,
      message: `Deleted ${count ?? ids.length} customer(s).`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
