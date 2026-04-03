import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'myfng_expo_push_token_v1';

function getExpoProjectId(): string | null {
  const anyConstants: any = Constants;
  return (
    anyConstants?.easConfig?.projectId ||
    anyConstants?.expoConfig?.extra?.eas?.projectId ||
    (process.env.EXPO_PUBLIC_EAS_PROJECT_ID as any) ||
    null
  );
}

export async function registerAndSyncExpoPushToken(userId: string) {
  // Configure how notifications are shown when app is foregrounded
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  // Android channel (required for reliable delivery/display)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0088E8',
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return { ok: false as const, reason: 'permission_denied' as const };

  const projectId = getExpoProjectId();
  // Expo SDK 49+ requires projectId explicitly.
  // If missing, skip token registration instead of calling with undefined (which logs a warning).
  if (!projectId) {
    return { ok: false as const, reason: 'missing_project_id' as const };
  }
  const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = tokenRes.data;
  if (!token) return { ok: false as const, reason: 'no_token' as const };

  // Avoid spamming DB if unchanged
  try {
    const prev = await AsyncStorage.getItem(STORAGE_KEY);
    if (prev === token) {
      // still update last_seen best-effort
    } else {
      await AsyncStorage.setItem(STORAGE_KEY, token);
    }
  } catch {
    // ignore storage issues
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('notification_devices')
    .upsert(
      {
        user_id: userId,
        platform: 'EXPO',
        token,
        is_active: true,
        last_seen_at: now,
      } as any,
      { onConflict: 'user_id,platform,token' }
    );

  if (error) return { ok: false as const, reason: 'db_error' as const, details: error.message };
  return { ok: true as const, token };
}


