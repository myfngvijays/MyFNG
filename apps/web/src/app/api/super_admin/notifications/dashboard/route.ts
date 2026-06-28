import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { assertPushAdmin } from '@/lib/push/admin-auth';
import { MOBILE_PUSH_PLATFORM } from '@/lib/push/constants';
import { checkFcmCredentials } from '@/lib/push/fcmHealthCheck';
import { loadPushFirebaseConfig } from '@/lib/push/firebaseConfigStore';
import { PUSH_HISTORY_LOG_TYPES } from '@/lib/push/notificationLog';
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

function isIosDeviceName(name: string | null | undefined): boolean {
  const value = String(name || '').toLowerCase();
  return value.includes('ios') || value.includes('iphone') || value.includes('ipad');
}

function normalizeNotificationType(raw: unknown): string {
  const value = String(raw || 'general').trim().toLowerCase();
  if (!value) return 'general';
  return value;
}

function deliveryStatsFromMeta(meta: Record<string, unknown> | null | undefined) {
  const delivered = Number(meta?.devices || 0);
  const attempted = Number(meta?.devices_attempted || meta?.devices || 0);
  const failed = Math.max(0, attempted - delivered);
  return { delivered, attempted, failed };
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
      deviceNamesRes,
      customerDevicesRes,
      staffDevicesRes,
      legacyExpoRes,
      pushEnabledRes,
      pushDisabledRes,
      logsTodayRes,
      logsWeekRes,
      allBroadcastsRes,
      recentLogsRes,
      pushSettingRes,
      templatesRes,
      firebaseConfig,
      fcmHealth,
    ] = await Promise.all([
      supabaseAdmin
        .from('notification_devices')
        .select('id', { count: 'exact', head: true })
        .eq('platform', MOBILE_PUSH_PLATFORM)
        .eq('is_active', true),
      supabaseAdmin
        .from('notification_devices')
        .select('device_name')
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
        .in('type', [...PUSH_HISTORY_LOG_TYPES])
        .gte('sent_at', todayIso),
      supabaseAdmin
        .from('notification_logs')
        .select('id, status, meta, sent_at, recipient')
        .in('type', [...PUSH_HISTORY_LOG_TYPES])
        .gte('sent_at', weekIso)
        .order('sent_at', { ascending: true }),
      supabaseAdmin.from('notification_logs').select('status, meta').in('type', [...PUSH_HISTORY_LOG_TYPES]),
      supabaseAdmin
        .from('notification_logs')
        .select('id, recipient, message, status, sent_at, meta')
        .in('type', [...PUSH_HISTORY_LOG_TYPES])
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
      loadPushFirebaseConfig(),
      checkFcmCredentials(),
    ]);

    const deviceRows = deviceNamesRes.data || [];
    const iosDevices = deviceRows.filter((row) => isIosDeviceName(row.device_name)).length;
    const androidDevices = Math.max(0, deviceRows.length - iosDevices);

    const weekLogs = logsWeekRes.data || [];
    const allBroadcasts = allBroadcastsRes.data || [];

    let totalDelivered = 0;
    let totalFailedDeliveries = 0;
    for (const log of allBroadcasts) {
      const meta = (log.meta || {}) as Record<string, unknown>;
      const { delivered, failed } = deliveryStatsFromMeta(meta);
      if (log.status === 'SENT') {
        totalDelivered += delivered;
      }
      totalFailedDeliveries += failed;
      if (log.status === 'FCM_FAILED' || log.status === 'NO_DEVICES') {
        totalFailedDeliveries += 1;
      }
    }

    const totalCampaigns = allBroadcasts.length;
    const deliveryRate =
      totalDelivered + totalFailedDeliveries > 0
        ? Math.round((totalDelivered / (totalDelivered + totalFailedDeliveries)) * 1000) / 10
        : 0;

    const trendMap = new Map<string, { day: string; sent: number; failed: number }>();
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      trendMap.set(key, { day: label, sent: 0, failed: 0 });
    }

    for (const log of weekLogs) {
      const key = new Date(log.sent_at).toISOString().slice(0, 10);
      const row = trendMap.get(key);
      if (!row) continue;
      const meta = (log.meta || {}) as Record<string, unknown>;
      const { delivered, failed } = deliveryStatsFromMeta(meta);
      row.sent += delivered;
      row.failed += failed;
    }

    const typeBreakdown: Record<string, number> = {};
    for (const log of weekLogs) {
      const meta = (log.meta || {}) as Record<string, unknown>;
      const type = normalizeNotificationType(meta.notification_type);
      typeBreakdown[type] = (typeBreakdown[type] || 0) + 1;
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

    const credentialsOk = fcmHealth.ok && fcmHealth.credentialsConfigured;
    const androidConnected = credentialsOk && firebaseConfig.android_enabled !== false;
    const iosConnected = credentialsOk && firebaseConfig.ios_enabled !== false;

    return NextResponse.json({
      admin: {
        name: auth.userName,
        role: auth.roleCode,
        greeting,
      },
      kpis: {
        active_devices: devicesRes.count || 0,
        android_devices: androidDevices,
        ios_devices: iosDevices,
        customer_devices: customerDevicesRes.count || 0,
        staff_devices: staffDevicesRes.count || 0,
        legacy_expo_devices: legacyExpoRes.count || 0,
        customers_push_on: pushEnabledRes.count || 0,
        customers_push_off: pushDisabledRes.count || 0,
        total_notifications: totalCampaigns,
        successfully_delivered: totalDelivered,
        failed_deliveries: totalFailedDeliveries,
        delivery_rate: deliveryRate,
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
      type_breakdown: typeBreakdown,
      role_breakdown: roleBreakdown,
      platform_status: {
        android: {
          label: 'Android (FCM)',
          status: androidConnected ? 'connected' : 'pending',
          message: androidConnected
            ? fcmHealth.message || 'FCM credentials configured'
            : 'Not tested yet',
        },
        ios: {
          label: 'iOS (APNs)',
          status: iosConnected ? 'connected' : 'pending',
          message: iosConnected
            ? 'APNs via Firebase Cloud Messaging'
            : 'Configure APNs key in Firebase Console',
        },
      },
      recent_broadcasts: (recentLogsRes.data || []).map((log) => {
        const meta = (log.meta || {}) as Record<string, unknown>;
        const { delivered, failed } = deliveryStatsFromMeta(meta);
        return {
          ...log,
          meta: {
            ...meta,
            delivered,
            failed,
            notification_type: normalizeNotificationType(meta.notification_type),
          },
        };
      }),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
