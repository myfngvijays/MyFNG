import { Platform, PermissionsAndroid } from 'react-native';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'myfng_fcm_push_token_v1';
export const PUSH_PLATFORM = 'FCM';

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

export function isPushConfigured(): boolean {
  return true;
}

/** @deprecated Use isPushConfigured */
export const isExpoPushConfigured = isPushConfigured;

async function requestNotificationPermission(): Promise<boolean> {
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

async function acquireFcmPushToken(): Promise<PushRegisterResult> {
  const permitted = await requestNotificationPermission();
  if (!permitted) {
    return { ok: false, reason: 'permission_denied' };
  }

  if (Platform.OS === 'ios') {
    await messaging().registerDeviceForRemoteMessages();
  }

  const token = await messaging().getToken();
  if (!token) return { ok: false, reason: 'no_token' };

  // Visible in `adb logcat` for local USB registration scripts (release + debug).
  console.warn('[MYFNG_FCM_TOKEN]', token);

  try {
    const prev = await AsyncStorage.getItem(STORAGE_KEY);
    if (prev !== token) {
      await AsyncStorage.setItem(STORAGE_KEY, token);
    }
  } catch {
    // ignore storage issues
  }

  return { ok: true, token };
}

/** Staff login (Supabase auth / users_login). */
export async function registerAndSyncFcmPushToken(userId: string): Promise<PushRegisterResult> {
  const acquired = await acquireFcmPushToken();
  if (!acquired.ok) return acquired;

  const now = new Date().toISOString();
  const { error } = await supabase.from('notification_devices').upsert(
    {
      user_id: userId,
      platform: PUSH_PLATFORM,
      token: acquired.token,
      is_active: true,
      last_seen_at: now,
    } as any,
    { onConflict: 'user_id,platform,token' },
  );

  if (error) return { ok: false, reason: 'db_error', details: error.message };
  return { ok: true, token: acquired.token };
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

  const deviceName = Platform.OS === 'ios' ? 'iOS' : 'Android';

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

  // Production API may still expect Expo tokens — register directly in Supabase.
  const { data: rpcData, error: rpcError } = await supabase.rpc('register_customer_fcm_token', {
    p_session_token: sessionToken,
    p_fcm_token: acquired.token,
    p_device_name: deviceName,
  });

  const rpc = rpcData as { ok?: boolean; error?: string } | null;
  if (!rpcError && rpc?.ok) {
    return { ok: true, token: acquired.token };
  }

  return {
    ok: false,
    reason: 'api_error',
    details: String(
      rpc?.error || rpcError?.message || json?.error || json?.details || `HTTP ${res.status}`,
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
  const unsubscribeForeground = messaging().onMessage(async (_remoteMessage) => {
    // Background/system tray handles most cases; foreground display is OS-dependent.
  });

  const unsubscribeOpened = messaging().onNotificationOpenedApp((remoteMessage) => {
    onOpen?.(remoteMessage);
  });

  void messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (remoteMessage) onOpen?.(remoteMessage);
    });

  return () => {
    unsubscribeForeground();
    unsubscribeOpened();
  };
}

export function subscribeToFcmTokenRefresh(onToken: (token: string) => void) {
  return messaging().onTokenRefresh(onToken);
}
