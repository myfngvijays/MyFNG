import 'server-only';
import type { Notification } from '@/shared/types/notifications';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { sendExpoPush } from '@/lib/push/expoPush';
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

async function getExpoTokens(userId: string) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin
    .from('notification_devices')
    .select('token')
    .eq('user_id', userId)
    .eq('platform', 'EXPO')
    .eq('is_active', true);
  return (data || []).map((r: any) => String(r.token));
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

  // Mobile (Expo)
  try {
    const tokens = await getExpoTokens(userId);
    if (tokens.length > 0) {
      await sendExpoPush(tokens.map((t: string) => ({ to: t, title, body, data, sound: 'default' })));
    }
  } catch (e) {
    console.warn('Expo push dispatch failed:', e);
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


