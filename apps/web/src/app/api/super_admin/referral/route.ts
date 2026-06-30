import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { getWalletLogicSettings, saveWalletLogicSettings } from '@/lib/wallet-config';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function assertSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false as const, status: 401, error: 'Unauthorized', user: null };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  if (roleError || !userData) {
    return { ok: false as const, status: 403, error: 'Forbidden - Role check failed', user: null };
  }

  const roleCode = (userData as any).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden - Not super admin', user: null };
  }

  return { ok: true as const, status: 200, error: null, user };
}

export async function GET() {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    const settings = await getWalletLogicSettings(supabaseAdmin);

    const { count: totalEvents } = await supabaseAdmin
      .from('referral_events')
      .select('id', { count: 'exact', head: true });

    const { count: rewardedEvents } = await supabaseAdmin
      .from('referral_events')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'REWARDED');

    const { count: pendingEvents } = await supabaseAdmin
      .from('referral_events')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'PENDING');

    const { count: rejectedEvents } = await supabaseAdmin
      .from('referral_events')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'REJECTED');

    const { data: recentEvents } = await supabaseAdmin
      .from('referral_events')
      .select('*, referrer:referrer_customer_id(id, full_name, phone), referee:referee_customer_id(id, full_name, phone)')
      .order('created_at', { ascending: false })
      .limit(20);

    const { data: totalRewards } = await supabaseAdmin
      .from('referral_rewards')
      .select('reward_amount')
      .eq('status', 'CREDITED');

    const totalRewardsPaid = (totalRewards || []).reduce((sum: number, r: any) => sum + Number(r.reward_amount || 0), 0);

    const { data: tncRow } = await supabaseAdmin
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'referral_tnc')
      .maybeSingle();

    const referralTnc = tncRow?.setting_value ? (() => { try { return JSON.parse(tncRow.setting_value); } catch { return null; } })() : null;

    return NextResponse.json({
      success: true,
      config: {
        referral_first_reward: settings.referral_first_reward,
        referral_repeat_reward: settings.referral_repeat_reward,
        referral_friend_bonus: settings.referral_friend_bonus,
        referral_expiry_days: settings.referral_expiry_days,
        referral_tnc: referralTnc,
      },
      stats: {
        total_referrals: totalEvents || 0,
        rewarded: rewardedEvents || 0,
        pending: pendingEvents || 0,
        rejected: rejectedEvents || 0,
        total_rewards_paid: totalRewardsPaid,
      },
      recent_events: recentEvents || [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { supabaseAdmin } = getSupabaseAdmin();
    const settings = await getWalletLogicSettings(supabaseAdmin);

    if (body.referral_first_reward !== undefined) {
      settings.referral_first_reward = Number(body.referral_first_reward);
    }
    if (body.referral_repeat_reward !== undefined) {
      settings.referral_repeat_reward = Number(body.referral_repeat_reward);
    }
    if (body.referral_friend_bonus !== undefined) {
      settings.referral_friend_bonus = Number(body.referral_friend_bonus);
    }
    if (body.referral_expiry_days !== undefined) {
      settings.referral_expiry_days = Number(body.referral_expiry_days);
    }

    await saveWalletLogicSettings(supabaseAdmin, settings, auth.user?.id || null);

    if (Array.isArray(body.referral_tnc)) {
      const tncJson = JSON.stringify(body.referral_tnc.filter((t: any) => String(t || '').trim()));
      await supabaseAdmin.from('system_settings').upsert(
        {
          setting_key: 'referral_tnc',
          setting_value: tncJson,
          setting_type: 'JSON',
          category: 'REFERRAL',
          is_editable: true,
          updated_by: auth.user?.id || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'setting_key' },
      );
    }

    const savedTnc = Array.isArray(body.referral_tnc) ? body.referral_tnc.filter((t: any) => String(t || '').trim()) : null;

    return NextResponse.json({
      success: true,
      config: {
        referral_first_reward: settings.referral_first_reward,
        referral_repeat_reward: settings.referral_repeat_reward,
        referral_friend_bonus: settings.referral_friend_bonus,
        referral_expiry_days: settings.referral_expiry_days,
        referral_tnc: savedTnc,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
