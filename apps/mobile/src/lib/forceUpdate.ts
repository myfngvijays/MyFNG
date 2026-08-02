import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { ENV } from '../config/environment';

const SOFT_DISMISS_KEY = 'myfng_soft_update_dismissed_version';

export type ForceUpdateResult = {
  required: boolean;
  softAvailable: boolean;
  storeUrl?: string;
  message?: string;
  minVersion?: string;
  minBuild?: number;
  latestVersion?: string;
};

export function getInstalledAppVersion(): string {
  return (
    Constants.expoConfig?.version ||
    Constants.nativeAppVersion ||
    '0.0.0'
  );
}

export function getInstalledAppBuild(): number {
  const raw =
    Constants.nativeBuildVersion ||
    Constants.expoConfig?.ios?.buildNumber ||
    Constants.expoConfig?.android?.versionCode;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function dismissSoftUpdate(latestVersion: string): Promise<void> {
  try {
    await AsyncStorage.setItem(SOFT_DISMISS_KEY, latestVersion || '');
  } catch {
    // ignore
  }
}

async function wasSoftUpdateDismissed(latestVersion: string): Promise<boolean> {
  if (!latestVersion) return false;
  try {
    const dismissed = await AsyncStorage.getItem(SOFT_DISMISS_KEY);
    return dismissed === latestVersion;
  } catch {
    return false;
  }
}

export async function checkForceUpdate(): Promise<ForceUpdateResult> {
  if (__DEV__) {
    return { required: false, softAvailable: false };
  }

  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const version = getInstalledAppVersion();
  const build = getInstalledAppBuild();
  const query = new URLSearchParams({
    platform,
    version,
    build: String(build),
  });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2800);
    const response = await fetch(`${ENV.API_URL}/api/public/mobile-app/version?${query.toString()}`, {
      headers: {
        'x-mobile-client': 'true',
        'x-app-platform': platform,
        'x-app-version': version,
        'x-app-build': String(build),
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { required: false, softAvailable: false };
    }

    const json = await response.json().catch(() => ({}));
    const latestVersion = String(json.latest_version || json.min_version || '');
    const storeUrl = String(json.store_url || '');
    const message = String(json.message || '');

    if (json?.force_update) {
      return {
        required: true,
        softAvailable: false,
        storeUrl,
        message,
        minVersion: String(json.min_version || ''),
        minBuild: Number(json.min_build || 0),
        latestVersion,
      };
    }

    const softFromApi = Boolean(json?.soft_update || json?.update_available);
    if (softFromApi) {
      const dismissed = await wasSoftUpdateDismissed(latestVersion);
      if (!dismissed) {
        return {
          required: false,
          softAvailable: true,
          storeUrl,
          message:
            message ||
            'A new version of MyFNG is available. Update now for the latest features and fixes.',
          latestVersion,
        };
      }
    }

    return { required: false, softAvailable: false, latestVersion, storeUrl };
  } catch {
    return { required: false, softAvailable: false };
  }
}
