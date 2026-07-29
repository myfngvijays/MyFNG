import 'server-only';
import { getFirebaseAdminAppAsync } from '@/lib/firebase/admin';
import { loadPushFirebaseConfig } from '@/lib/push/firebaseConfigStore';
import {
  buildFcmDeliveryPolicy,
  filterMessagesForFcmPolicy,
} from '@/lib/push/fcmDeliveryPolicy';

export type FcmDeviceOs = 'ios' | 'android' | 'unknown';

export type FcmPushMessage = {
  token: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority?: 'default' | 'high';
  imageUrl?: string;
  /** Small notification icon (Android); also passed in data for clients */
  iconUrl?: string;
  os?: FcmDeviceOs;
  /** Data-only ping — used for silent uninstall token probes */
  dataOnly?: boolean;
};

export type FcmPlatformDeliveryStats = {
  attempted: number;
  delivered: number;
  failed: number;
};

export type FcmDeliveryResult = {
  ok: boolean;
  attempted: number;
  delivered: number;
  failed: number;
  errors: string[];
  invalidTokens: string[];
  platformStats: Record<FcmDeviceOs, FcmPlatformDeliveryStats>;
};

function stringifyData(data?: Record<string, unknown>): Record<string, string> | undefined {
  if (!data) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value == null) continue;
    out[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  return Object.keys(out).length ? out : undefined;
}

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

function emptyPlatformStats(): Record<FcmDeviceOs, FcmPlatformDeliveryStats> {
  return {
    ios: { attempted: 0, delivered: 0, failed: 0 },
    android: { attempted: 0, delivered: 0, failed: 0 },
    unknown: { attempted: 0, delivered: 0, failed: 0 },
  };
}

export async function sendFcmPush(messages: FcmPushMessage[]): Promise<FcmDeliveryResult> {
  if (!messages.length) {
    return {
      ok: true,
      attempted: 0,
      delivered: 0,
      failed: 0,
      errors: [],
      invalidTokens: [],
      platformStats: emptyPlatformStats(),
    };
  }

  const config = await loadPushFirebaseConfig();
  const policy = buildFcmDeliveryPolicy(config);
  const deliverable = filterMessagesForFcmPolicy(messages, policy);

  if (!deliverable.length) {
    return {
      ok: true,
      attempted: 0,
      delivered: 0,
      failed: 0,
      errors: [],
      invalidTokens: [],
      platformStats: emptyPlatformStats(),
    };
  }

  const androidChannel = config.android_default_channel || 'default';
  const iosBundleId = config.ios_bundle_id || 'com.myfng.app';
  const messaging = (await getFirebaseAdminAppAsync()).messaging();
  const invalidTokens: string[] = [];
  const errors: string[] = [];
  const platformStats = emptyPlatformStats();
  let delivered = 0;
  let failed = 0;

  const BATCH_SIZE = 500;
  for (let i = 0; i < deliverable.length; i += BATCH_SIZE) {
    const batch = deliverable.slice(i, i + BATCH_SIZE);
    const response = await messaging.sendEach(
      batch.map((msg) => {
        if (msg.dataOnly) {
          return {
            token: msg.token,
            data: stringifyData({ ...(msg.data || {}), probe: '1' }),
            android: { priority: 'normal' },
            apns: {
              headers: {
                'apns-priority': '5',
                'apns-push-type': 'background',
              },
              payload: {
                aps: {
                  'content-available': 1,
                },
              },
            },
          };
        }

        const dataPayload = stringifyData({
          ...(msg.data || {}),
          ...(msg.iconUrl ? { icon_url: msg.iconUrl } : {}),
          ...(msg.imageUrl ? { image_url: msg.imageUrl } : {}),
        });

        return {
          token: msg.token,
          notification: {
            title: msg.title,
            body: msg.body,
            ...(msg.imageUrl ? { imageUrl: msg.imageUrl } : {}),
          },
          data: dataPayload,
          android: {
            priority: msg.priority === 'high' ? 'high' : 'normal',
            notification: {
              channelId: androidChannel,
              sound: 'default',
              ...(msg.imageUrl ? { imageUrl: msg.imageUrl } : {}),
              ...(msg.iconUrl ? { icon: msg.iconUrl } : {}),
            },
          },
          apns: {
            headers: {
              'apns-priority': '10',
              'apns-push-type': 'alert',
              'apns-topic': iosBundleId,
            },
            payload: {
              aps: {
                alert: {
                  title: msg.title,
                  body: msg.body,
                },
                sound: 'default',
                ...(msg.imageUrl ? { 'mutable-content': 1 } : {}),
              },
              ...(msg.imageUrl ? { fcm_options: { image: msg.imageUrl } } : {}),
            },
            ...(msg.imageUrl ? { fcmOptions: { imageUrl: msg.imageUrl } } : {}),
          },
        };
      }),
    );

    response.responses.forEach((result, index) => {
      const os: FcmDeviceOs = batch[index].os || 'unknown';
      platformStats[os].attempted += 1;

      if (result.success) {
        delivered += 1;
        platformStats[os].delivered += 1;
        return;
      }
      failed += 1;
      platformStats[os].failed += 1;
      const code = result.error?.code || 'unknown';
      const message = result.error?.message || 'send_failed';
      errors.push(`${code}: ${message}`);
      if (INVALID_TOKEN_CODES.has(code)) {
        invalidTokens.push(batch[index].token);
      }
    });
  }

  return {
    ok: failed === 0,
    attempted: deliverable.length,
    delivered,
    failed,
    errors: [...new Set(errors)],
    invalidTokens: [...new Set(invalidTokens)],
    platformStats,
  };
}

export async function deactivateFcmTokens(supabaseAdmin: any, tokens: string[]) {
  if (!tokens.length) return;
  await supabaseAdmin
    .from('notification_devices')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('platform', 'FCM')
    .in('token', tokens);
}
