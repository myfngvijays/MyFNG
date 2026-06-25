import { Alert } from 'react-native';
import { ENV } from '../config/environment';
import {
  deactivateCustomerExpoPushTokens,
  isExpoPushConfigured,
  registerCustomerExpoPushToken,
} from '../services/pushNotifications';

export type PushPreferenceSyncResult = {
  tokenRegistered: boolean;
  pushConfigured: boolean;
  permissionDenied: boolean;
};

export async function syncPushPreferenceAfterSave(
  enabled: boolean,
  sessionToken: string | null,
  apiUrl: string = ENV.API_URL,
): Promise<PushPreferenceSyncResult> {
  const pushConfigured = isExpoPushConfigured();

  if (!sessionToken) {
    return { tokenRegistered: false, pushConfigured, permissionDenied: false };
  }

  if (!enabled) {
    await deactivateCustomerExpoPushTokens(apiUrl, sessionToken);
    return { tokenRegistered: false, pushConfigured, permissionDenied: false };
  }

  const result = await registerCustomerExpoPushToken(apiUrl, sessionToken);
  if (result.ok) {
    return { tokenRegistered: true, pushConfigured: true, permissionDenied: false };
  }

  if (result.reason === 'permission_denied') {
    return { tokenRegistered: false, pushConfigured, permissionDenied: true };
  }

  return { tokenRegistered: false, pushConfigured, permissionDenied: false };
}

export function showPushPermissionAlert() {
  Alert.alert(
    'Notifications',
    'Please allow notifications in your phone settings to receive alerts.',
  );
}

export { isExpoPushConfigured };
