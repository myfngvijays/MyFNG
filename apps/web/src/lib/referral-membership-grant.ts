import 'server-only';
import { adminActivateCustomerMembership } from '@/lib/membership-admin';
import { isReferralMembershipReward, parseMembershipMonthsFromReward } from '@/lib/refer-and-rise';

export type ReferralMembershipGrantResult = {
  ok: boolean;
  membershipId?: string;
  planName?: string;
  error?: string;
};

async function resolveReferralMembershipPlan(supabaseAdmin: any, rewardText: string) {
  const text = String(rewardText || '');
  const isBlack = /black membership|elite black|express black/i.test(text);
  const isRsa = /rsa|roadside/i.test(text);

  let query = supabaseAdmin
    .from('membership_plans')
    .select('id, name, code, duration_days, membership_type')
    .eq('active', true);

  if (isRsa) {
    query = query.eq('membership_type', 'RSA');
  } else {
    query = query.eq('membership_type', 'SERVICE');
  }

  if (isBlack) {
    query = query.or('code.ilike.%ELITE%,code.ilike.%BLACK%,name.ilike.%Black%');
  } else if (/prime/i.test(text)) {
    query = query.or('code.eq.PRIME,code.ilike.PRIME%');
  }

  const { data: plans } = await query.order('created_at', { ascending: true }).limit(5);
  if (plans?.length) return plans[0];

  const { data: fallback } = await supabaseAdmin
    .from('membership_plans')
    .select('id, name, code, duration_days, membership_type')
    .eq('active', true)
    .eq('membership_type', isRsa ? 'RSA' : 'SERVICE')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return fallback;
}

export async function grantReferralMembershipReward(
  supabaseAdmin: any,
  customerId: string,
  rewardText: string,
  claimId: string,
): Promise<ReferralMembershipGrantResult> {
  if (!isReferralMembershipReward(rewardText)) {
    return { ok: false, error: 'Not a membership reward' };
  }

  const plan = await resolveReferralMembershipPlan(supabaseAdmin, rewardText);
  if (!plan?.id) {
    return { ok: false, error: 'No active membership plan found for this reward' };
  }

  const months = parseMembershipMonthsFromReward(rewardText);
  const isLifetime = /lifetime|black membership/i.test(rewardText);
  const startsAt = new Date();
  const durationDays = isLifetime
    ? Math.max(Number(plan.duration_days || 365) * 10, 3650)
    : months
      ? months * 30
      : Number(plan.duration_days || 365);
  const endsAt = new Date(startsAt.getTime() + durationDays * 24 * 60 * 60 * 1000);

  const activated = await adminActivateCustomerMembership(supabaseAdmin, {
    customerId,
    planId: String(plan.id),
    notes: `Refer & Rise reward · claim ${claimId} · ${rewardText}`,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  });

  if (!activated.ok) {
    return { ok: false, error: activated.error || 'Membership activation failed' };
  }

  const membershipId = String(activated.membership?.id || '');

  if (membershipId) {
    await supabaseAdmin
      .from('customer_memberships')
      .update({ source: 'REFERRAL_REWARD', updated_at: new Date().toISOString() })
      .eq('id', membershipId);
  }

  return {
    ok: true,
    membershipId: membershipId || undefined,
    planName: String(plan.name || plan.code || 'Membership'),
  };
}
