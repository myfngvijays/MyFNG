import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const META_ADS_TOKEN_KEY = 'meta_ads_access_token';
export const META_ADS_ACCOUNT_KEY = 'meta_ads_account_id';
export const META_ADS_APP_ID_KEY = 'meta_ads_app_id';

export type MetaAdsSettings = {
  accessToken: string;
  accountId: string;
  appId: string;
  fromEnv: boolean;
};

function maskSecret(value: string): string {
  const t = value.trim();
  if (!t) return '';
  if (t.length <= 6) return '••••';
  return `••••${t.slice(-4)}`;
}

export function normalizeAdAccountId(id: string): string {
  const t = String(id || '').trim();
  if (!t) return '';
  return t.startsWith('act_') ? t : `act_${t.replace(/^act_/i, '')}`;
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

async function writeSetting(
  key: string,
  value: string,
  description: string,
  userId?: string | null,
): Promise<void> {
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

export async function getMetaAdsSettings(): Promise<MetaAdsSettings> {
  const envToken = String(process.env.META_ADS_ACCESS_TOKEN || '').trim();
  const envAccount = normalizeAdAccountId(process.env.META_ADS_ACCOUNT_ID || '');
  const envAppId = String(process.env.META_ADS_APP_ID || '').trim();
  const dbToken = envToken ? '' : await readSetting(META_ADS_TOKEN_KEY);
  const dbAccount = envAccount ? '' : normalizeAdAccountId(await readSetting(META_ADS_ACCOUNT_KEY));
  const dbAppId = envAppId ? '' : await readSetting(META_ADS_APP_ID_KEY);
  return {
    accessToken: envToken || dbToken,
    accountId: envAccount || dbAccount,
    appId: envAppId || dbAppId,
    fromEnv: Boolean(envToken || envAccount),
  };
}

export async function saveMetaAdsSettings(
  input: { accessToken?: string; accountId?: string; appId?: string },
  userId?: string | null,
): Promise<MetaAdsSettings> {
  const current = await getMetaAdsSettings();
  if (current.fromEnv) {
    throw new Error('Meta Ads credentials come from server env (META_ADS_*). Change them there, not in this form.');
  }
  if (input.accessToken !== undefined) {
    const next = String(input.accessToken || '').trim();
    if (next) {
      await writeSetting(
        META_ADS_TOKEN_KEY,
        next,
        'Meta Marketing API access token (System User or long-lived)',
        userId,
      );
    }
  }
  if (input.accountId !== undefined) {
    await writeSetting(
      META_ADS_ACCOUNT_KEY,
      normalizeAdAccountId(input.accountId),
      'Default Meta Ad Account ID (act_…)',
      userId,
    );
  }
  if (input.appId !== undefined) {
    await writeSetting(META_ADS_APP_ID_KEY, String(input.appId || '').trim(), 'Meta App ID (optional)', userId);
  }
  return getMetaAdsSettings();
}

export async function metaAdsSettingsStatus() {
  const settings = await getMetaAdsSettings();
  return {
    has_token: Boolean(settings.accessToken),
    account_id: settings.accountId,
    app_id: settings.appId,
    from_env: settings.fromEnv,
    token_hint: maskSecret(settings.accessToken),
    ready: Boolean(settings.accessToken && settings.accountId),
  };
}
