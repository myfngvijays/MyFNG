import 'server-only';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { MOBILE_PUSH_PLATFORM } from '@/lib/push/constants';
import { deactivateFcmTokens, sendFcmPush } from '@/lib/push/fcmPush';

type CustomerPushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
  notificationType?: string;
};

async function isCustomerPushAllowed(
  supabaseAdmin: NonNullable<ReturnType<typeof getSupabaseAdmin>['supabaseAdmin']>,
  customerId: string,
  prefField: 'wallet_credits' | 'offers' | 'order_updates' = 'wallet_credits',
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('customer_notification_preferences')
    .select('push_enabled, wallet_credits, offers, order_updates')
    .eq('customer_id', customerId)
    .maybeSingle();

  if (!data) return true;
  if (data.push_enabled === false) return false;
  if (prefField === 'wallet_credits' && data.wallet_credits === false) return false;
  if (prefField === 'offers' && data.offers === false) return false;
  if (prefField === 'order_updates' && data.order_updates === false) return false;
  return true;
}

function inferDeviceOs(deviceName: string | null | undefined): 'ios' | 'android' | 'unknown' {
  const name = String(deviceName || '').toLowerCase();
  if (name.includes('ios') || name.includes('iphone') || name.includes('ipad')) return 'ios';
  if (name.includes('android')) return 'android';
  return 'unknown';
}

export async function dispatchPushToCustomer(
  customerId: string,
  payload: CustomerPushPayload,
): Promise<{ attempted: number; delivered: number }> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { attempted: 0, delivered: 0 };

  const allowed = await isCustomerPushAllowed(supabaseAdmin, customerId, 'wallet_credits');
  if (!allowed) return { attempted: 0, delivered: 0 };

  const { data: devices } = await supabaseAdmin
    .from('notification_devices')
    .select('token, device_name')
    .eq('customer_id', customerId)
    .eq('platform', MOBILE_PUSH_PLATFORM)
    .eq('is_active', true);

  const tokens = (devices || []).map((d: any) => ({
    token: String(d.token),
    os: inferDeviceOs(d.device_name),
  }));

  if (!tokens.length) return { attempted: 0, delivered: 0 };

  try {
    const delivery = await sendFcmPush(
      tokens.map((t) => ({
        token: t.token,
        os: t.os,
        title: payload.title,
        body: payload.body,
        priority: 'high' as const,
        data: {
          type: payload.notificationType || 'WALLET_UPDATE',
          ...(payload.data || {}),
        },
      })),
    );

    if (delivery.invalidTokens.length) {
      await deactivateFcmTokens(supabaseAdmin, delivery.invalidTokens);
    }

    return { attempted: delivery.attempted, delivered: delivery.delivered };
  } catch (e) {
    console.warn('Customer FCM push failed:', e);
    return { attempted: tokens.length, delivered: 0 };
  }
}
