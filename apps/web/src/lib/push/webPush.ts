import 'server-only';
import webpush from 'web-push';
import { getVapidPublicKey as getClientPublicKey } from '@/lib/push/vapid';

export type WebPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime?: number | null;
};

function getVapidConfig() {
  const publicKey = getClientPublicKey() || process.env.VAPID_PUBLIC_KEY || '';
  const privateKey = process.env.VAPID_PRIVATE_KEY || '';
  const subject = process.env.VAPID_SUBJECT || 'mailto:support@myfng.local';

  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

export function getVapidPublicKey() {
  // Prefer exposing the client-safe key. (Server can still fallback to VAPID_PUBLIC_KEY above)
  return getClientPublicKey() || process.env.VAPID_PUBLIC_KEY || null;
}

export async function sendWebPush(subscription: WebPushSubscription, payload: any) {
  const cfg = getVapidConfig();
  if (!cfg) return { ok: false as const, reason: 'VAPID keys not configured' as const };

  webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);

  const body = JSON.stringify(payload);
  await webpush.sendNotification(subscription as any, body);
  return { ok: true as const };
}


