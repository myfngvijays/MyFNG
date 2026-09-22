import { Linking } from 'react-native';
import * as Location from 'expo-location';
import { withPermissionLock } from './permissionLock';

export type LocationAccess = {
  granted: boolean;
  canAskAgain: boolean;
};

export async function getLocationAccess(): Promise<LocationAccess> {
  const current = await Location.getForegroundPermissionsAsync();
  return {
    granted: current.status === 'granted',
    canAskAgain: current.canAskAgain !== false,
  };
}

export async function requestLocationAccess(): Promise<LocationAccess> {
  return withPermissionLock(async () => {
    const current = await Location.getForegroundPermissionsAsync();
    if (current.status === 'granted') {
      return { granted: true, canAskAgain: true };
    }
    if (current.status === 'denied' && current.canAskAgain === false) {
      return { granted: false, canAskAgain: false };
    }
    const next = await Location.requestForegroundPermissionsAsync();
    return {
      granted: next.status === 'granted',
      canAskAgain: next.canAskAgain !== false,
    };
  });
}

/** Notification first, then location — same order as Skip → Home. */
export async function ensureNotificationThenLocation(): Promise<{
  notification: boolean;
  location: boolean;
}> {
  return withPermissionLock(async () => {
    const { requestOsNotificationPermission } = await import('../services/pushNotifications');
    const notification = await requestOsNotificationPermission();
    const current = await Location.getForegroundPermissionsAsync();
    if (current.status === 'granted') {
      return { notification, location: true };
    }
    if (current.status === 'denied' && current.canAskAgain === false) {
      return { notification, location: false };
    }
    const next = await Location.requestForegroundPermissionsAsync();
    return { notification, location: next.status === 'granted' };
  });
}

export function openAppPermissionSettings() {
  void Linking.openSettings();
}
