import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'myfng_expo_push_token_v1';

type PushRegisterFailure = {
  ok: false;
  reason: 'permission_denied' | 'missing_project_id' | 'no_token' | 'db_error' | 'api_error';
  details?: string;
};

type PushRegisterSuccess = {
  ok: true;
  token: string;
};

export type PushRegisterResult = PushRegisterSuccess | PushRegisterFailure;

export function isExpoPushConfigured(): boolean {
  return Boolean(getExpoProjectId());
}

function getExpoProjectId(): string | null {
  const anyConstants: any = Constants;
  return (
    anyConstants?.easConfig?.projectId ||
    anyConstants?.expoConfig?.extra?.eas?.projectId ||
    (process.env.EXPO_PUBLIC_EAS_PROJECT_ID as any) ||
    null
  );
}

async function configureNotificationPresentation() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0088E8',
    });
  }
}

async function acquireExpoPushToken(): Promise<PushRegisterResult> {
  await configureNotificationPresentation();

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') {
    return { ok: false, reason: 'permission_denied' };
  }

  const projectId = getExpoProjectId();
  if (!projectId) {
    return { ok: false, reason: 'missing_project_id' };
  }

  const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = tokenRes.data;
  if (!token) return { ok: false, reason: 'no_token' };

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

/** Staff login (Supabase auth / users_login) — existing path. */
export async function registerAndSyncExpoPushToken(userId: string): Promise<PushRegisterResult> {
  const acquired = await acquireExpoPushToken();
  if (!acquired.ok) return acquired;

  const now = new Date().toISOString();
  const { error } = await supabase.from('notification_devices').upsert(
    {
      user_id: userId,
      platform: 'EXPO',
      token: acquired.token,
      is_active: true,
      last_seen_at: now,
    } as any,
    { onConflict: 'user_id,platform,token' },
  );

  if (error) return { ok: false, reason: 'db_error', details: error.message };
  return { ok: true, token: acquired.token };
}

/** Customer app login (Firebase OTP + customer session) — registers via web API. */
export async function registerCustomerExpoPushToken(
  apiUrl: string,
  sessionToken: string,
): Promise<PushRegisterResult> {
  const acquired = await acquireExpoPushToken();
  if (!acquired.ok) return acquired;

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
      platform: 'EXPO',
      device_name: Platform.OS === 'ios' ? 'iOS' : 'Android',
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      reason: 'api_error',
      details: String(json?.error || json?.details || `HTTP ${res.status}`),
    };
  }

  return { ok: true, token: acquired.token };
}

export async function deactivateCustomerExpoPushTokens(
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
