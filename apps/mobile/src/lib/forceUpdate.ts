import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { ENV } from '../config/environment';

export type ForceUpdateResult = {
  required: boolean;
  storeUrl?: string;
  message?: string;
  minVersion?: string;
  minBuild?: number;
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

export async function checkForceUpdate(): Promise<ForceUpdateResult> {
  if (__DEV__) {
    return { required: false };
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
    const response = await fetch(`${ENV.API_URL}/api/public/mobile-app/version?${query.toString()}`, {
      headers: {
        'x-mobile-client': 'true',
        'x-app-platform': platform,
        'x-app-version': version,
        'x-app-build': String(build),
      },
    });

    if (!response.ok) {
      return { required: false };
    }

    const json = await response.json().catch(() => ({}));
    if (!json?.force_update) {
      return { required: false };
    }

    return {
      required: true,
      storeUrl: String(json.store_url || ''),
      message: String(json.message || ''),
      minVersion: String(json.min_version || ''),
      minBuild: Number(json.min_build || 0),
    };
  } catch {
    return { required: false };
  }
}
