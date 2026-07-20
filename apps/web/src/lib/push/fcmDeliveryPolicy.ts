import 'server-only';
import type { PushFirebaseConfigRecord } from '@/lib/push/firebaseConfigStore';
import type { FcmDeviceOs } from '@/lib/push/fcmPush';

export type FcmDeliveryPolicy = {
  globalEnabled: boolean;
  androidEnabled: boolean;
  iosEnabled: boolean;
};

export function buildFcmDeliveryPolicy(config: PushFirebaseConfigRecord): FcmDeliveryPolicy {
  return {
    globalEnabled: config.push_enabled !== false,
    androidEnabled: config.android_enabled !== false,
    iosEnabled: config.ios_enabled !== false,
  };
}

export function isFcmOsDeliveryAllowed(
  os: FcmDeviceOs | undefined,
  policy: FcmDeliveryPolicy,
): boolean {
  if (!policy.globalEnabled) return false;
  if (os === 'android') return policy.androidEnabled;
  if (os === 'ios') return policy.iosEnabled;
  return policy.androidEnabled || policy.iosEnabled;
}

export function filterMessagesForFcmPolicy<T extends { os?: FcmDeviceOs }>(
  messages: T[],
  policy: FcmDeliveryPolicy,
): T[] {
  return messages.filter((message) => isFcmOsDeliveryAllowed(message.os, policy));
}
