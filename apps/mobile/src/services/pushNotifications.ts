import { NativeModules, Platform, PermissionsAndroid } from 'react-native';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { ENV, isAndroidEmulator, isIosSimulator } from '../config/environment';
import { trackEvent } from '../lib/trackEvent';

async function trackPushEngagement(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage | null | undefined,
  event: 'open' | 'click',
) {
  const data = remoteMessage?.data || {};
  const trackingId = String(data.tracking_id || '').trim();
  if (!trackingId) return;
  try {
    const apiUrl = String(ENV.API_URL || '').replace(/\/$/, '');
    if (!apiUrl) return;
    await fetch(`${apiUrl}/api/push/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tracking_id: trackingId,
        event,
        campaign_id: data.campaign_id || undefined,
        variant: data.ab_variant || undefined,
      }),
    });
  } catch (e) {
    console.warn('[FCM] push engagement track failed:', e);
  }
}

const STORAGE_KEY = 'myfng_fcm_push_token_v1';
export const PUSH_PLATFORM = 'FCM';

type MessagingModule = typeof import('@react-native-firebase/messaging').default;

type PushRegisterFailure = {
  ok: false;
  reason: 'permission_denied' | 'no_token' | 'db_error' | 'api_error';
  details?: string;
};

type PushRegisterSuccess = {
  ok: true;
  token: string;
};

export type PushRegisterResult = PushRegisterSuccess | PushRegisterFailure;

let messagingModule: MessagingModule | null | undefined;

function getMessagingModule(): MessagingModule | null {
  if (messagingModule !== undefined) return messagingModule;

  if (!NativeModules.RNFBMessagingModule) {
    if (__DEV__) {
      console.warn(
        '[FCM] @react-native-firebase/messaging is not in this native build. Run: cd apps/mobile && npx expo run:ios (or run:android). Expo Go does not support FCM.',
      );
    }
    messagingModule = null;
    return null;
  }

  try {
    // Lazy require so Metro can load JS before native dev client is rebuilt.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    messagingModule = require('@react-native-firebase/messaging').default as MessagingModule;
    return messagingModule;
  } catch (error) {
    if (__DEV__) {
      console.warn('[FCM] Failed to load messaging module:', error);
    }
    messagingModule = null;
    return null;
  }
}

export function isFcmNativeLinked(): boolean {
  return getMessagingModule() != null;
}

export function isPushConfigured(): boolean {
  return isFcmNativeLinked();
}

/** @deprecated Use isPushConfigured */
export const isExpoPushConfigured = isPushConfigured;

async function requestNotificationPermission(): Promise<boolean> {
  const messaging = getMessagingModule();
  if (!messaging) return false;

  if (Platform.OS === 'ios') {
    const authStatus = await messaging().requestPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  }

  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }

  return true;
}

function resolveDeviceName(): string {
  if (Platform.OS === 'ios') {
    return isIosSimulator() ? 'iOS Simulator' : 'iOS';
  }
  if (Platform.OS === 'android') {
    const brand = String((Platform.constants as { Brand?: string } | undefined)?.Brand || '').trim();
    const model = String((Platform.constants as { Model?: string } | undefined)?.Model || '').trim();
    if (isAndroidEmulator()) return 'Android Emulator';
    return [brand, model].filter(Boolean).join(' ') || 'Android';
  }
  return Platform.OS;
}

async function resolveDeviceId(): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Application = require('expo-application') as {
      getAndroidId?: () => string | null;
      androidId?: string | null;
      getIosIdForVendorAsync?: () => Promise<string | null>;
    };
    if (Platform.OS === 'android') {
      return Application.getAndroidId?.() || Application.androidId || null;
    }
    if (Platform.OS === 'ios' && Application.getIosIdForVendorAsync) {
      return await Application.getIosIdForVendorAsync();
    }
  } catch {
    // optional
  }
  return null;
}

async function acquireFcmPushToken(): Promise<PushRegisterResult> {
  const messaging = getMessagingModule();
  if (!messaging) {
    return {
      ok: false,
      reason: 'api_error',
      details: 'FCM native module missing. Rebuild the dev client with expo run:ios or expo run:android.',
    };
  }

  if (isIosSimulator() || isAndroidEmulator()) {
    return {
      ok: false,
      reason: 'no_token',
      details: 'Push tokens are not registered from simulators/emulators. Use TestFlight or a physical device.',
    };
  }

  const permitted = await requestNotificationPermission();
  if (!permitted) {
    console.warn('[FCM] Notification permission denied by user');
    trackEvent('push_permission_denied');
    return { ok: false, reason: 'permission_denied' };
  }
  trackEvent('push_permission_granted');

  if (Platform.OS === 'ios') {
    try {
      await messaging().registerDeviceForRemoteMessages();
      const apnsToken = await messaging().getAPNSToken();
      console.warn('[FCM] APNs token registered:', apnsToken ? `${String(apnsToken).slice(0, 16)}...` : 'NULL');
      if (!apnsToken) {
        console.warn('[FCM] WARNING: APNs token is null. Push delivery may fail.');
      }
    } catch (e) {
      console.warn('[FCM] registerDeviceForRemoteMessages error:', e);
    }
  }

  const token = await messaging().getToken();
  if (!token) {
    console.warn('[FCM] getToken() returned null');
    return { ok: false, reason: 'no_token' };
  }

  console.warn('[MYFNG_FCM_TOKEN]', token);

  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const prev = await AsyncStorage.getItem(STORAGE_KEY);
    if (prev !== token) {
      await AsyncStorage.setItem(STORAGE_KEY, token);
      console.warn('[FCM] Token changed, saved new token');
    }
  } catch {
    // ignore storage issues
  }

  return { ok: true, token };
}

async function persistStaffFcmToken(
  userId: string,
  token: string,
): Promise<PushRegisterResult> {
  const deviceName = resolveDeviceName();
  const deviceId = await resolveDeviceId();

  try {
    const { apiFetch } = await import('../lib/api');
    await apiFetch('/api/staff/push-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        platform: PUSH_PLATFORM,
        device_name: deviceName,
        device_id: deviceId,
      }),
    });
    trackEvent('push_token_registered', { method: 'staff_api' });
    return { ok: true, token };
  } catch (apiError) {
    console.warn('[FCM] staff push-token API failed:', apiError);
  }

  const { supabase } = await import('../lib/supabase');
  const { data: rpcData, error: rpcError } = await supabase.rpc('register_staff_fcm_token', {
    p_fcm_token: token,
    p_device_name: deviceName,
    p_device_id: deviceId,
  });

  const rpc = rpcData as { ok?: boolean; error?: string } | null;
  if (!rpcError && rpc?.ok) {
    trackEvent('push_token_registered', { method: 'staff_rpc' });
    return { ok: true, token };
  }
  if (rpcError || rpc?.error) {
    console.warn('[FCM] register_staff_fcm_token RPC failed:', rpc?.error || rpcError?.message);
  }

  const now = new Date().toISOString();
  await supabase
    .from('notification_devices')
    .update({ is_active: false, updated_at: now } as any)
    .eq('user_id', userId)
    .eq('platform', PUSH_PLATFORM)
    .neq('token', token)
    .eq('is_active', true);

  const { error } = await supabase.from('notification_devices').upsert(
    {
      user_id: userId,
      platform: PUSH_PLATFORM,
      token,
      device_name: deviceName,
      device_id: deviceId,
      is_active: true,
      last_seen_at: now,
    } as any,
    { onConflict: 'user_id,platform,token' },
  );

  if (error) return { ok: false, reason: 'db_error', details: error.message };
  trackEvent('push_token_registered', { method: 'staff_upsert' });
  return { ok: true, token };
}

/** Staff login (Supabase auth / users_login). */
export async function registerAndSyncFcmPushToken(userId: string): Promise<PushRegisterResult> {
  const acquired = await acquireFcmPushToken();
  if (!acquired.ok) return acquired;
  return persistStaffFcmToken(userId, acquired.token);
}

export async function deactivateStaffFcmPushTokens(): Promise<{ ok: boolean; details?: string }> {
  try {
    const { apiFetch } = await import('../lib/api');
    await apiFetch('/api/staff/push-token', { method: 'DELETE' });
    return { ok: true };
  } catch (apiError) {
    console.warn('[FCM] staff push-token deactivate API failed:', apiError);
  }

  try {
    const { supabase } = await import('../lib/supabase');
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return { ok: false, details: 'not_authenticated' };

    const { error } = await supabase
      .from('notification_devices')
      .update({ is_active: false, updated_at: new Date().toISOString() } as any)
      .eq('user_id', user.id)
      .eq('platform', PUSH_PLATFORM);

    if (error) return { ok: false, details: error.message };
    return { ok: true };
  } catch (error) {
    return { ok: false, details: error instanceof Error ? error.message : 'deactivate_failed' };
  }
}

/** @deprecated Use registerAndSyncFcmPushToken */
export const registerAndSyncExpoPushToken = registerAndSyncFcmPushToken;

/** Customer app login — registers via web API, then Supabase RPC fallback (no VPS deploy). */
export async function registerCustomerFcmPushToken(
  apiUrl: string,
  sessionToken: string,
): Promise<PushRegisterResult> {
  const acquired = await acquireFcmPushToken();
  if (!acquired.ok) return acquired;

  const deviceName = resolveDeviceName();

  const { supabase } = await import('../lib/supabase');
  const { data: rpcData, error: rpcError } = await supabase.rpc('register_customer_fcm_token', {
    p_session_token: sessionToken,
    p_fcm_token: acquired.token,
    p_device_name: deviceName,
  });

  const rpc = rpcData as { ok?: boolean; error?: string } | null;
  if (!rpcError && rpc?.ok) {
    trackEvent('push_token_registered', { method: 'rpc' });
    return { ok: true, token: acquired.token };
  }

  const rpcFailure = rpc?.error || rpcError?.message;
  if (rpcFailure) {
    console.warn('[push] register_customer_fcm_token RPC failed:', rpcFailure);
  }

  const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/customer/push-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-customer-session': sessionToken,
      'x-mobile-client': 'true',
      'X-App-Platform': Platform.OS,
    },
    body: JSON.stringify({
      token: acquired.token,
      platform: PUSH_PLATFORM,
      device_name: deviceName,
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (res.ok) {
    return { ok: true, token: acquired.token };
  }

  return {
    ok: false,
    reason: 'api_error',
    details: String(
      rpcFailure || json?.error || json?.details || `HTTP ${res.status}`,
    ),
  };
}

/** @deprecated Use registerCustomerFcmPushToken */
export const registerCustomerExpoPushToken = registerCustomerFcmPushToken;

export async function deactivateCustomerFcmPushTokens(
  apiUrl: string,
  sessionToken: string,
): Promise<{ ok: boolean; details?: string }> {
  const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/customer/push-token`, {
    method: 'DELETE',
    headers: {
      'x-customer-session': sessionToken,
      'x-mobile-client': 'true',
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      details: String(json?.error || json?.details || `HTTP ${res.status}`),
    };
  }

  return { ok: true };
}

/** @deprecated Use deactivateCustomerFcmPushTokens */
export const deactivateCustomerExpoPushTokens = deactivateCustomerFcmPushTokens;

export type PushOpenHandler = (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => void;

export function setupFcmNotificationHandlers(onOpen?: PushOpenHandler) {
  const messaging = getMessagingModule();
  if (!messaging) {
    return () => undefined;
  }

  if (Platform.OS === 'ios') {
    try {
      messaging().setForegroundNotificationPresentationOptions({
        alert: true,
        badge: true,
        sound: true,
      });
    } catch (e) {
      console.warn('[FCM] setForegroundNotificationPresentationOptions failed:', e);
    }
  }

  const unsubscribeForeground = messaging().onMessage(async (remoteMessage) => {
    trackEvent('push_notification_received', { source: 'foreground' });
    console.warn('[FCM] Foreground message received:', {
      title: remoteMessage.notification?.title,
      body: remoteMessage.notification?.body,
      data: remoteMessage.data,
      messageId: remoteMessage.messageId,
    });
    const data = remoteMessage.data || {};
    const kind = String(data.kind || '');
    if (kind === 'CALLER_ID') {
      const { emitCallerIdCard } = require('../components/telecaller/IncomingCallLeadOverlay');
      emitCallerIdCard({
        leadId: String(data.lead_id || ''),
        leadNumber: String(data.lead_number || ''),
        customerName: String(data.customer_name || ''),
        direction: String(data.direction || ''),
        sessionId: String(data.session_id || ''),
      });
      return;
    }
    if (Platform.OS === 'android') {
      // Android requires explicit local notification display for foreground messages.
      // iOS uses setForegroundNotificationPresentationOptions above.
      const { Alert } = require('react-native');
      const title = remoteMessage.notification?.title || 'MyFNG';
      const body = remoteMessage.notification?.body || '';
      Alert.alert(title, body);
    }
  });

  const unsubscribeOpened = messaging().onNotificationOpenedApp((remoteMessage) => {
    trackEvent('push_notification_opened', { source: 'background' });
    void trackPushEngagement(remoteMessage, 'open');
    if (remoteMessage?.data?.deep_link || remoteMessage?.data?.cta_url) {
      void trackPushEngagement(remoteMessage, 'click');
    }
    console.warn('[FCM] Notification opened app:', remoteMessage.messageId);
    onOpen?.(remoteMessage);
  });

  void messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (remoteMessage) {
        trackEvent('push_notification_opened', { source: 'quit' });
        void trackPushEngagement(remoteMessage, 'open');
        if (remoteMessage?.data?.deep_link || remoteMessage?.data?.cta_url) {
          void trackPushEngagement(remoteMessage, 'click');
        }
        console.warn('[FCM] App opened from notification:', remoteMessage.messageId);
        onOpen?.(remoteMessage);
      }
    });

  return () => {
    unsubscribeForeground();
    unsubscribeOpened();
  };
}

export function subscribeToFcmTokenRefresh(onToken: (token: string) => void) {
  const messaging = getMessagingModule();
  if (!messaging) {
    return () => undefined;
  }
  return messaging().onTokenRefresh(onToken);
}
