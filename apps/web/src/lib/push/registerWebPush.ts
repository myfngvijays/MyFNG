import { getVapidPublicKey } from '@/lib/push/vapid';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function ensureWebPushSubscribed(): Promise<{ ok: boolean; reason?: string }> {
  if (typeof window === 'undefined') return { ok: false, reason: 'no_window' };
  if (!('serviceWorker' in navigator)) return { ok: false, reason: 'no_service_worker' };
  if (!('PushManager' in window)) return { ok: false, reason: 'no_push_manager' };

  const vapidPublicKey = getVapidPublicKey();
  if (!vapidPublicKey) return { ok: false, reason: 'missing_vapid_public_key' };

  const reg = await navigator.serviceWorker.register('/sw.js');
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));

  // Store on server (ties subscription to logged-in user)
  const json = sub.toJSON() as any;
  const endpoint = String(json?.endpoint || '');
  const p256dh = String(json?.keys?.p256dh || '');
  const auth = String(json?.keys?.auth || '');
  const expiration_time = json?.expirationTime ?? null;

  if (!endpoint || !p256dh || !auth) return { ok: false, reason: 'invalid_subscription' };

  const res = await fetch('/api/push/web/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, p256dh, auth, expiration_time }),
  });

  if (!res.ok) return { ok: false, reason: 'subscribe_api_failed' };
  return { ok: true };
}


