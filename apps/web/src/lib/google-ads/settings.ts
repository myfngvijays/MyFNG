import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const GOOGLE_ADS_DEV_TOKEN_KEY = 'google_ads_developer_token';
export const GOOGLE_ADS_CUSTOMER_KEY = 'google_ads_customer_id';
export const GOOGLE_ADS_LOGIN_CUSTOMER_KEY = 'google_ads_login_customer_id';
export const GOOGLE_ADS_REFRESH_TOKEN_KEY = 'google_ads_refresh_token';

export type GoogleAdsSettings = {
  developerToken: string;
  customerId: string;
  loginCustomerId: string;
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  projectId: string;
  fromEnv: boolean;
};

function maskSecret(value: string): string {
  const t = value.trim();
  if (!t) return '';
  if (t.length <= 6) return '••••';
  return `••••${t.slice(-4)}`;
}

export function normalizeAdsCustomerId(id: string): string {
  return String(id || '').replace(/\D/g, '');
}

export function formatAdsCustomerId(id: string): string {
  const digits = normalizeAdsCustomerId(id);
  if (digits.length !== 10) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function googleOAuthClient() {
  return {
    clientId: String(
      process.env.GOOGLE_OAUTH_CLIENT_ID ||
        process.env.GOOGLE_CLIENT_ID ||
        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
        '',
    ).trim(),
    clientSecret: String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '').trim(),
  };
}

async function readSetting(key: string): Promise<string> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return '';
  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', key)
    .maybeSingle();
  return String((data as { setting_value?: string } | null)?.setting_value || '').trim();
}

async function writeSetting(key: string, value: string, description: string, userId?: string | null): Promise<void> {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error(error || 'Admin client unavailable');
  const { error: upErr } = await supabaseAdmin.from('system_settings').upsert(
    {
      setting_key: key,
      setting_value: value,
      setting_type: 'STRING',
      category: 'INTEGRATIONS',
      description,
      is_editable: true,
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'setting_key' },
  );
  if (upErr) throw new Error(upErr.message);
}

export async function getGoogleAdsSettings(): Promise<GoogleAdsSettings> {
  const oauth = googleOAuthClient();
  const envDev = String(process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '').trim();
  const envCustomer = normalizeAdsCustomerId(process.env.GOOGLE_ADS_CUSTOMER_ID || '');
  const envLogin = normalizeAdsCustomerId(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '');
  const envRefresh = String(process.env.GOOGLE_ADS_REFRESH_TOKEN || '').trim();
  const envProject = String(process.env.GOOGLE_ADS_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || '').trim();

  const dbDev = envDev ? '' : await readSetting(GOOGLE_ADS_DEV_TOKEN_KEY);
  const dbCustomer = envCustomer ? '' : normalizeAdsCustomerId(await readSetting(GOOGLE_ADS_CUSTOMER_KEY));
  const dbLogin = envLogin ? '' : normalizeAdsCustomerId(await readSetting(GOOGLE_ADS_LOGIN_CUSTOMER_KEY));
  const dbRefresh = envRefresh ? '' : await readSetting(GOOGLE_ADS_REFRESH_TOKEN_KEY);

  return {
    developerToken: envDev || dbDev,
    customerId: envCustomer || dbCustomer,
    loginCustomerId: envLogin || dbLogin,
    refreshToken: envRefresh || dbRefresh,
    clientId: oauth.clientId,
    clientSecret: oauth.clientSecret,
    projectId: envProject,
    fromEnv: Boolean(envDev || envCustomer || envRefresh),
  };
}

export async function saveGoogleAdsSettings(
  input: {
    developerToken?: string;
    customerId?: string;
    loginCustomerId?: string;
    refreshToken?: string;
  },
  userId?: string | null,
): Promise<GoogleAdsSettings> {
  if (process.env.GOOGLE_ADS_DEVELOPER_TOKEN && input.developerToken) {
    throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN is set in server env. Update it there, not in this form.');
  }
  if (process.env.GOOGLE_ADS_REFRESH_TOKEN && input.refreshToken) {
    throw new Error('GOOGLE_ADS_REFRESH_TOKEN is set in server env. Update it there, not in this form.');
  }
  if (input.developerToken !== undefined && String(input.developerToken).trim()) {
    await writeSetting(
      GOOGLE_ADS_DEV_TOKEN_KEY,
      String(input.developerToken).trim(),
      'Google Ads API developer token',
      userId,
    );
  }
  if (input.customerId !== undefined) {
    await writeSetting(
      GOOGLE_ADS_CUSTOMER_KEY,
      normalizeAdsCustomerId(input.customerId),
      'Google Ads customer ID (digits only)',
      userId,
    );
  }
  if (input.loginCustomerId !== undefined) {
    await writeSetting(
      GOOGLE_ADS_LOGIN_CUSTOMER_KEY,
      normalizeAdsCustomerId(input.loginCustomerId),
      'Google Ads MCC / login-customer-id',
      userId,
    );
  }
  if (input.refreshToken !== undefined && String(input.refreshToken).trim()) {
    await writeSetting(
      GOOGLE_ADS_REFRESH_TOKEN_KEY,
      String(input.refreshToken).trim(),
      'Google Ads OAuth refresh token (adwords scope)',
      userId,
    );
  }
  return getGoogleAdsSettings();
}

export async function googleAdsSettingsStatus() {
  const settings = await getGoogleAdsSettings();
  const ready = Boolean(
    settings.developerToken &&
      settings.customerId &&
      settings.refreshToken &&
      settings.clientId &&
      settings.clientSecret,
  );
  return {
    has_developer_token: Boolean(settings.developerToken),
    has_refresh_token: Boolean(settings.refreshToken),
    has_oauth_client: Boolean(settings.clientId && settings.clientSecret),
    customer_id: settings.customerId,
    customer_id_display: formatAdsCustomerId(settings.customerId),
    login_customer_id: settings.loginCustomerId,
    login_customer_id_display: formatAdsCustomerId(settings.loginCustomerId),
    project_id: settings.projectId,
    from_env: settings.fromEnv,
    developer_token_hint: maskSecret(settings.developerToken),
    refresh_token_hint: maskSecret(settings.refreshToken),
    ready,
  };
}
