import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { deactivateFcmTokens, sendFcmPush } from '@/lib/push/fcmPush';
import { MOBILE_PUSH_PLATFORM } from '@/lib/push/constants';
import { assertPushAdmin } from '@/lib/push/admin-auth';
import { loadPushFirebaseConfig } from '@/lib/push/firebaseConfigStore';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ROLE_OPTIONS = [
  'ALL',
  'CUSTOMER',
  'SUPER_ADMIN',
  'SUB_ADMIN',
  'TELECALLER',
  'WORKSHOP_ADMIN',
  'WORKSHOP_SUPERVISOR',
  'WORKSHOP_MECHANIC',
  'WORKSHOP_PICKUP_BOY',
  'LEAD_MANAGER',
  'PICKUP_BOY',
];

function resolveRoleCodeForQuery(targetRole: string): string {
  if (targetRole === 'PICKUP_BOY') return 'WORKSHOP_PICKUP_BOY';
  return targetRole;
}

async function getPushDisabledCustomerIds(supabaseAdmin: any): Promise<Set<string>> {
  const { data } = await supabaseAdmin
    .from('customer_notification_preferences')
    .select('customer_id')
    .eq('push_enabled', false);
  return new Set((data || []).map((row: any) => String(row.customer_id)));
}

function filterCustomerDeviceTokens(
  devices: Array<{ token: string; customer_id?: string | null; device_name?: string | null }>,
  pushDisabledCustomerIds: Set<string>,
  osFilter: 'all' | 'android' | 'ios' = 'all',
): string[] {
  return devices
    .filter((device) => {
      if (device.customer_id && pushDisabledCustomerIds.has(String(device.customer_id))) {
        return false;
      }
      return matchesOsFilter(device.device_name, osFilter);
    })
    .map((device) => String(device.token));
}

function matchesOsFilter(deviceName: string | null | undefined, filter: 'all' | 'android' | 'ios'): boolean {
  if (filter === 'all') return true;
  const name = String(deviceName || '').toLowerCase();
  const isIos = name.includes('ios') || name.includes('iphone') || name.includes('ipad');
  if (filter === 'ios') return isIos;
  if (filter === 'android') return !isIos;
  return true;
}

function resolveOsFilter(platform: string, audience: string): 'all' | 'android' | 'ios' {
  const p = String(platform || 'both').toLowerCase();
  const a = String(audience || 'all').toLowerCase();
  if (p === 'android') return 'android';
  if (p === 'ios') return 'ios';
  if (a === 'android' || a === 'ios') return a as 'android' | 'ios';
  return 'all';
}

async function assertAdmin() {
  const auth = await assertPushAdmin();
  if (!auth.ok) {
    return { ok: false as const, status: auth.status, error: auth.error, userId: '', userName: '' };
  }
  return {
    ok: true as const,
    status: 200,
    error: null,
    userId: auth.userId,
    userName: auth.userName,
  };
}

async function isPushGloballyEnabled(): Promise<boolean> {
  const config = await loadPushFirebaseConfig();
  return config.push_enabled !== false;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await assertAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const title = String(body?.title || '').trim();
    const message = String(body?.message || '').trim();
    const targetRole = String(body?.target_role || 'ALL').trim().toUpperCase();
    const priority = body?.priority === 'high' ? 'high' : 'default';
    const targetPhoneRaw = String(body?.target_phone || '').replace(/\D/g, '');
    const targetPhone = targetPhoneRaw.length >= 10 ? targetPhoneRaw.slice(-10) : '';
    const notificationType = String(body?.notification_type || 'promotional').trim().toLowerCase();
    const imageUrl = String(body?.image_url || '').trim();
    const deepLink = String(body?.deep_link || '').trim();
    const ctaUrl = String(body?.cta_url || '').trim();
    const osFilter = resolveOsFilter(String(body?.platform || 'both'), String(body?.audience || 'all'));

    if (!title || !message) {
      return NextResponse.json({ error: 'Title and message are required' }, { status: 400 });
    }
    if (!ROLE_OPTIONS.includes(targetRole)) {
      return NextResponse.json({ error: 'Invalid target role' }, { status: 400 });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const pushEnabled = await isPushGloballyEnabled();
    if (!pushEnabled) {
      return NextResponse.json(
        {
          error: 'Push notifications are disabled globally. Enable in System Settings or Firebase Settings.',
          push_disabled_globally: true,
        },
        { status: 403 },
      );
    }

    let tokens: string[] = [];
    let targetCustomer: { id: string; phone: string; full_name: string | null } | null = null;
    const pushDisabledCustomerIds = await getPushDisabledCustomerIds(supabaseAdmin);

    if (targetRole === 'ALL') {
      const { data } = await supabaseAdmin
        .from('notification_devices')
        .select('token, customer_id, device_name')
        .eq('platform', MOBILE_PUSH_PLATFORM)
        .eq('is_active', true);
      tokens = filterCustomerDeviceTokens((data || []) as any[], pushDisabledCustomerIds, osFilter);
    } else if (targetRole === 'CUSTOMER') {
      if (targetPhone) {
        const { data: customer } = await supabaseAdmin
          .from('customers')
          .select('id, phone, full_name')
          .or(`phone.eq.${targetPhone},phone.eq.91${targetPhone}`)
          .maybeSingle();

        if (!customer) {
          return NextResponse.json({
            success: true,
            sent: 0,
            message: `No customer found for phone ${targetPhone}`,
            customer_found: false,
          });
        }
        targetCustomer = customer as { id: string; phone: string; full_name: string | null };

        if (pushDisabledCustomerIds.has(String(customer.id))) {
          return NextResponse.json({
            success: true,
            sent: 0,
            message: `Push notifications are turned off for ${targetPhone}.`,
            customer_found: true,
            push_disabled: true,
            target_phone: targetPhone,
          });
        }

        const { data: customerDevices } = await supabaseAdmin
          .from('notification_devices')
          .select('token, device_name')
          .eq('customer_id', customer.id)
          .eq('platform', MOBILE_PUSH_PLATFORM)
          .eq('is_active', true);

        tokens = (customerDevices || [])
          .filter((r: any) => matchesOsFilter(r.device_name, osFilter))
          .map((r: any) => String(r.token));
      } else {
        const { data: customerDevices } = await supabaseAdmin
          .from('notification_devices')
          .select('token, customer_id, device_name')
          .eq('platform', MOBILE_PUSH_PLATFORM)
          .eq('is_active', true)
          .not('customer_id', 'is', null);

        tokens = filterCustomerDeviceTokens((customerDevices || []) as any[], pushDisabledCustomerIds, osFilter);
      }
    } else {
      const { data: roleUsers } = await supabaseAdmin
        .from('users_login')
        .select('id, roles!inner(role_code)')
        .eq('roles.role_code', resolveRoleCodeForQuery(targetRole));

      const userIds = (roleUsers || []).map((r: any) => r.id);
      if (userIds.length > 0) {
        const { data: devices } = await supabaseAdmin
          .from('notification_devices')
          .select('token')
          .eq('platform', MOBILE_PUSH_PLATFORM)
          .eq('is_active', true)
          .in('user_id', userIds);
        tokens = (devices || []).map((r: any) => String(r.token));
      }
    }

    if (tokens.length === 0) {
      await supabaseAdmin
        .from('notification_logs')
        .insert({
          recipient: targetRole,
          type: 'PUSH_BROADCAST',
          message: `[${title}] ${message}`,
          status: 'NO_DEVICES',
          sent_at: new Date().toISOString(),
          meta: {
            target_role: targetRole,
            target_phone: targetPhone || null,
            target_customer_id: targetCustomer?.id || null,
            title,
            body: message,
            sent_by: auth.userName,
            sent_by_id: auth.userId,
            devices: 0,
            priority,
            notification_type: notificationType,
            image_url: imageUrl || null,
            deep_link: deepLink || null,
            cta_url: ctaUrl || null,
            platform: body?.platform || 'both',
            audience: body?.audience || 'all',
            os_filter: osFilter,
          },
        })
        .then(() => undefined, () => undefined);
      return NextResponse.json({
        success: true,
        sent: 0,
        message: targetPhone
          ? `No push token on phone ${targetPhone}. Open MyFNG app → login → allow notifications.`
          : 'No devices found for this role',
        customer_found: targetPhone ? Boolean(targetCustomer) : undefined,
        target_phone: targetPhone || undefined,
      });
    }

    const uniqueTokens = [...new Set(tokens)];
    const BATCH_SIZE = 100;
    let totalAttempted = 0;
    let totalDelivered = 0;
    const deliveryErrors: string[] = [];

    for (let i = 0; i < uniqueTokens.length; i += BATCH_SIZE) {
      const batch = uniqueTokens.slice(i, i + BATCH_SIZE);
      const delivery = await sendFcmPush(
        batch.map((token) => ({
          token,
          title,
          body: message,
          priority,
          imageUrl: imageUrl || undefined,
          data: {
            type: 'ADMIN_BROADCAST',
            notification_type: notificationType,
            deep_link: deepLink || undefined,
            cta_url: ctaUrl || undefined,
            sent_at: new Date().toISOString(),
          },
        })),
      );
      totalAttempted += delivery.attempted;
      totalDelivered += delivery.delivered;
      deliveryErrors.push(...delivery.errors);
      if (delivery.invalidTokens.length) {
        await deactivateFcmTokens(supabaseAdmin, delivery.invalidTokens);
      }
    }

    const uniqueErrors = [...new Set(deliveryErrors.filter(Boolean))];
    const logStatus =
      totalDelivered > 0 ? 'SENT' : totalAttempted > 0 ? 'FCM_FAILED' : 'NO_DEVICES';

    await supabaseAdmin
      .from('notification_logs')
      .insert({
        recipient: targetRole,
        type: 'PUSH_BROADCAST',
        message: `[${title}] ${message}`,
        status: logStatus,
        sent_at: new Date().toISOString(),
        meta: {
          target_role: targetRole,
          target_phone: targetPhone || null,
          target_customer_id: targetCustomer?.id || null,
          title,
          body: message,
          sent_by: auth.userName,
          sent_by_id: auth.userId,
          devices: totalDelivered,
          devices_attempted: totalAttempted,
          fcm_errors: uniqueErrors,
          priority,
          notification_type: notificationType,
          image_url: imageUrl || null,
          deep_link: deepLink || null,
          cta_url: ctaUrl || null,
          platform: body?.platform || 'both',
          audience: body?.audience || 'all',
          os_filter: osFilter,
        },
      })
      .then(() => undefined, () => undefined);

    if (totalDelivered === 0 && totalAttempted > 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        attempted: totalAttempted,
        message:
          uniqueErrors.length > 0
            ? `FCM rejected push: ${uniqueErrors.join(', ')}. Re-open app on this phone → Settings → toggle Push OFF then ON.`
            : 'FCM rejected the push token. Re-register on the current device (Settings → Push OFF → ON).',
        fcm_errors: uniqueErrors,
        target_phone: targetPhone || undefined,
      });
    }

    return NextResponse.json({
      success: true,
      sent: totalDelivered,
      attempted: totalAttempted,
      fcm_errors: uniqueErrors,
      target_phone: targetPhone || undefined,
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}
