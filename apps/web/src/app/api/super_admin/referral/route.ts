import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { getWalletLogicSettings, saveWalletLogicSettings } from '@/lib/wallet-config';
import { DEFAULT_REFER_AND_RISE_CONFIG, normalizeReferAndRiseConfig } from '@/lib/refer-and-rise';
import { loadCrmManualReferences } from '@/lib/crm-manual-references';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function assertReferralViewer() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false as const, status: 401, error: 'Unauthorized', user: null, roleCode: null };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  if (roleError || !userData) {
    return { ok: false as const, status: 403, error: 'Forbidden - Role check failed', user: null, roleCode: null };
  }

  const roleCode = (userData as any).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN', 'LEAD_MANAGER', 'APP_OPERATIONS'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden - Not super admin', user: null, roleCode: null };
  }

  return { ok: true as const, status: 200, error: null, user, roleCode };
}

/** Config edits — Super Admin only. */
async function assertReferralEditor() {
  const auth = await assertReferralViewer();
  if (!auth.ok) return auth;
  if (auth.roleCode !== 'SUPER_ADMIN') {
    return { ok: false as const, status: 403, error: 'Forbidden - Super Admin only', user: auth.user, roleCode: auth.roleCode };
  }
  return auth;
}

export async function GET() {
  try {
    const auth = await assertReferralViewer();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client unavailable' }, { status: 500 });
    }

    const analyticsOnly = auth.roleCode === 'LEAD_MANAGER';

    const [
      settings,
      eventsRes,
      rewardsRes,
      settingsRows,
      totalCountRes,
      rewardedCountRes,
      pendingCountRes,
      rejectedCountRes,
    ] = await Promise.all([
      analyticsOnly ? Promise.resolve(null) : getWalletLogicSettings(supabaseAdmin),
      supabaseAdmin
        .from('referral_events')
        .select(
          'id, status, created_at, referrer_customer_id, referee_customer_id, referral_code, referrer:referrer_customer_id(id, full_name, phone), referee:referee_customer_id(id, full_name, phone)',
        )
        .order('created_at', { ascending: false })
        .limit(2000),
      supabaseAdmin
        .from('referral_rewards')
        .select('customer_id, reward_amount')
        .eq('status', 'CREDITED')
        .limit(5000),
      analyticsOnly
        ? Promise.resolve({ data: [] as { setting_key: string; setting_value: string }[] })
        : supabaseAdmin
            .from('system_settings')
            .select('setting_key, setting_value')
            .in('setting_key', ['referral_tnc', 'refer_and_rise_config']),
      supabaseAdmin.from('referral_events').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('referral_events').select('id', { count: 'exact', head: true }).eq('status', 'REWARDED'),
      supabaseAdmin.from('referral_events').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
      supabaseAdmin.from('referral_events').select('id', { count: 'exact', head: true }).eq('status', 'REJECTED'),
    ]);

    const allEvents = eventsRes.data || [];
    const totalEvents = totalCountRes.count ?? allEvents.length;
    const rewardedEvents = rewardedCountRes.count ?? allEvents.filter((e: any) => e.status === 'REWARDED').length;
    const pendingEvents = pendingCountRes.count ?? allEvents.filter((e: any) => e.status === 'PENDING').length;
    const rejectedEvents = rejectedCountRes.count ?? allEvents.filter((e: any) => e.status === 'REJECTED').length;
    const recentEvents = allEvents.slice(0, 20);

    const totalRewardsPaid = (rewardsRes.data || []).reduce(
      (sum: number, r: any) => sum + Number(r.reward_amount || 0),
      0,
    );

    const tncRow = (settingsRows.data || []).find((r: any) => r.setting_key === 'referral_tnc');
    const riseRow = (settingsRows.data || []).find((r: any) => r.setting_key === 'refer_and_rise_config');
    const referralTnc = tncRow?.setting_value
      ? (() => {
          try {
            return JSON.parse(tncRow.setting_value);
          } catch {
            return null;
          }
        })()
      : null;

    let rawRiseConfig: unknown = null;
    if (riseRow?.setting_value) {
      try {
        rawRiseConfig = JSON.parse(riseRow.setting_value);
      } catch {
        rawRiseConfig = null;
      }
    }

    const referAndRiseConfig = analyticsOnly
      ? DEFAULT_REFER_AND_RISE_CONFIG
      : normalizeReferAndRiseConfig(rawRiseConfig);
    const referAndRiseConfigForAdmin = {
      ...referAndRiseConfig,
      friendBonus: settings?.referral_friend_bonus ?? referAndRiseConfig.friendBonus ?? 500,
      expiryDays: settings?.referral_expiry_days ?? referAndRiseConfig.expiryDays ?? 90,
    };

    const byReferrer = new Map<
      string,
      { total: number; rewarded: number; pending: number; referees: any[] }
    >();
    for (const ev of allEvents) {
      const rid = String(ev.referrer_customer_id || '').trim();
      if (!rid) continue;
      const row = byReferrer.get(rid) || { total: 0, rewarded: 0, pending: 0, referees: [] };
      row.total += 1;
      if (ev.status === 'REWARDED') row.rewarded += 1;
      if (ev.status === 'PENDING') row.pending += 1;
      if (row.referees.length < 20) {
        row.referees.push({
          event_id: ev.id,
          full_name: ev.referee?.full_name || '',
          phone: ev.referee?.phone || '',
          status: ev.status,
          created_at: ev.created_at,
        });
      }
      byReferrer.set(rid, row);
    }

    const earnedByCustomer = new Map<string, number>();
    for (const r of rewardsRes.data || []) {
      const cid = String(r.customer_id || '').trim();
      if (!cid) continue;
      earnedByCustomer.set(cid, (earnedByCustomer.get(cid) || 0) + Number(r.reward_amount || 0));
    }

    const topIds = [...byReferrer.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 50)
      .map(([id]) => id);

    let leaderboard: any[] = [];
    if (topIds.length > 0) {
      const { data: referralCodes } = await supabaseAdmin
        .from('referral_codes')
        .select('customer_id, code, customers!inner(full_name, phone)')
        .in('customer_id', topIds);

      const codeById = new Map(
        (referralCodes || []).map((rc: any) => [String(rc.customer_id), rc]),
      );

      leaderboard = topIds.map((id) => {
        const agg = byReferrer.get(id)!;
        const rc = codeById.get(id);
        const fromEvent = allEvents.find((e: any) => String(e.referrer_customer_id) === id)?.referrer;
        return {
          customer_id: id,
          full_name: rc?.customers?.full_name || fromEvent?.full_name || '',
          phone: rc?.customers?.phone || fromEvent?.phone || '',
          referral_code: rc?.code || '',
          total_referrals: agg.total,
          rewarded: agg.rewarded,
          pending: agg.pending,
          total_earned: earnedByCustomer.get(id) || 0,
          referees: agg.referees,
        };
      });
    }

    const manualReferences = await loadCrmManualReferences(supabaseAdmin, { limit: 80 });

    return NextResponse.json({
      success: true,
      can_edit: auth.roleCode === 'SUPER_ADMIN',
      config: {
        referral_first_reward: settings?.referral_first_reward ?? 500,
        referral_repeat_reward: settings?.referral_repeat_reward ?? 250,
        referral_friend_bonus: settings?.referral_friend_bonus ?? 500,
        referral_expiry_days: settings?.referral_expiry_days ?? 90,
        referral_tnc: referralTnc,
      },
      refer_and_rise_config: referAndRiseConfigForAdmin,
      leaderboard,
      recent_claims: [] as any[],
      stats: {
        total_referrals: totalEvents || 0,
        rewarded: rewardedEvents || 0,
        pending: pendingEvents || 0,
        rejected: rejectedEvents || 0,
        total_rewards_paid: totalRewardsPaid,
        manual_references: manualReferences.length,
      },
      recent_events: recentEvents || [],
      manual_references: manualReferences,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await assertReferralEditor();
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

    // Save Refer & Rise config
    if (body.refer_and_rise_config) {
      const normalized = normalizeReferAndRiseConfig(body.refer_and_rise_config);

      if (normalized.friendBonus !== undefined) {
        settings.referral_friend_bonus = Number(normalized.friendBonus);
      }
      if (normalized.expiryDays !== undefined) {
        settings.referral_expiry_days = Number(normalized.expiryDays);
      }
      if (body.referral_friend_bonus !== undefined) {
        settings.referral_friend_bonus = Number(body.referral_friend_bonus);
      }
      if (body.referral_expiry_days !== undefined) {
        settings.referral_expiry_days = Number(body.referral_expiry_days);
      }

      await saveWalletLogicSettings(supabaseAdmin, settings, auth.user?.id || null);

      const configToSave = {
        ...normalized,
        friendBonus: settings.referral_friend_bonus,
        expiryDays: settings.referral_expiry_days,
      };
      const riseJson = JSON.stringify(configToSave);
      await supabaseAdmin.from('system_settings').upsert(
        {
          setting_key: 'refer_and_rise_config',
          setting_value: riseJson,
          setting_type: 'JSON',
          category: 'REFERRAL',
          is_editable: true,
          updated_by: auth.user?.id || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'setting_key' },
      );

      const tncItems = Array.isArray(configToSave.content?.tnc)
        ? configToSave.content.tnc.filter((t: unknown) => String(t || '').trim())
        : null;
      if (tncItems) {
        await supabaseAdmin.from('system_settings').upsert(
          {
            setting_key: 'referral_tnc',
            setting_value: JSON.stringify(tncItems),
            setting_type: 'JSON',
            category: 'REFERRAL',
            is_editable: true,
            updated_by: auth.user?.id || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'setting_key' },
        );
      }

      return NextResponse.json({
        success: true,
        can_edit: true,
        refer_and_rise_config: configToSave,
        config: {
          referral_first_reward: settings.referral_first_reward,
          referral_repeat_reward: settings.referral_repeat_reward,
          referral_friend_bonus: settings.referral_friend_bonus,
          referral_expiry_days: settings.referral_expiry_days,
          referral_tnc: tncItems,
        },
      });
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
