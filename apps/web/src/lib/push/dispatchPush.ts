import 'server-only';
import type { Notification } from '@/shared/types/notifications';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { deactivateFcmTokens, sendFcmPush } from '@/lib/push/fcmPush';
import { MOBILE_PUSH_PLATFORM } from '@/lib/push/constants';
import { sendWebPush, type WebPushSubscription } from '@/lib/push/webPush';

type PrefRow = {
  push_enabled: boolean;
  in_app_enabled: boolean;
  notification_types: any;
};

function isPushEnabledForType(prefs: PrefRow | null, type: string) {
  if (!prefs) return true; // default allow
  if (!prefs.push_enabled) return false;
  const perType = prefs.notification_types?.[type];
  if (!perType) return true;
  if (typeof perType.push === 'boolean') return perType.push;
  return true;
}

async function getPreferences(userId: string) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from('notification_preferences')
    .select('push_enabled, in_app_enabled, notification_types')
    .eq('user_id', userId)
    .maybeSingle();
  return (data as any) || null;
}

async function getFcmTokens(userId: string) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin
    .from('notification_devices')
    .select('token, device_name')
    .eq('user_id', userId)
    .eq('platform', MOBILE_PUSH_PLATFORM)
    .eq('is_active', true);
  return (data || []).map((r: any) => ({
    token: String(r.token),
    device_name: r.device_name ? String(r.device_name) : null,
  }));
}

function inferDeviceOs(deviceName: string | null | undefined): 'ios' | 'android' | 'unknown' {
  const name = String(deviceName || '').toLowerCase();
  if (name.includes('ios') || name.includes('iphone') || name.includes('ipad')) return 'ios';
  if (name.includes('android')) return 'android';
  return 'unknown';
}

async function getWebPushSubscriptions(userId: string): Promise<WebPushSubscription[]> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin
    .from('web_push_subscriptions')
    .select('endpoint, p256dh, auth, expiration_time')
    .eq('user_id', userId)
    .eq('is_active', true);

  return (data || []).map((r: any) => ({
    endpoint: String(r.endpoint),
    keys: { p256dh: String(r.p256dh), auth: String(r.auth) },
    expirationTime: r.expiration_time ?? null,
  }));
}

export async function dispatchPushToUser(userId: string, notification: Notification) {
  const prefs = await getPreferences(userId);
  if (!isPushEnabledForType(prefs, notification.type)) return;

  const title = notification.title;
  const body = notification.message;
  const data = {
    notification_id: notification.id,
    type: notification.type,
    action_url: notification.action_url || null,
    lead_id: notification.lead_id || null,
    lead_number: notification.lead_number || null,
  };

  // Mobile (FCM)
  try {
    const tokens = await getFcmTokens(userId);
    if (tokens.length > 0) {
      const delivery = await sendFcmPush(
        tokens.map((device) => ({
          token: device.token,
          os: inferDeviceOs(device.device_name),
          title,
          body,
          data,
        })),
      );
      if (delivery.invalidTokens.length) {
        const { supabaseAdmin } = getSupabaseAdmin();
        if (supabaseAdmin) await deactivateFcmTokens(supabaseAdmin, delivery.invalidTokens);
      }
    }
  } catch (e) {
    console.warn('FCM push dispatch failed:', e);
  }

  // Web Push (service worker)
  try {
    const subs = await getWebPushSubscriptions(userId);
    if (subs.length > 0) {
      const payload = { title, body, data };
      await Promise.allSettled(subs.map((s) => sendWebPush(s, payload)));
    }
  } catch (e) {
    console.warn('Web push dispatch failed:', e);
  }
}


