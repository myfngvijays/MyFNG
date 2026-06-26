import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { assertPushAdmin } from '@/lib/push/admin-auth';
import { MOBILE_PUSH_PLATFORM } from '@/lib/push/constants';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function startOfDayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export async function GET() {
  try {
    const auth = await assertPushAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const todayIso = startOfDayIso();
    const weekIso = daysAgoIso(7);

    const [
      devicesRes,
      customerDevicesRes,
      staffDevicesRes,
      legacyExpoRes,
      pushEnabledRes,
      pushDisabledRes,
      logsTodayRes,
      logsWeekRes,
      recentLogsRes,
      pushSettingRes,
      templatesRes,
    ] = await Promise.all([
      supabaseAdmin
        .from('notification_devices')
        .select('id', { count: 'exact', head: true })
        .eq('platform', MOBILE_PUSH_PLATFORM)
        .eq('is_active', true),
      supabaseAdmin
        .from('notification_devices')
        .select('id', { count: 'exact', head: true })
        .eq('platform', MOBILE_PUSH_PLATFORM)
        .eq('is_active', true)
        .not('customer_id', 'is', null),
      supabaseAdmin
        .from('notification_devices')
        .select('id', { count: 'exact', head: true })
        .eq('platform', MOBILE_PUSH_PLATFORM)
        .eq('is_active', true)
        .not('user_id', 'is', null),
      supabaseAdmin
        .from('notification_devices')
        .select('id', { count: 'exact', head: true })
        .eq('platform', 'EXPO')
        .eq('is_active', true),
      supabaseAdmin
        .from('customer_notification_preferences')
        .select('id', { count: 'exact', head: true })
        .eq('push_enabled', true),
      supabaseAdmin
        .from('customer_notification_preferences')
        .select('id', { count: 'exact', head: true })
        .eq('push_enabled', false),
      supabaseAdmin
        .from('notification_logs')
        .select('id, status, meta', { count: 'exact' })
        .eq('type', 'PUSH_BROADCAST')
        .gte('sent_at', todayIso),
      supabaseAdmin
        .from('notification_logs')
        .select('id, status, meta, sent_at')
        .eq('type', 'PUSH_BROADCAST')
        .gte('sent_at', weekIso)
        .order('sent_at', { ascending: true }),
      supabaseAdmin
        .from('notification_logs')
        .select('id, recipient, message, status, sent_at, meta')
        .eq('type', 'PUSH_BROADCAST')
        .order('sent_at', { ascending: false })
        .limit(5),
      supabaseAdmin
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'push_notifications_enabled')
        .maybeSingle(),
      supabaseAdmin
        .from('push_notification_templates')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true),
    ]);

    const weekLogs = logsWeekRes.data || [];
    const trendMap = new Map<string, { day: string; sent: number; failed: number }>();
    for (const log of weekLogs) {
      const day = new Date(log.sent_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      const row = trendMap.get(day) || { day, sent: 0, failed: 0 };
      if (log.status === 'SENT') row.sent += 1;
      else row.failed += 1;
      trendMap.set(day, row);
    }

    const todayLogs = logsTodayRes.data || [];
    const todaySent = todayLogs.filter((l) => l.status === 'SENT').length;
    const todayFailed = todayLogs.filter((l) => l.status !== 'SENT').length;
    const weekSent = weekLogs.filter((l) => l.status === 'SENT').length;
    const weekDevicesDelivered = weekLogs.reduce(
      (sum, l) => sum + Number((l.meta as { devices?: number } | null)?.devices || 0),
      0,
    );

    const roleBreakdown: Record<string, number> = {};
    for (const log of weekLogs) {
      const role = String(log.recipient || 'UNKNOWN');
      roleBreakdown[role] = (roleBreakdown[role] || 0) + 1;
    }

    const greetingHour = new Date().getHours();
    const greeting =
      greetingHour < 12 ? 'Good morning' : greetingHour < 17 ? 'Good afternoon' : 'Good evening';

    return NextResponse.json({
      admin: {
        name: auth.userName,
        role: auth.roleCode,
        greeting,
      },
      kpis: {
        active_devices: devicesRes.count || 0,
        customer_devices: customerDevicesRes.count || 0,
        staff_devices: staffDevicesRes.count || 0,
        legacy_expo_devices: legacyExpoRes.count || 0,
        customers_push_on: pushEnabledRes.count || 0,
        customers_push_off: pushDisabledRes.count || 0,
        broadcasts_today: logsTodayRes.count || 0,
        broadcasts_today_sent: todaySent,
        broadcasts_today_failed: todayFailed,
        broadcasts_week: weekLogs.length,
        broadcasts_week_sent: weekSent,
        devices_delivered_week: weekDevicesDelivered,
        active_templates:
          templatesRes.error && templatesRes.error.message?.includes('push_notification_templates')
            ? 3
            : templatesRes.count || 0,
        push_globally_enabled: pushSettingRes.data?.setting_value !== 'false',
      },
      trend_7d: Array.from(trendMap.values()),
      role_breakdown: roleBreakdown,
      recent_broadcasts: recentLogsRes.data || [],
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
