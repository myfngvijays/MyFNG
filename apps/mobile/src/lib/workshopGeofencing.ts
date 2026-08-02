import { Platform, Alert, Linking } from 'react-native';
import * as Location from 'expo-location';
import { getTaskManager } from './taskManagerSafe';
import { registerWorkshopGeofencingTask } from './workshopGeofencingTask';
import { apiFetch } from './api';
import { ENV } from '../config/environment';
import {
  MAX_WORKSHOP_GEOFENCE_REGIONS,
  WORKSHOP_GEOFENCE_TASK_NAME,
} from '../constants/workshopGeofence';

type GeofenceWorkshop = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

type GeofenceConfigResponse = {
  radius_m: number;
  max_regions: number;
  workshops: GeofenceWorkshop[];
};

export async function isWorkshopGeofencingSupported(): Promise<boolean> {
  try {
    const TaskManager = getTaskManager();
    if (!TaskManager) return false;
    return TaskManager.isTaskDefined(WORKSHOP_GEOFENCE_TASK_NAME);
  } catch {
    return false;
  }
}

async function requestGeofencePermissions(): Promise<{ ok: boolean; reason?: string }> {
  const servicesEnabled = await Location.hasServicesEnabledAsync().catch(() => true);
  if (!servicesEnabled) {
    return { ok: false, reason: 'Location services are turned off on your phone.' };
  }

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    return { ok: false, reason: 'Location permission is required for nearby workshop alerts.' };
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== 'granted') {
    return {
      ok: false,
      reason:
        Platform.OS === 'ios'
          ? 'Choose "Always Allow" location so MyFNG can detect when you are near a service center.'
          : 'Allow location "All the time" so MyFNG can detect when you are near a service center.',
    };
  }

  return { ok: true };
}

async function loadGeofenceConfig(): Promise<GeofenceConfigResponse | null> {
  try {
    const res = await fetch(`${ENV.API_URL}/api/public/workshop-geofences`, {
      headers: { 'x-mobile-client': 'true', 'X-App-Platform': Platform.OS },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !Array.isArray(json?.workshops)) return null;
    return {
      radius_m: Number(json.radius_m) || 750,
      max_regions: Number(json.max_regions) || MAX_WORKSHOP_GEOFENCE_REGIONS,
      workshops: json.workshops
        .map((w: any) => ({
          id: String(w.id),
          name: String(w.name || 'MyFNG Workshop'),
          latitude: Number(w.latitude),
          longitude: Number(w.longitude),
        }))
        .filter((w: GeofenceWorkshop) => Number.isFinite(w.latitude) && Number.isFinite(w.longitude)),
    };
  } catch {
    return null;
  }
}

function pickNearestWorkshops(
  workshops: GeofenceWorkshop[],
  latitude: number,
  longitude: number,
  maxRegions: number,
): GeofenceWorkshop[] {
  const ranked = workshops
    .map((workshop) => {
      const dLat = ((workshop.latitude - latitude) * Math.PI) / 180;
      const dLon = ((workshop.longitude - longitude) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((latitude * Math.PI) / 180) *
          Math.cos((workshop.latitude * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
      const distanceM = 6371000 * 2 * Math.asin(Math.sqrt(a));
      return { workshop, distanceM };
    })
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, maxRegions)
    .map((item) => item.workshop);

  return ranked.length > 0 ? ranked : workshops.slice(0, maxRegions);
}

export async function startWorkshopGeofencing(): Promise<{ ok: boolean; reason?: string; regions?: number }> {
  const TaskManager = getTaskManager();
  if (!TaskManager) {
    return {
      ok: false,
      reason: 'Background geofencing needs a new app build. Update MyFNG from the App Store or reinstall the dev build.',
    };
  }

  if (!TaskManager.isTaskDefined(WORKSHOP_GEOFENCE_TASK_NAME)) {
    registerWorkshopGeofencingTask();
  }

  if (!TaskManager.isTaskDefined(WORKSHOP_GEOFENCE_TASK_NAME)) {
    return { ok: false, reason: 'Geofencing is not available in this app build.' };
  }

  const permission = await requestGeofencePermissions();
  if (!permission.ok) return { ok: false, reason: permission.reason };

  const config = await loadGeofenceConfig();
  if (!config || config.workshops.length === 0) {
    return { ok: false, reason: 'No workshop locations are configured yet.' };
  }

  let latitude = 19.076;
  let longitude = 72.8777;
  try {
    const last = await Location.getLastKnownPositionAsync();
    const current =
      last ||
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    latitude = current.coords.latitude;
    longitude = current.coords.longitude;
  } catch {
    // Fall back to Mumbai center — regions still registered for travel later.
  }

  const selected = pickNearestWorkshops(
    config.workshops,
    latitude,
    longitude,
    config.max_regions || MAX_WORKSHOP_GEOFENCE_REGIONS,
  );

  const regions: Location.LocationRegion[] = selected.map((workshop) => ({
    identifier: workshop.id,
    latitude: workshop.latitude,
    longitude: workshop.longitude,
    radius: config.radius_m,
    notifyOnEnter: true,
    notifyOnExit: false,
  }));

  const started = await Location.hasStartedGeofencingAsync(WORKSHOP_GEOFENCE_TASK_NAME).catch(() => false);
  if (started) {
    await Location.stopGeofencingAsync(WORKSHOP_GEOFENCE_TASK_NAME);
  }

  await Location.startGeofencingAsync(WORKSHOP_GEOFENCE_TASK_NAME, regions);
  return { ok: true, regions: regions.length };
}

export async function stopWorkshopGeofencing(): Promise<void> {
  try {
    const started = await Location.hasStartedGeofencingAsync(WORKSHOP_GEOFENCE_TASK_NAME);
    if (started) await Location.stopGeofencingAsync(WORKSHOP_GEOFENCE_TASK_NAME);
  } catch {
    // ignore
  }
}

export async function syncWorkshopGeofencingPreference(enabled: boolean): Promise<{ ok: boolean; reason?: string }> {
  if (!enabled) {
    await stopWorkshopGeofencing();
    return { ok: true };
  }
  return startWorkshopGeofencing();
}

export async function reportForegroundWorkshopProximity(): Promise<void> {
  try {
    const pref = await apiFetch<{ enabled?: boolean }>('/api/customer/workshop-proximity/preferences');
    if (!pref?.enabled) return;

    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return;

    const servicesEnabled = await Location.hasServicesEnabledAsync().catch(() => true);
    if (!servicesEnabled) return;

    let position = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 }).catch(() => null);
    if (!position) {
      position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    }

    await apiFetch('/api/customer/workshop-proximity/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'foreground',
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        event_type: 'enter',
      }),
    });
  } catch {
    // Non-blocking
  }
}

export function showWorkshopGeofencePermissionAlert(reason?: string) {
  Alert.alert(
    'Nearby workshop alerts',
    reason || 'Location access is needed to detect when you are near a MyFNG service center.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ],
  );
}
