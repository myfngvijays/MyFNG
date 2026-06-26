import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export type PushFirebaseConfigRecord = {
  config_key: string;
  project_name: string;
  project_id: string;
  api_key: string;
  auth_domain: string;
  storage_bucket: string;
  messaging_sender_id: string;
  app_id: string;
  measurement_id: string;
  client_email: string;
  private_key: string;
  android_package: string;
  ios_bundle_id: string;
  android_default_channel: string;
  apns_environment: string;
  default_icon_url: string;
  push_enabled: boolean;
  android_enabled: boolean;
  ios_enabled: boolean;
  use_db_credentials: boolean;
  admin_notes: string;
  updated_at?: string | null;
  updated_by?: string | null;
};

export type PushFirebaseConfigView = Omit<PushFirebaseConfigRecord, 'private_key'> & {
  private_key_set: boolean;
  private_key_masked: string;
  credentials_source: 'database' | 'environment' | 'none';
  env_fallback: {
    project_id: string;
    client_email_masked: string;
    credentials_configured: boolean;
  };
};

function unquotePrivateKey(raw: string): string {
  const v = String(raw || '').trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1).replace(/\\n/g, '\n');
  }
  return v.replace(/\\n/g, '\n');
}

function maskEmail(email: string): string {
  const trimmed = String(email || '').trim();
  if (!trimmed.includes('@')) return trimmed ? '••••••••' : '';
  const [local, domain] = trimmed.split('@');
  return `${local.slice(0, 3)}•••@${domain}`;
}

function maskPrivateKey(key: string): string {
  if (!key?.trim()) return '';
  return '•••••••••••••••••••• (saved — leave blank to keep)';
}

export function getEnvFirebaseDefaults() {
  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || '';
  const privateKey = unquotePrivateKey(process.env.FIREBASE_PRIVATE_KEY || '');
  const jsonRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();

  let jsonConfigured = false;
  if (jsonRaw) {
    try {
      const parsed = JSON.parse(jsonRaw) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      jsonConfigured = Boolean(parsed.project_id && parsed.client_email && parsed.private_key);
    } catch {
      jsonConfigured = false;
    }
  }

  return {
    project_id: projectId,
    api_key: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    auth_domain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    storage_bucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messaging_sender_id: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    app_id: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    measurement_id: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
    client_email: clientEmail,
    private_key: privateKey,
    credentials_configured: jsonConfigured || Boolean(projectId && clientEmail && privateKey),
    client_email_masked: maskEmail(clientEmail),
  };
}

function mergeWithDefaults(row: Partial<PushFirebaseConfigRecord> | null): PushFirebaseConfigRecord {
  const env = getEnvFirebaseDefaults();
  return {
    config_key: 'default',
    project_name: row?.project_name || '',
    project_id: row?.project_id || env.project_id,
    api_key: row?.api_key || env.api_key,
    auth_domain: row?.auth_domain || env.auth_domain,
    storage_bucket: row?.storage_bucket || env.storage_bucket,
    messaging_sender_id: row?.messaging_sender_id || env.messaging_sender_id,
    app_id: row?.app_id || env.app_id,
    measurement_id: row?.measurement_id || env.measurement_id,
    client_email: row?.client_email || env.client_email,
    private_key: row?.private_key || env.private_key,
    android_package: row?.android_package || 'com.myfng.app',
    ios_bundle_id: row?.ios_bundle_id || 'com.myfng.app',
    android_default_channel: row?.android_default_channel || 'default',
    apns_environment: row?.apns_environment || 'production',
    default_icon_url: row?.default_icon_url || '',
    push_enabled: row?.push_enabled ?? true,
    android_enabled: row?.android_enabled ?? true,
    ios_enabled: row?.ios_enabled ?? true,
    use_db_credentials: row?.use_db_credentials ?? false,
    admin_notes: row?.admin_notes || '',
    updated_at: row?.updated_at,
    updated_by: row?.updated_by,
  };
}

export async function loadPushFirebaseConfig(): Promise<PushFirebaseConfigRecord> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return mergeWithDefaults(null);

  const { data } = await supabaseAdmin
    .from('push_firebase_config')
    .select('*')
    .eq('config_key', 'default')
    .maybeSingle();

  return mergeWithDefaults((data as PushFirebaseConfigRecord | null) || null);
}

export async function loadPushFirebaseConfigView(): Promise<PushFirebaseConfigView> {
  const config = await loadPushFirebaseConfig();
  const env = getEnvFirebaseDefaults();
  const dbHasCreds = Boolean(config.client_email?.trim() && config.private_key?.trim());
  const useDb = config.use_db_credentials && dbHasCreds;

  const { private_key, ...rest } = config;
  return {
    ...rest,
    private_key_set: Boolean(private_key?.trim()),
    private_key_masked: maskPrivateKey(private_key),
    credentials_source: useDb ? 'database' : env.credentials_configured ? 'environment' : 'none',
    env_fallback: {
      project_id: env.project_id,
      client_email_masked: env.client_email_masked,
      credentials_configured: env.credentials_configured,
    },
  };
}

export function resolveActiveFirebaseCredentials(config: PushFirebaseConfigRecord): {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  source: 'database' | 'environment' | 'none';
} {
  const env = getEnvFirebaseDefaults();

  if (config.use_db_credentials && config.client_email?.trim() && config.private_key?.trim()) {
    return {
      projectId: config.project_id || env.project_id,
      clientEmail: config.client_email.trim(),
      privateKey: unquotePrivateKey(config.private_key),
      source: 'database',
    };
  }

  const jsonRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonRaw) {
    try {
      const parsed = JSON.parse(jsonRaw) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        return {
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key,
          source: 'environment',
        };
      }
    } catch {
      // fall through
    }
  }

  if (env.project_id && env.client_email && env.private_key) {
    return {
      projectId: env.project_id,
      clientEmail: env.client_email,
      privateKey: env.private_key,
      source: 'environment',
    };
  }

  return { projectId: '', clientEmail: '', privateKey: '', source: 'none' };
}

export async function savePushFirebaseConfig(
  input: Partial<PushFirebaseConfigRecord> & { private_key?: string },
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) return { ok: false, error: error || 'Admin client not configured' };

  const existing = await loadPushFirebaseConfig();
  const nextPrivateKey =
    typeof input.private_key === 'string' && input.private_key.trim()
      ? unquotePrivateKey(input.private_key)
      : existing.private_key;

  const payload = {
    config_key: 'default',
    project_name: String(input.project_name ?? existing.project_name).trim(),
    project_id: String(input.project_id ?? existing.project_id).trim(),
    api_key: String(input.api_key ?? existing.api_key).trim(),
    auth_domain: String(input.auth_domain ?? existing.auth_domain).trim(),
    storage_bucket: String(input.storage_bucket ?? existing.storage_bucket).trim(),
    messaging_sender_id: String(input.messaging_sender_id ?? existing.messaging_sender_id).trim(),
    app_id: String(input.app_id ?? existing.app_id).trim(),
    measurement_id: String(input.measurement_id ?? existing.measurement_id).trim(),
    client_email: String(input.client_email ?? existing.client_email).trim(),
    private_key: nextPrivateKey,
    android_package: String(input.android_package ?? existing.android_package).trim() || 'com.myfng.app',
    ios_bundle_id: String(input.ios_bundle_id ?? existing.ios_bundle_id).trim() || 'com.myfng.app',
    android_default_channel:
      String(input.android_default_channel ?? existing.android_default_channel).trim() || 'default',
    apns_environment: String(input.apns_environment ?? existing.apns_environment).trim() || 'production',
    default_icon_url: String(input.default_icon_url ?? existing.default_icon_url).trim(),
    push_enabled: input.push_enabled ?? existing.push_enabled,
    android_enabled: input.android_enabled ?? existing.android_enabled,
    ios_enabled: input.ios_enabled ?? existing.ios_enabled,
    use_db_credentials: input.use_db_credentials ?? existing.use_db_credentials,
    admin_notes: String(input.admin_notes ?? existing.admin_notes).trim(),
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };

  const { error: upsertError } = await supabaseAdmin
    .from('push_firebase_config')
    .upsert(payload, { onConflict: 'config_key' });

  if (upsertError) {
    return { ok: false, error: upsertError.message };
  }

  await supabaseAdmin.from('system_settings').upsert(
    [
      {
        setting_key: 'push_notifications_enabled',
        setting_value: payload.push_enabled ? 'true' : 'false',
        setting_type: 'BOOLEAN',
        category: 'NOTIFICATIONS',
        description: 'Enable push notifications',
        default_value: 'true',
        is_editable: true,
      },
      {
        setting_key: 'fcm_android_default_channel',
        setting_value: payload.android_default_channel,
        setting_type: 'STRING',
        category: 'NOTIFICATIONS',
        description: 'Android FCM default notification channel id',
        default_value: 'default',
        is_editable: true,
      },
      {
        setting_key: 'fcm_apns_environment',
        setting_value: payload.apns_environment,
        setting_type: 'STRING',
        category: 'NOTIFICATIONS',
        description: 'APNs environment for iOS push',
        default_value: 'production',
        is_editable: true,
      },
    ],
    { onConflict: 'setting_key' },
  );

  return { ok: true };
}
