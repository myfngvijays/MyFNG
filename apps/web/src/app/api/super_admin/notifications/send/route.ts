import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { deactivateFcmTokens, sendFcmPush } from '@/lib/push/fcmPush';
import { formatFcmAdminErrorMessage } from '@/lib/push/fcmErrorMessages';
import { MOBILE_PUSH_PLATFORM } from '@/lib/push/constants';
import { assertPushAdmin } from '@/lib/push/admin-auth';
import { loadPushFirebaseConfig } from '@/lib/push/firebaseConfigStore';
import { insertPushNotificationLog, PUSH_LOG_TYPE_BROADCAST } from '@/lib/push/notificationLog';
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

function matchesOsFilter(deviceName: string | null | undefined, filter: 'all' | 'android' | 'ios'): boolean {
  if (filter === 'all') return true;
  const name = String(deviceName || '').toLowerCase();
  const isIos = name.includes('ios') || name.includes('iphone') || name.includes('ipad');
  if (filter === 'ios') return isIos;
  if (filter === 'android') return !isIos;
  return true;
}

function inferDeviceOs(deviceName: string | null | undefined): 'ios' | 'android' | 'unknown' {
  const name = String(deviceName || '').toLowerCase();
  if (name.includes('ios') || name.includes('iphone') || name.includes('ipad')) return 'ios';
  if (name.includes('android')) return 'android';
  return 'unknown';
}

type DeviceTokenTarget = { token: string; os: 'ios' | 'android' | 'unknown' };

function collectDeviceTokens(
  devices: Array<{ token: string; customer_id?: string | null; device_name?: string | null }>,
  pushDisabledCustomerIds: Set<string>,
  osFilter: 'all' | 'android' | 'ios' = 'all',
): DeviceTokenTarget[] {
  return devices
    .filter((device) => {
      if (device.customer_id && pushDisabledCustomerIds.has(String(device.customer_id))) {
        return false;
      }
      return matchesOsFilter(device.device_name, osFilter);
    })
    .map((device) => ({
      token: String(device.token),
      os: inferDeviceOs(device.device_name),
    }));
}

function resolveOsFilter(platform: string, audience: string): 'all' | 'android' | 'ios' {
  const p = String(platform || 'both').toLowerCase();
  const a = String(audience || 'all').toLowerCase();
  if (p === 'android') return 'android';
  if (p === 'ios') return 'ios';
  if (a === 'android' || a === 'ios') return a as 'android' | 'ios';
  return 'all';
}

function dedupeDeviceTargets(targets: DeviceTokenTarget[]): DeviceTokenTarget[] {
  const byToken = new Map<string, DeviceTokenTarget>();
  for (const target of targets) {
    if (!target.token) continue;
    byToken.set(target.token, target);
  }
  return [...byToken.values()];
}

function buildDeliverySummary(
  platformStats: {
    ios: { attempted: number; delivered: number; failed: number };
    android: { attempted: number; delivered: number; failed: number };
  },
  uniqueErrors: string[],
): string | undefined {
  const parts: string[] = [];
  if (platformStats.android.attempted > 0) {
    parts.push(`Android: ${platformStats.android.delivered}/${platformStats.android.attempted} delivered`);
  }
  if (platformStats.ios.attempted > 0) {
    parts.push(`iPhone: ${platformStats.ios.delivered}/${platformStats.ios.attempted} delivered`);
  }

  if (platformStats.ios.failed > 0 && platformStats.android.delivered > 0) {
    return [
      parts.join(' · '),
      'Android succeeded but iPhone failed — your iPhone did NOT get this notification.',
      uniqueErrors.length > 0 ? formatFcmAdminErrorMessage(uniqueErrors) : undefined,
    ]
      .filter(Boolean)
      .join(' ');
  }

  if (parts.length > 0) {
    return parts.join(' · ');
  }

  return uniqueErrors.length > 0 ? formatFcmAdminErrorMessage(uniqueErrors) : undefined;
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
    const targetCities: string[] = Array.isArray(body?.target_cities) ? body.target_cities.map((c: any) => String(c).trim()).filter(Boolean) : [];
    const targetMembership = String(body?.target_membership || '').trim();
    const targetMembershipPlans: string[] = Array.isArray(body?.target_membership_plans) ? body.target_membership_plans.map((p: any) => String(p).trim()).filter(Boolean) : [];
    const targetServiceCenters: string[] = Array.isArray(body?.target_service_centers) ? body.target_service_centers.map((s: any) => String(s).trim()).filter(Boolean) : [];
    const targetCarBrands: string[] = Array.isArray(body?.target_car_brands) ? body.target_car_brands.map((b: any) => String(b).trim()).filter(Boolean) : [];
    const targetCustomerType = String(body?.target_customer_type || '').trim();
    const targetCouponUsers = String(body?.target_coupon_users || '').trim();
    const targetCouponCodes: string[] = Array.isArray(body?.target_coupon_codes) ? body.target_coupon_codes.map((c: any) => String(c).trim()).filter(Boolean) : [];
    const targetPhoneList: string[] = Array.isArray(body?.target_phone_list) ? body.target_phone_list : [];

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

    let deviceTargets: DeviceTokenTarget[] = [];
    let targetCustomer: { id: string; phone: string; full_name: string | null } | null = null;
    const pushDisabledCustomerIds = await getPushDisabledCustomerIds(supabaseAdmin);

    const hasAdvancedTargeting = targetPhoneList.length > 0 || targetCities.length > 0 || targetMembership || targetServiceCenters.length > 0 || targetCarBrands.length > 0 || targetCustomerType || targetCouponUsers;

    if (hasAdvancedTargeting && targetRole === 'CUSTOMER') {
      let filteredCustomerIds: Set<string> | null = null;

      if (targetPhoneList.length > 0) {
        const { data: customers } = await supabaseAdmin
          .from('customers')
          .select('id, phone');

        const normalizedList = new Set(targetPhoneList.map((p) => p.replace(/\D/g, '').slice(-10)));
        filteredCustomerIds = new Set(
          (customers || [])
            .filter((c: any) => normalizedList.has(String(c.phone).replace(/\D/g, '').slice(-10)))
            .map((c: any) => c.id)
        );
      } else {
        if (targetCities.length > 0) {
          const { data: cityRows } = await supabaseAdmin
            .from('cities')
            .select('id')
            .in('name', targetCities);

          const cityIds = (cityRows || []).map((c: any) => c.id);
          if (cityIds.length > 0) {
            const { data: leads } = await supabaseAdmin
              .from('service_leads')
              .select('customer_phone')
              .in('city_id', cityIds)
              .not('customer_phone', 'is', null);

            const cityPhones = [...new Set(
              (leads || []).map((l: any) => String(l.customer_phone).replace(/\D/g, '').slice(-10)).filter((p: string) => p.length === 10)
            )];

            if (cityPhones.length > 0) {
              const { data: customers } = await supabaseAdmin
                .from('customers')
                .select('id, phone');
              filteredCustomerIds = new Set(
                (customers || [])
                  .filter((c: any) => cityPhones.includes(String(c.phone).replace(/\D/g, '').slice(-10)))
                  .map((c: any) => c.id)
              );
            } else {
              filteredCustomerIds = new Set();
            }
          } else {
            filteredCustomerIds = new Set();
          }
        }

        if (targetMembership === 'members' || targetMembership === 'non_members') {
          let membershipQuery = supabaseAdmin.from('customer_memberships').select('customer_id, plan_id').eq('status', 'ACTIVE');

          if (targetMembership === 'members' && targetMembershipPlans.length > 0) {
            const { data: planRows } = await supabaseAdmin.from('membership_plans').select('id').in('code', targetMembershipPlans);
            const planIds = (planRows || []).map((p: any) => p.id);
            if (planIds.length > 0) {
              membershipQuery = membershipQuery.in('plan_id', planIds);
            }
          }

          const { data: memberships } = await membershipQuery;
          const memberIds = new Set((memberships || []).map((m: any) => m.customer_id));

          if (targetMembership === 'members') {
            if (filteredCustomerIds !== null) {
              filteredCustomerIds = new Set([...filteredCustomerIds].filter((id) => memberIds.has(id)));
            } else {
              filteredCustomerIds = memberIds;
            }
          } else {
            if (filteredCustomerIds !== null) {
              filteredCustomerIds = new Set([...filteredCustomerIds].filter((id) => !memberIds.has(id)));
            } else {
              const { data: allCustomers } = await supabaseAdmin.from('customers').select('id');
              filteredCustomerIds = new Set(
                (allCustomers || []).map((c: any) => c.id).filter((id: string) => !memberIds.has(id))
              );
            }
          }
        }

        if (targetServiceCenters.length > 0) {
          const { data: workshopRows } = await supabaseAdmin.from('workshops').select('id').in('name', targetServiceCenters);
          const workshopIds = (workshopRows || []).map((w: any) => w.id);
          if (workshopIds.length > 0) {
            const { data: leads } = await supabaseAdmin.from('service_leads').select('customer_phone').in('workshop_id', workshopIds).not('customer_phone', 'is', null);
            const scPhones = [...new Set((leads || []).map((l: any) => String(l.customer_phone).replace(/\D/g, '').slice(-10)).filter((p: string) => p.length === 10))];
            if (scPhones.length > 0) {
              const { data: customers } = await supabaseAdmin.from('customers').select('id, phone');
              const scIds = new Set((customers || []).filter((c: any) => scPhones.includes(String(c.phone).replace(/\D/g, '').slice(-10))).map((c: any) => c.id));
              filteredCustomerIds = filteredCustomerIds !== null ? new Set([...filteredCustomerIds].filter((id) => scIds.has(id))) : scIds;
            } else {
              filteredCustomerIds = new Set();
            }
          }
        }

        if (targetCarBrands.length > 0) {
          const { data: leads } = await supabaseAdmin.from('service_leads').select('customer_phone').in('vehicle_make', targetCarBrands).not('customer_phone', 'is', null);
          const brandPhones = [...new Set((leads || []).map((l: any) => String(l.customer_phone).replace(/\D/g, '').slice(-10)).filter((p: string) => p.length === 10))];
          if (brandPhones.length > 0) {
            const { data: customers } = await supabaseAdmin.from('customers').select('id, phone');
            const brandIds = new Set((customers || []).filter((c: any) => brandPhones.includes(String(c.phone).replace(/\D/g, '').slice(-10))).map((c: any) => c.id));
            filteredCustomerIds = filteredCustomerIds !== null ? new Set([...filteredCustomerIds].filter((id) => brandIds.has(id))) : brandIds;
          } else {
            filteredCustomerIds = new Set();
          }
        }

        if (targetCustomerType === 'new' || targetCustomerType === 'returning') {
          const { data: leadCounts } = await supabaseAdmin.from('service_leads').select('customer_phone').not('customer_phone', 'is', null);
          const phoneBookingCount = new Map<string, number>();
          for (const l of leadCounts || []) {
            const p = String(l.customer_phone).replace(/\D/g, '').slice(-10);
            if (p.length === 10) phoneBookingCount.set(p, (phoneBookingCount.get(p) || 0) + 1);
          }
          const { data: customers } = await supabaseAdmin.from('customers').select('id, phone');
          const matchedIds = new Set(
            (customers || []).filter((c: any) => {
              const p = String(c.phone).replace(/\D/g, '').slice(-10);
              const count = phoneBookingCount.get(p) || 0;
              return targetCustomerType === 'new' ? count <= 1 : count > 1;
            }).map((c: any) => c.id)
          );
          filteredCustomerIds = filteredCustomerIds !== null ? new Set([...filteredCustomerIds].filter((id) => matchedIds.has(id))) : matchedIds;
        }

        if (targetCouponUsers === 'used' || targetCouponUsers === 'never') {
          let redemptionQuery = supabaseAdmin.from('coupon_redemptions').select('customer_id, coupon_id').not('customer_id', 'is', null);
          if (targetCouponUsers === 'used' && targetCouponCodes.length > 0) {
            const { data: couponRows } = await supabaseAdmin.from('coupons').select('id').in('code', targetCouponCodes);
            const couponIds = (couponRows || []).map((c: any) => c.id);
            if (couponIds.length > 0) redemptionQuery = redemptionQuery.in('coupon_id', couponIds);
          }
          const { data: redemptions } = await redemptionQuery;
          const couponCustomerIds = new Set((redemptions || []).map((r: any) => r.customer_id));
          if (targetCouponUsers === 'used') {
            filteredCustomerIds = filteredCustomerIds !== null ? new Set([...filteredCustomerIds].filter((id) => couponCustomerIds.has(id))) : couponCustomerIds;
          } else {
            if (filteredCustomerIds !== null) {
              filteredCustomerIds = new Set([...filteredCustomerIds].filter((id) => !couponCustomerIds.has(id)));
            } else {
              const { data: allC } = await supabaseAdmin.from('customers').select('id');
              filteredCustomerIds = new Set((allC || []).map((c: any) => c.id).filter((id: string) => !couponCustomerIds.has(id)));
            }
          }
        }
      }

      const targetIds = filteredCustomerIds ? [...filteredCustomerIds] : [];
      if (targetIds.length === 0) {
        return NextResponse.json({ success: true, sent: 0, message: 'No customers matched the targeting filters' });
      }

      const CHUNK = 200;
      const allDevices: any[] = [];
      for (let i = 0; i < targetIds.length; i += CHUNK) {
        const chunk = targetIds.slice(i, i + CHUNK);
        const { data } = await supabaseAdmin
          .from('notification_devices')
          .select('token, customer_id, device_name')
          .eq('platform', MOBILE_PUSH_PLATFORM)
          .eq('is_active', true)
          .in('customer_id', chunk);
        if (data) allDevices.push(...data);
      }
      deviceTargets = collectDeviceTokens(allDevices, pushDisabledCustomerIds, osFilter);

    } else if (targetRole === 'ALL') {
      const { data } = await supabaseAdmin
        .from('notification_devices')
        .select('token, customer_id, device_name')
        .eq('platform', MOBILE_PUSH_PLATFORM)
        .eq('is_active', true);
      deviceTargets = collectDeviceTokens((data || []) as any[], pushDisabledCustomerIds, osFilter);
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

        deviceTargets = (customerDevices || [])
          .filter((r: any) => matchesOsFilter(r.device_name, osFilter))
          .map((r: any) => ({
            token: String(r.token),
            os: inferDeviceOs(r.device_name),
          }));
      } else {
        const { data: customerDevices } = await supabaseAdmin
          .from('notification_devices')
          .select('token, customer_id, device_name')
          .eq('platform', MOBILE_PUSH_PLATFORM)
          .eq('is_active', true)
          .not('customer_id', 'is', null);

        deviceTargets = collectDeviceTokens((customerDevices || []) as any[], pushDisabledCustomerIds, osFilter);
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
          .select('token, device_name')
          .eq('platform', MOBILE_PUSH_PLATFORM)
          .eq('is_active', true)
          .in('user_id', userIds);
        deviceTargets = (devices || [])
          .filter((r: any) => matchesOsFilter(r.device_name, osFilter))
          .map((r: any) => ({
            token: String(r.token),
            os: inferDeviceOs(r.device_name),
          }));
      }
    }

    if (deviceTargets.length === 0) {
      await insertPushNotificationLog({
        recipient: targetRole,
        type: PUSH_LOG_TYPE_BROADCAST,
        message: `[${title}] ${message}`,
        status: 'NO_DEVICES',
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
          target_cities: targetCities.length > 0 ? targetCities : null,
          target_membership: targetMembership || null,
          target_phone_list_count: targetPhoneList.length || null,
        },
      });
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

    const uniqueTargets = dedupeDeviceTargets(deviceTargets);
    const BATCH_SIZE = 100;
    let totalAttempted = 0;
    let totalDelivered = 0;
    const deliveryErrors: string[] = [];
    const platformStats = {
      ios: { attempted: 0, delivered: 0, failed: 0 },
      android: { attempted: 0, delivered: 0, failed: 0 },
      unknown: { attempted: 0, delivered: 0, failed: 0 },
    };

    for (let i = 0; i < uniqueTargets.length; i += BATCH_SIZE) {
      const batch = uniqueTargets.slice(i, i + BATCH_SIZE);
      const delivery = await sendFcmPush(
        batch.map((target) => ({
          token: target.token,
          os: target.os,
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
      for (const os of ['ios', 'android', 'unknown'] as const) {
        platformStats[os].attempted += delivery.platformStats[os].attempted;
        platformStats[os].delivered += delivery.platformStats[os].delivered;
        platformStats[os].failed += delivery.platformStats[os].failed;
      }
      if (delivery.invalidTokens.length) {
        await deactivateFcmTokens(supabaseAdmin, delivery.invalidTokens);
      }
    }

    const uniqueErrors = [...new Set(deliveryErrors.filter(Boolean))];
    const deliverySummary = buildDeliverySummary(platformStats, uniqueErrors);
    const logStatus =
      totalDelivered > 0 ? 'SENT' : totalAttempted > 0 ? 'FCM_FAILED' : 'NO_DEVICES';

    await insertPushNotificationLog({
      recipient: targetRole,
      type: PUSH_LOG_TYPE_BROADCAST,
      message: `[${title}] ${message}`,
      status: logStatus,
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
        platform_stats: platformStats,
        target_cities: targetCities.length > 0 ? targetCities : null,
        target_membership: targetMembership || null,
        target_phone_list_count: targetPhoneList.length || null,
      },
    });

    if (totalDelivered === 0 && totalAttempted > 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        attempted: totalAttempted,
        platform_stats: platformStats,
        message:
          uniqueErrors.length > 0
            ? formatFcmAdminErrorMessage(uniqueErrors)
            : 'FCM rejected the push token. Re-register on the current device (Settings → Push OFF → ON).',
        fcm_errors: uniqueErrors,
        target_phone: targetPhone || undefined,
      });
    }

    return NextResponse.json({
      success: true,
      sent: totalDelivered,
      attempted: totalAttempted,
      platform_stats: platformStats,
      message: deliverySummary,
      partial_failure: platformStats.ios.failed > 0 || platformStats.android.failed > 0,
      fcm_errors: uniqueErrors,
      target_phone: targetPhone || undefined,
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}
