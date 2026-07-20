import { Platform } from 'react-native';
import { ENV } from '../config/environment';

export const DEFAULT_SMS_OTP_DISABLED_MESSAGE =
  'SMS OTP is currently not working. Please use WhatsApp OTP instead.';

export type MobileAppFirebaseConfig = {
  sms_otp_enabled: boolean;
  sms_otp_disabled_message: string;
  firebase_analytics_enabled: boolean;
};

const DEFAULT_CONFIG: MobileAppFirebaseConfig = {
  sms_otp_enabled: false,
  sms_otp_disabled_message: DEFAULT_SMS_OTP_DISABLED_MESSAGE,
  firebase_analytics_enabled: true,
};

let cached: { value: MobileAppFirebaseConfig; expiresAt: number } | null = null;
const CACHE_MS = 30_000;

function readCachedConfig(): MobileAppFirebaseConfig {
  return cached?.value ?? DEFAULT_CONFIG;
}

export function clearMobileAuthConfigCache() {
  cached = null;
}

export async function fetchMobileAuthConfig(force = false): Promise<MobileAppFirebaseConfig> {
  if (!force && cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  try {
    const response = await fetch(`${ENV.API_URL}/api/public/mobile-app/auth-config`, {
      headers: {
        'x-mobile-client': 'true',
        'x-app-platform': Platform.OS,
      },
    });

    if (!response.ok) {
      return readCachedConfig();
    }

    const json = await response.json().catch(() => ({}));
    const value: MobileAppFirebaseConfig = {
      sms_otp_enabled: Boolean(json?.sms_otp_enabled),
      sms_otp_disabled_message: String(
        json?.sms_otp_disabled_message || DEFAULT_SMS_OTP_DISABLED_MESSAGE,
      ),
      firebase_analytics_enabled: json?.firebase_analytics_enabled !== false,
    };

    cached = { value, expiresAt: Date.now() + CACHE_MS };
    return value;
  } catch {
    return readCachedConfig();
  }
}

export function preloadMobileAuthConfig(): Promise<MobileAppFirebaseConfig> {
  return fetchMobileAuthConfig(false);
}

export function isSmsOtpEnabledSync(): boolean {
  return readCachedConfig().sms_otp_enabled;
}

export function isFirebaseAnalyticsEnabledSync(): boolean {
  return readCachedConfig().firebase_analytics_enabled;
}

export async function checkSmsOtpAllowed(): Promise<{ allowed: boolean; message: string }> {
  const config = await fetchMobileAuthConfig(true);
  return {
    allowed: config.sms_otp_enabled,
    message: config.sms_otp_disabled_message,
  };
}

export async function isFirebaseAnalyticsEnabled(): Promise<boolean> {
  const config = await fetchMobileAuthConfig(true);
  return config.firebase_analytics_enabled;
}
