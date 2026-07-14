import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export type WhatsAppAgentsEnvConfigRecord = {
  config_key: string;
  openai_api_key: string;
  whatsapp_access_token: string;
  whatsapp_phone_number_id: string;
  whatsapp_api_url: string;
  cron_secret: string;
  telecrm_webhook_secret: string;
  use_db_credentials: boolean;
  admin_notes: string;
  updated_at?: string | null;
  updated_by?: string | null;
};

export type WhatsAppAgentsEnvConfigView = Omit<
  WhatsAppAgentsEnvConfigRecord,
  'openai_api_key' | 'whatsapp_access_token' | 'cron_secret' | 'telecrm_webhook_secret'
> & {
  openai_api_key_set: boolean;
  openai_api_key_masked: string;
  whatsapp_access_token_set: boolean;
  whatsapp_access_token_masked: string;
  cron_secret_set: boolean;
  cron_secret_masked: string;
  telecrm_webhook_secret_set: boolean;
  telecrm_webhook_secret_masked: string;
  credentials_source: 'database' | 'environment' | 'none';
  env_fallback: {
    openai_configured: boolean;
    whatsapp_configured: boolean;
    cron_configured: boolean;
    telecrm_configured: boolean;
    supabase_service_role_configured: boolean;
    supabase_url: string;
  };
};

export type ResolvedWhatsAppAgentsCredentials = {
  openai_api_key: string;
  whatsapp_access_token: string;
  whatsapp_phone_number_id: string;
  whatsapp_api_url: string;
  cron_secret: string;
  telecrm_webhook_secret: string;
  source: 'database' | 'environment' | 'none';
};

const SECRET_MASK = '•••••••••••••••••••• (saved — leave blank to keep)';

function maskSecret(value: string): string {
  if (!value?.trim()) return '';
  return SECRET_MASK;
}

export function getEnvWhatsAppAgentsDefaults() {
  const cronSecret = process.env.CRON_SECRET || process.env.NOTIFICATION_CRON_SECRET || '';
  const telecrmSecret = process.env.TELECRM_WEBHOOK_SECRET || '';
  const openaiKey = process.env.OPENAI_API_KEY || '';
  const waToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
  const waPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';

  return {
    openai_api_key: openaiKey,
    whatsapp_access_token: waToken,
    whatsapp_phone_number_id: waPhoneId,
    whatsapp_api_url: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v21.0',
    cron_secret: cronSecret,
    telecrm_webhook_secret: telecrmSecret,
    openai_configured: Boolean(openaiKey.trim()),
    whatsapp_configured: Boolean(waToken.trim() && waPhoneId.trim()),
    cron_configured: Boolean(cronSecret.trim()),
    telecrm_configured: Boolean(telecrmSecret.trim()),
    supabase_service_role_configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  };
}

function mergeWithDefaults(row: Partial<WhatsAppAgentsEnvConfigRecord> | null): WhatsAppAgentsEnvConfigRecord {
  const env = getEnvWhatsAppAgentsDefaults();
  return {
    config_key: 'default',
    openai_api_key: row?.openai_api_key || env.openai_api_key,
    whatsapp_access_token: row?.whatsapp_access_token || env.whatsapp_access_token,
    whatsapp_phone_number_id: row?.whatsapp_phone_number_id || env.whatsapp_phone_number_id,
    whatsapp_api_url: row?.whatsapp_api_url || env.whatsapp_api_url,
    cron_secret: row?.cron_secret || env.cron_secret,
    telecrm_webhook_secret: row?.telecrm_webhook_secret || env.telecrm_webhook_secret,
    use_db_credentials: row?.use_db_credentials ?? false,
    admin_notes: row?.admin_notes || '',
    updated_at: row?.updated_at,
    updated_by: row?.updated_by,
  };
}

let cachedResolved: ResolvedWhatsAppAgentsCredentials | null = null;
let cacheAt = 0;
const CACHE_MS = 30_000;

export function invalidateWhatsAppAgentsCredentialsCache(): void {
  cachedResolved = null;
  cacheAt = 0;
}

export function resolveActiveWhatsAppAgentsCredentials(
  config: WhatsAppAgentsEnvConfigRecord,
): ResolvedWhatsAppAgentsCredentials {
  const env = getEnvWhatsAppAgentsDefaults();

  if (process.env.NODE_ENV === 'development' && env.openai_configured && env.whatsapp_configured) {
    return {
      openai_api_key: env.openai_api_key,
      whatsapp_access_token: env.whatsapp_access_token,
      whatsapp_phone_number_id: env.whatsapp_phone_number_id,
      whatsapp_api_url: env.whatsapp_api_url,
      cron_secret: env.cron_secret,
      telecrm_webhook_secret: env.telecrm_webhook_secret || env.cron_secret,
      source: 'environment',
    };
  }

  const dbHasCreds = Boolean(
    config.openai_api_key?.trim() &&
      config.whatsapp_access_token?.trim() &&
      config.whatsapp_phone_number_id?.trim(),
  );

  if (config.use_db_credentials && dbHasCreds) {
    return {
      openai_api_key: config.openai_api_key.trim(),
      whatsapp_access_token: config.whatsapp_access_token.trim(),
      whatsapp_phone_number_id: config.whatsapp_phone_number_id.trim(),
      whatsapp_api_url: config.whatsapp_api_url?.trim() || env.whatsapp_api_url,
      cron_secret: config.cron_secret?.trim() || env.cron_secret,
      telecrm_webhook_secret:
        config.telecrm_webhook_secret?.trim() || env.telecrm_webhook_secret || config.cron_secret?.trim() || env.cron_secret,
      source: 'database',
    };
  }

  if (env.openai_configured || env.whatsapp_configured) {
    return {
      openai_api_key: env.openai_api_key,
      whatsapp_access_token: env.whatsapp_access_token,
      whatsapp_phone_number_id: env.whatsapp_phone_number_id,
      whatsapp_api_url: env.whatsapp_api_url,
      cron_secret: env.cron_secret,
      telecrm_webhook_secret: env.telecrm_webhook_secret || env.cron_secret,
      source: 'environment',
    };
  }

  return {
    openai_api_key: '',
    whatsapp_access_token: '',
    whatsapp_phone_number_id: '',
    whatsapp_api_url: env.whatsapp_api_url,
    cron_secret: env.cron_secret,
    telecrm_webhook_secret: env.telecrm_webhook_secret || env.cron_secret,
    source: 'none',
  };
}

export async function loadWhatsAppAgentsEnvConfig(): Promise<WhatsAppAgentsEnvConfigRecord> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return mergeWithDefaults(null);

  const { data } = await supabaseAdmin
    .from('whatsapp_agents_env_config')
    .select('*')
    .eq('config_key', 'default')
    .maybeSingle();

  return mergeWithDefaults((data as WhatsAppAgentsEnvConfigRecord | null) || null);
}

export async function loadWhatsAppAgentsEnvConfigView(): Promise<WhatsAppAgentsEnvConfigView> {
  const config = await loadWhatsAppAgentsEnvConfig();
  const env = getEnvWhatsAppAgentsDefaults();
  const active = resolveActiveWhatsAppAgentsCredentials(config);

  const {
    openai_api_key,
    whatsapp_access_token,
    cron_secret,
    telecrm_webhook_secret,
    ...rest
  } = config;

  return {
    ...rest,
    openai_api_key_set: Boolean(openai_api_key?.trim()),
    openai_api_key_masked: maskSecret(openai_api_key),
    whatsapp_access_token_set: Boolean(whatsapp_access_token?.trim()),
    whatsapp_access_token_masked: maskSecret(whatsapp_access_token),
    cron_secret_set: Boolean(cron_secret?.trim()),
    cron_secret_masked: maskSecret(cron_secret),
    telecrm_webhook_secret_set: Boolean(telecrm_webhook_secret?.trim()),
    telecrm_webhook_secret_masked: maskSecret(telecrm_webhook_secret),
    credentials_source: active.source,
    env_fallback: {
      openai_configured: env.openai_configured,
      whatsapp_configured: env.whatsapp_configured,
      cron_configured: env.cron_configured,
      telecrm_configured: env.telecrm_configured,
      supabase_service_role_configured: env.supabase_service_role_configured,
      supabase_url: env.supabase_url,
    },
  };
}

export async function getResolvedWhatsAppAgentsCredentials(
  force = false,
): Promise<ResolvedWhatsAppAgentsCredentials> {
  if (!force && cachedResolved && Date.now() - cacheAt < CACHE_MS) {
    return cachedResolved;
  }
  const config = await loadWhatsAppAgentsEnvConfig();
  cachedResolved = resolveActiveWhatsAppAgentsCredentials(config);
  cacheAt = Date.now();
  return cachedResolved;
}

export function getResolvedWhatsAppAgentsCredentialsSync(): ResolvedWhatsAppAgentsCredentials {
  if (cachedResolved) return cachedResolved;
  const env = getEnvWhatsAppAgentsDefaults();
  return {
    openai_api_key: env.openai_api_key,
    whatsapp_access_token: env.whatsapp_access_token,
    whatsapp_phone_number_id: env.whatsapp_phone_number_id,
    whatsapp_api_url: env.whatsapp_api_url,
    cron_secret: env.cron_secret,
    telecrm_webhook_secret: env.telecrm_webhook_secret || env.cron_secret,
    source: env.openai_configured || env.whatsapp_configured ? 'environment' : 'none',
  };
}

export function buildWhatsAppAgentsBootstrapPayload(): WhatsAppAgentsEnvConfigRecord {
  const env = getEnvWhatsAppAgentsDefaults();
  return {
    config_key: 'default',
    openai_api_key: env.openai_api_key,
    whatsapp_access_token: env.whatsapp_access_token,
    whatsapp_phone_number_id: env.whatsapp_phone_number_id,
    whatsapp_api_url: env.whatsapp_api_url,
    cron_secret: env.cron_secret,
    telecrm_webhook_secret: env.telecrm_webhook_secret,
    use_db_credentials: true,
    admin_notes:
      'Auto-filled from server .env. SUPABASE_SERVICE_ROLE_KEY remains in server env only (not stored here).',
  };
}

export async function saveWhatsAppAgentsEnvConfig(
  input: Partial<WhatsAppAgentsEnvConfigRecord> & {
    openai_api_key?: string;
    whatsapp_access_token?: string;
    cron_secret?: string;
    telecrm_webhook_secret?: string;
  },
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) return { ok: false, error: error || 'Admin client not configured' };

  const existing = await loadWhatsAppAgentsEnvConfig();

  const nextOpenAi =
    typeof input.openai_api_key === 'string' && input.openai_api_key.trim()
      ? input.openai_api_key.trim()
      : existing.openai_api_key;
  const nextWaToken =
    typeof input.whatsapp_access_token === 'string' && input.whatsapp_access_token.trim()
      ? input.whatsapp_access_token.trim()
      : existing.whatsapp_access_token;
  const nextCron =
    typeof input.cron_secret === 'string' && input.cron_secret.trim()
      ? input.cron_secret.trim()
      : existing.cron_secret;
  const nextTelecrm =
    typeof input.telecrm_webhook_secret === 'string' && input.telecrm_webhook_secret.trim()
      ? input.telecrm_webhook_secret.trim()
      : existing.telecrm_webhook_secret;

  const payload = {
    config_key: 'default',
    openai_api_key: nextOpenAi,
    whatsapp_access_token: nextWaToken,
    whatsapp_phone_number_id: String(input.whatsapp_phone_number_id ?? existing.whatsapp_phone_number_id).trim(),
    whatsapp_api_url: String(input.whatsapp_api_url ?? existing.whatsapp_api_url).trim() || 'https://graph.facebook.com/v21.0',
    cron_secret: nextCron,
    telecrm_webhook_secret: nextTelecrm,
    use_db_credentials: input.use_db_credentials ?? existing.use_db_credentials,
    admin_notes: String(input.admin_notes ?? existing.admin_notes).trim(),
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };

  const { error: upsertError } = await supabaseAdmin
    .from('whatsapp_agents_env_config')
    .upsert(payload, { onConflict: 'config_key' });

  if (upsertError) return { ok: false, error: upsertError.message };

  invalidateWhatsAppAgentsCredentialsCache();
  return { ok: true };
}
