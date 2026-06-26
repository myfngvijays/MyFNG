import { Alert } from 'react-native';
import { ENV } from '../config/environment';
import {
  deactivateCustomerFcmPushTokens,
  isPushConfigured,
  registerCustomerFcmPushToken,
} from '../services/pushNotifications';

export type PushPreferenceSyncResult = {
  tokenRegistered: boolean;
  pushConfigured: boolean;
  permissionDenied: boolean;
  errorDetails?: string;
};

export async function syncPushPreferenceAfterSave(
  enabled: boolean,
  sessionToken: string | null,
  apiUrl: string = ENV.API_URL,
): Promise<PushPreferenceSyncResult> {
  const pushConfigured = isPushConfigured();

  if (!sessionToken) {
    return { tokenRegistered: false, pushConfigured, permissionDenied: false };
  }

  if (!enabled) {
    await deactivateCustomerFcmPushTokens(apiUrl, sessionToken);
    return { tokenRegistered: false, pushConfigured, permissionDenied: false };
  }

  const result = await registerCustomerFcmPushToken(apiUrl, sessionToken);
  if (result.ok) {
    return { tokenRegistered: true, pushConfigured: true, permissionDenied: false };
  }

  if (result.reason === 'permission_denied') {
    return { tokenRegistered: false, pushConfigured, permissionDenied: true };
  }

  return {
    tokenRegistered: false,
    pushConfigured,
    permissionDenied: false,
    errorDetails: result.details,
  };
}

export function showPushPermissionAlert() {
  Alert.alert(
    'Notifications',
    'Please allow notifications in your phone settings to receive alerts.',
  );
}

export function showPushRegistrationErrorAlert(details?: string) {
  Alert.alert(
    'Notifications',
    details
      ? `Could not register this device for push alerts.\n\n${details}`
      : 'Could not register this device for push alerts. Please try again.',
  );
}

export { isPushConfigured, isPushConfigured as isExpoPushConfigured };
