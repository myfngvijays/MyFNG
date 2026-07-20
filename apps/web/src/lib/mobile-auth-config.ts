import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { loadProductAnalyticsConfig } from '@/lib/analytics/productAnalyticsConfig';

export const MOBILE_SMS_OTP_SETTING_KEY = 'mobile_sms_otp_enabled';

export const DEFAULT_SMS_OTP_DISABLED_MESSAGE =
  'SMS OTP is currently not working. Please use WhatsApp OTP instead.';

export type MobileAppPlatform = 'android' | 'ios';

export type MobileAppFirebaseConfig = {
  sms_otp_enabled: boolean;
  sms_otp_disabled_message: string;
  firebase_analytics_enabled: boolean;
};

export const DEFAULT_MOBILE_APP_FIREBASE_CONFIG: MobileAppFirebaseConfig = {
  sms_otp_enabled: false,
  sms_otp_disabled_message: DEFAULT_SMS_OTP_DISABLED_MESSAGE,
  firebase_analytics_enabled: true,
};

let cached: {
  value: Omit<MobileAppFirebaseConfig, 'firebase_analytics_enabled'>;
  expiresAt: number;
} | null = null;

function toBool(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

export function clearMobileAuthConfigCache() {
  cached = null;
}

export async function saveMobileSmsOtpEnabled(
  enabled: boolean,
  updatedBy?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { ok: false, error: 'Database admin client unavailable' };
  }

  const { error } = await supabaseAdmin.from('system_settings').upsert(
    {
      setting_key: MOBILE_SMS_OTP_SETTING_KEY,
      setting_value: enabled ? 'true' : 'false',
      setting_type: 'BOOLEAN',
      category: 'MOBILE_APP',
      description:
        'Allow SMS OTP login in Android/iOS app (Firebase Phone Auth). WhatsApp OTP is unaffected.',
      default_value: 'false',
      is_editable: true,
      updated_at: new Date().toISOString(),
      ...(updatedBy ? { updated_by: updatedBy } : {}),
    },
    { onConflict: 'setting_key' },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  clearMobileAuthConfigCache();
  return { ok: true };
}

async function loadSmsOtpSettings(
  supabaseAdmin?: any,
): Promise<Pick<MobileAppFirebaseConfig, 'sms_otp_enabled' | 'sms_otp_disabled_message'>> {
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  const admin = supabaseAdmin || getSupabaseAdmin().supabaseAdmin;
  if (!admin) {
    const fallback = {
      sms_otp_enabled: DEFAULT_MOBILE_APP_FIREBASE_CONFIG.sms_otp_enabled,
      sms_otp_disabled_message: DEFAULT_SMS_OTP_DISABLED_MESSAGE,
    };
    cached = { value: fallback, expiresAt: Date.now() + 30_000 };
    return fallback;
  }

  const { data } = await admin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', MOBILE_SMS_OTP_SETTING_KEY)
    .maybeSingle();

  const value = {
    sms_otp_enabled: toBool(
      data?.setting_value,
      DEFAULT_MOBILE_APP_FIREBASE_CONFIG.sms_otp_enabled,
    ),
    sms_otp_disabled_message: DEFAULT_SMS_OTP_DISABLED_MESSAGE,
  };

  cached = { value, expiresAt: Date.now() + 30_000 };
  return value;
}

/** @deprecated Use getMobileAppFirebaseConfig */
export async function getMobileAuthConfig(
  supabaseAdmin?: any,
): Promise<Pick<MobileAppFirebaseConfig, 'sms_otp_enabled' | 'sms_otp_disabled_message'>> {
  return loadSmsOtpSettings(supabaseAdmin);
}

export async function getMobileAppFirebaseConfig(
  platform: MobileAppPlatform,
  supabaseAdmin?: any,
): Promise<MobileAppFirebaseConfig> {
  const admin = supabaseAdmin || getSupabaseAdmin().supabaseAdmin;
  const [smsSettings, analyticsConfig] = await Promise.all([
    loadSmsOtpSettings(admin),
    loadProductAnalyticsConfig(admin),
  ]);

  return {
    ...smsSettings,
    firebase_analytics_enabled:
      analyticsConfig.platforms[platform].firebase_analytics_enabled,
  };
}
