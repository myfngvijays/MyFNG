import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { isReferralTestDummyCustomer } from '@/lib/customer-insights-admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * DELETE dummy "Test Friend" customers created by Refer & Rise simulate-invite.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();
    const roleCode = (userData as any)?.roles?.role_code;
    if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const { data: named } = await supabaseAdmin
      .from('customers')
      .select('id, phone, full_name, phone_verified')
      .ilike('full_name', 'Test Friend')
      .limit(5000);

    const dummyIds = new Set<string>();
    for (const c of named || []) {
      if (isReferralTestDummyCustomer(c)) dummyIds.add(String(c.id));
    }

    const { data: testEvents } = await supabaseAdmin
      .from('referral_events')
      .select('id, referee_customer_id, anti_fraud_flags')
      .contains('anti_fraud_flags', ['test_simulate'])
      .limit(5000);

    const eventIds = new Set<string>();
    for (const ev of testEvents || []) {
      if (ev.id) eventIds.add(String(ev.id));
      if (ev.referee_customer_id) dummyIds.add(String(ev.referee_customer_id));
    }

    // Events whose referee is a Test Friend (even if flag missing)
    if (dummyIds.size) {
      const { data: moreEvents } = await supabaseAdmin
        .from('referral_events')
        .select('id')
        .in('referee_customer_id', [...dummyIds])
        .limit(5000);
      for (const ev of moreEvents || []) {
        if (ev.id) eventIds.add(String(ev.id));
      }
    }

    const ids = [...dummyIds];
    const evIds = [...eventIds];
    let deletedCustomers = 0;

    if (evIds.length) {
      await supabaseAdmin.from('referral_rewards').delete().in('referral_event_id', evIds);
      await supabaseAdmin.from('referral_events').delete().in('id', evIds);
    }

    if (ids.length) {
      await supabaseAdmin.from('customer_sessions').delete().in('customer_id', ids);
      await supabaseAdmin.from('customer_notification_preferences').delete().in('customer_id', ids);
      await supabaseAdmin.from('notification_devices').delete().in('customer_id', ids);
      await supabaseAdmin.from('wallet_transactions').delete().in('customer_id', ids);
      await supabaseAdmin.from('wallet_accounts').delete().in('customer_id', ids);
      await supabaseAdmin.from('customer_analytics_events').delete().in('customer_id', ids);
      const { error: delErr, count } = await supabaseAdmin
        .from('customers')
        .delete({ count: 'exact' })
        .in('id', ids);
      if (delErr) {
        return NextResponse.json(
          { error: delErr.message || 'Failed to delete test customers' },
          { status: 400 },
        );
      }
      deletedCustomers = count || ids.length;
    }

    return NextResponse.json({
      success: true,
      deleted_customers: deletedCustomers,
      deleted_referral_events: evIds.length,
      message:
        deletedCustomers > 0
          ? `Removed ${deletedCustomers} Test Friend dummy customer(s).`
          : 'No Test Friend dummies found.',
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
