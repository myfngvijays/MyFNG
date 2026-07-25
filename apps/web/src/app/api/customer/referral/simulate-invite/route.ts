import { NextRequest, NextResponse } from 'next/server';
import { logCustomerEvent, requireCustomer } from '@/lib/customer-api';
import { isReferralTestReferrerPhone } from '@/lib/refer-and-rise';
import { simulateReferralInvite } from '@/lib/referral-test-simulate';

export const dynamic = 'force-dynamic';

/**
 * QA-only: instantly count an invite as a completed referral for test referrer phones.
 */
export async function POST(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;

  if (!isReferralTestReferrerPhone(customer.phone)) {
    return NextResponse.json({ error: 'Not enabled for this account' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const friendName = String(body.friend_name || body.friendName || '').trim() || undefined;
  const friendPhone = String(body.friend_phone || body.friendPhone || '').trim() || undefined;

  let referralCode = String(body.referral_code || '').trim().toUpperCase();
  if (!referralCode) {
    const { data: codeRow } = await supabaseAdmin
      .from('referral_codes')
      .select('code')
      .eq('customer_id', customer.id)
      .maybeSingle();
    referralCode = String(codeRow?.code || '').trim().toUpperCase();
  }
  if (!referralCode) {
    return NextResponse.json({ error: 'Referral code not found' }, { status: 400 });
  }

  try {
    const result = await simulateReferralInvite(supabaseAdmin, {
      referrerCustomerId: customer.id,
      referralCode,
      friendName,
      friendPhone,
      referrerPhone: customer.phone,
    });

    await logCustomerEvent(supabaseAdmin, customer.id, 'referral_test_simulated', 'referral', {
      friend_name: friendName || null,
      friend_phone: friendPhone || null,
      reward_amount: result.reward_amount,
    });

    return NextResponse.json({
      success: true,
      test_mode: true,
      stats: result.stats,
      reward_amount: result.reward_amount,
      referee: {
        name: result.referee.full_name,
        phone: result.referee.phone,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to simulate referral' }, { status: 500 });
  }
}
