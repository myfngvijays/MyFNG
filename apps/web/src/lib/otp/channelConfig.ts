import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { clearMobileAuthConfigCache, saveMobileSmsOtpEnabled } from '@/lib/mobile-auth-config';

export type OtpEmailSecure = 'tls' | 'ssl';

export type OtpChannelConfig = {
  sms_dlt: boolean;
  firebase: boolean;
  whatsapp: boolean;
  email: boolean;
  email_host: string;
  email_port: number;
  email_user: string;
  email_pass: string;
  email_secure: OtpEmailSecure;
  email_from: string;
  email_from_name: string;
};

const KEYS = {
  sms_dlt: 'otp_sms_dlt_enabled',
  whatsapp: 'otp_whatsapp_enabled',
  email: 'otp_email_enabled',
  firebase: 'mobile_sms_otp_enabled',
  email_host: 'otp_email_smtp_host',
  email_port: 'otp_email_smtp_port',
  email_user: 'otp_email_smtp_user',
  email_pass: 'otp_email_smtp_pass',
  email_secure: 'otp_email_smtp_secure',
  email_from: 'otp_email_from',
  email_from_name: 'otp_email_from_name',
} as const;

export const OTP_CHANNEL_DEFAULTS: OtpChannelConfig = {
  sms_dlt: false,
  firebase: false,
  whatsapp: true,
  email: false,
  email_host: '',
  email_port: 587,
  email_user: '',
  email_pass: '',
  email_secure: 'tls',
  email_from: 'noreply@myfng.in',
  email_from_name: 'MyFNG',
};

function toBool(value: unknown, fallback: boolean) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function rowValue(rows: Array<{ setting_key?: string; setting_value?: string | null }>, key: string) {
  return rows.find((row) => row.setting_key === key)?.setting_value;
}

export function emailOtpReady(config: OtpChannelConfig) {
  return Boolean(
    config.email &&
      config.email_host.trim() &&
      config.email_user.trim() &&
      config.email_pass.trim() &&
      config.email_from.trim(),
  );
}

export async function loadOtpChannelConfig(): Promise<OtpChannelConfig> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { ...OTP_CHANNEL_DEFAULTS };
  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('setting_key, setting_value')
    .in('setting_key', Object.values(KEYS));
  const rows = (data || []) as Array<{ setting_key?: string; setting_value?: string | null }>;
  const port = Number(rowValue(rows, KEYS.email_port) || OTP_CHANNEL_DEFAULTS.email_port);
  const secure = String(rowValue(rows, KEYS.email_secure) || '').toLowerCase() === 'ssl' ? 'ssl' : 'tls';
  return {
    sms_dlt: toBool(rowValue(rows, KEYS.sms_dlt), OTP_CHANNEL_DEFAULTS.sms_dlt),
    firebase: toBool(rowValue(rows, KEYS.firebase), OTP_CHANNEL_DEFAULTS.firebase),
    whatsapp: toBool(rowValue(rows, KEYS.whatsapp), OTP_CHANNEL_DEFAULTS.whatsapp),
    email: toBool(rowValue(rows, KEYS.email), OTP_CHANNEL_DEFAULTS.email),
    email_host: String(rowValue(rows, KEYS.email_host) || '').trim(),
    email_port: Number.isFinite(port) && port > 0 ? port : 587,
    email_user: String(rowValue(rows, KEYS.email_user) || '').trim(),
    email_pass: String(rowValue(rows, KEYS.email_pass) || ''),
    email_secure: secure,
    email_from: String(rowValue(rows, KEYS.email_from) || OTP_CHANNEL_DEFAULTS.email_from).trim(),
    email_from_name: String(rowValue(rows, KEYS.email_from_name) || OTP_CHANNEL_DEFAULTS.email_from_name).trim(),
  };
}

async function upsertSetting(
  db: any,
  key: string,
  value: string,
  type: 'BOOLEAN' | 'STRING' | 'NUMBER',
  description: string,
  updatedBy?: string | null,
) {
  const { error } = await db.from('system_settings').upsert(
    {
      setting_key: key,
      setting_value: value,
      setting_type: type,
      category: 'OTP',
      description,
      default_value: '',
      is_editable: true,
      updated_at: new Date().toISOString(),
      ...(updatedBy ? { updated_by: updatedBy } : {}),
    },
    { onConflict: 'setting_key' },
  );
  if (error) throw new Error(error.message);
}

export async function saveOtpChannelConfig(
  input: Partial<OtpChannelConfig> & { email_pass?: string },
  updatedBy?: string | null,
) {
  const current = await loadOtpChannelConfig();
  const next: OtpChannelConfig = {
    ...current,
    ...input,
    email_pass: input.email_pass && input.email_pass.trim() ? input.email_pass : current.email_pass,
    email_port: Number(input.email_port || current.email_port) || 587,
    email_secure: input.email_secure === 'ssl' ? 'ssl' : input.email_secure === 'tls' ? 'tls' : current.email_secure,
  };
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error('Database admin client unavailable');

  const firebase = await saveMobileSmsOtpEnabled(next.firebase, updatedBy);
  if (!firebase.ok) throw new Error(firebase.error);
  clearMobileAuthConfigCache();

  await upsertSetting(supabaseAdmin, KEYS.sms_dlt, next.sms_dlt ? 'true' : 'false', 'BOOLEAN', 'Send booking and login OTP by DLT SMS.', updatedBy);
  await upsertSetting(supabaseAdmin, KEYS.whatsapp, next.whatsapp ? 'true' : 'false', 'BOOLEAN', 'Send booking and login OTP on WhatsApp.', updatedBy);
  await upsertSetting(supabaseAdmin, KEYS.email, next.email ? 'true' : 'false', 'BOOLEAN', 'Send booking and login OTP by email.', updatedBy);
  await upsertSetting(supabaseAdmin, KEYS.email_host, next.email_host, 'STRING', 'SMTP host for OTP email.', updatedBy);
  await upsertSetting(supabaseAdmin, KEYS.email_port, String(next.email_port), 'NUMBER', 'SMTP port for OTP email.', updatedBy);
  await upsertSetting(supabaseAdmin, KEYS.email_user, next.email_user, 'STRING', 'SMTP username for OTP email.', updatedBy);
  if (input.email_pass && input.email_pass.trim()) {
    await upsertSetting(supabaseAdmin, KEYS.email_pass, input.email_pass, 'STRING', 'SMTP password for OTP email.', updatedBy);
  }
  await upsertSetting(supabaseAdmin, KEYS.email_secure, next.email_secure, 'STRING', 'SMTP security: tls or ssl.', updatedBy);
  await upsertSetting(supabaseAdmin, KEYS.email_from, next.email_from, 'STRING', 'From address for OTP email.', updatedBy);
  await upsertSetting(supabaseAdmin, KEYS.email_from_name, next.email_from_name, 'STRING', 'From name for OTP email.', updatedBy);
  return loadOtpChannelConfig();
}
