// Environment configuration for MyFNG Mobile App
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const PRODUCTION_API_URL = 'https://myfng.in';

function isLocalhostUrl(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url);
}

/** Android emulator cannot reach host via localhost — use the special alias. */
function mapHostForPlatform(url: string): string {
  if (Platform.OS !== 'android') return url;
  if (!isLocalhostUrl(url)) return url;
  return url.replace(/localhost|127\.0\.0\.1/gi, '10.0.2.2');
}

function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '');

  // Release / TestFlight / Play Store: always production (never bundle localhost).
  if (!__DEV__) {
    if (fromEnv && !isLocalhostUrl(fromEnv)) return fromEnv;
    return PRODUCTION_API_URL;
  }

  // Dev: explicit override (e.g. test prod APIs while debugging).
  if (fromEnv) return mapHostForPlatform(fromEnv);

  // Dev default — local Next.js on simulator / emulator.
  if (Platform.OS === 'android') return 'http://10.0.2.2:3000';
  return 'http://localhost:3000';
}

const API_URL = resolveApiUrl();

export const ENV = {
  SUPABASE_URL:
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    'https://cffommijlvicfjhbqyzk.supabase.co',
  SUPABASE_ANON_KEY:
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmZm9tbWlqbHZpY2ZqaGJxeXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDkxNjYsImV4cCI6MjA3ODc4NTE2Nn0.2RqHX4BynIrH_R3HVZ9JYph03sdzkL6bYN644Yl4l1U',
  APP_URL: API_URL,
  API_URL,
  PLAYSTORE_URL: 'https://play.google.com/store/apps/details?id=com.myfng.app',
  APPSTORE_URL: 'https://apps.apple.com/in/app/myfng/id6744942498',
};

export function isIosSimulator(): boolean {
  if (Platform.OS !== 'ios') return false;
  return Boolean((Constants.platform as { ios?: { simulator?: boolean } })?.ios?.simulator);
}

export function isAndroidEmulator(): boolean {
  if (Platform.OS !== 'android') return false;
  const model = String(Constants.platform?.android?.model || '').toLowerCase();
  const brand = String(Constants.platform?.android?.brand || '').toLowerCase();
  const manufacturer = String(Constants.platform?.android?.manufacturer || '').toLowerCase();
  return (
    model.includes('sdk') ||
    model.includes('emulator') ||
    brand.includes('generic') ||
    manufacturer.includes('genymotion')
  );
}

export function isDevSimulator(): boolean {
  return __DEV__ && (isIosSimulator() || isAndroidEmulator());
}

if (__DEV__) {
  console.log('[MyFNG] API_URL =', ENV.API_URL, '| simulator =', isDevSimulator());
}
