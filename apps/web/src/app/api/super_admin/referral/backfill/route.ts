import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { maybeRewardReferrer } from '@/lib/referral-reward';

export const dynamic = 'force-dynamic';

/**
 * POST /api/super_admin/referral/backfill
 * Finds all PENDING referral events where the referee already has a PAID invoice,
 * and triggers the reward for the referrer.
 */
export async function POST() {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
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

    const { supabaseAdmin } = getSupabaseAdmin();

    // Get all PENDING referral events
    const { data: pendingEvents } = await supabaseAdmin
      .from('referral_events')
      .select('id, referrer_customer_id, referee_customer_id, referral_code, created_at')
      .eq('status', 'PENDING');

    if (!pendingEvents || pendingEvents.length === 0) {
      return NextResponse.json({ success: true, message: 'No pending referrals found', processed: 0 });
    }

    const results: any[] = [];

    for (const event of pendingEvents) {
      // Check if referee has a PAID invoice
      const { count: paidCount } = await supabaseAdmin
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', event.referee_customer_id)
        .eq('payment_status', 'PAID');

      if (paidCount && paidCount > 0) {
        // Trigger reward
        try {
          await maybeRewardReferrer(supabaseAdmin, event.referee_customer_id);
          results.push({
            event_id: event.id,
            referee_id: event.referee_customer_id,
            referrer_id: event.referrer_customer_id,
            status: 'REWARDED',
          });
        } catch (e: any) {
          results.push({
            event_id: event.id,
            referee_id: event.referee_customer_id,
            error: e?.message || 'Failed',
          });
        }
      } else {
        // Check if referee has a completed service lead (alternative)
        const { count: completedLeads } = await supabaseAdmin
          .from('service_leads')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', event.referee_customer_id)
          .in('status', ['PAID', 'DELIVERED', 'COMPLETED', 'CLOSED']);

        if (completedLeads && completedLeads > 0) {
          try {
            await maybeRewardReferrer(supabaseAdmin, event.referee_customer_id);
            results.push({
              event_id: event.id,
              referee_id: event.referee_customer_id,
              referrer_id: event.referrer_customer_id,
              status: 'REWARDED (via lead status)',
            });
          } catch (e: any) {
            results.push({
              event_id: event.id,
              referee_id: event.referee_customer_id,
              error: e?.message || 'Failed',
            });
          }
        } else {
          results.push({
            event_id: event.id,
            referee_id: event.referee_customer_id,
            status: 'STILL_PENDING (no paid invoice/completed lead)',
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      total_pending: pendingEvents.length,
      processed: results.filter((r) => r.status?.includes('REWARDED')).length,
      still_pending: results.filter((r) => r.status?.includes('STILL_PENDING')).length,
      results,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
