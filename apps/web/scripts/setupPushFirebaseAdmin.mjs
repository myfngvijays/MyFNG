/**
 * One-time: bootstrap push_firebase_config from apps/web/.env.local
 * Usage: node scripts/setupPushFirebaseAdmin.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULTS = {
  project_name: 'MyFNG',
  project_id: 'myfng-d863c',
  auth_domain: 'myfng-d863c.firebaseapp.com',
  storage_bucket: 'myfng-d863c.firebasestorage.app',
  messaging_sender_id: '455279370834',
  android_package: 'com.myfng.app',
  ios_bundle_id: 'com.myfng.app',
  android_app_id: '1:455279370834:android:ae9e7dcf4df27191e7b58b',
  ios_app_id: '1:455279370834:ios:38d95771254f40a5e7b58b',
  android_default_channel: 'default',
  apns_environment: 'production',
  apns_key_id: 'W9XQWZPN59',
};

function loadEnvLocal() {
  const envPath = path.join(__dirname, '../.env.local');
  if (!fs.existsSync(envPath)) throw new Error('Missing apps/web/.env.local');
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

function unquoteKey(raw) {
  return String(raw || '').replace(/\\n/g, '\n').trim();
}

async function main() {
  loadEnvLocal();

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service role env');

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || '';
  const privateKey = unquoteKey(process.env.FIREBASE_PRIVATE_KEY);
  if (!clientEmail || !privateKey) {
    throw new Error('Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY in .env.local');
  }

  const payload = {
    config_key: 'default',
    project_name: DEFAULTS.project_name,
    project_id: process.env.FIREBASE_PROJECT_ID || DEFAULTS.project_id,
    api_key: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    auth_domain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || DEFAULTS.auth_domain,
    storage_bucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || DEFAULTS.storage_bucket,
    messaging_sender_id: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || DEFAULTS.messaging_sender_id,
    app_id: DEFAULTS.android_app_id,
    measurement_id: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
    client_email: clientEmail,
    private_key: privateKey,
    android_package: DEFAULTS.android_package,
    ios_bundle_id: DEFAULTS.ios_bundle_id,
    android_default_channel: DEFAULTS.android_default_channel,
    apns_environment: DEFAULTS.apns_environment,
    default_icon_url: '',
    push_enabled: true,
    android_enabled: true,
    ios_enabled: true,
    use_db_credentials: true,
    admin_notes: [
      'CLI bootstrap from setupPushFirebaseAdmin.mjs',
      `Android app: ${DEFAULTS.android_app_id}`,
      `iOS app: ${DEFAULTS.ios_app_id}`,
      `APNs Key ID (Firebase Console): ${DEFAULTS.apns_key_id}`,
    ].join('\n'),
    updated_at: new Date().toISOString(),
  };

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  let { error } = await supabase.from('push_firebase_config').upsert(payload, { onConflict: 'config_key' });

  if (error?.message?.includes('android_enabled') || error?.message?.includes('project_name')) {
    const {
      project_name: _pn,
      android_enabled: _ae,
      ios_enabled: _ie,
      ...legacyPayload
    } = payload;
    ({ error } = await supabase.from('push_firebase_config').upsert(legacyPayload, { onConflict: 'config_key' }));
  }

  if (error) throw new Error(error.message);

  await supabase.from('system_settings').upsert(
    [
      {
        setting_key: 'push_notifications_enabled',
        setting_value: 'true',
        setting_type: 'BOOLEAN',
        category: 'NOTIFICATIONS',
        description: 'Enable push notifications',
        default_value: 'true',
        is_editable: true,
      },
      {
        setting_key: 'fcm_android_default_channel',
        setting_value: DEFAULTS.android_default_channel,
        setting_type: 'STRING',
        category: 'NOTIFICATIONS',
        description: 'Android FCM default notification channel id',
        default_value: 'default',
        is_editable: true,
      },
      {
        setting_key: 'fcm_apns_environment',
        setting_value: DEFAULTS.apns_environment,
        setting_type: 'STRING',
        category: 'NOTIFICATIONS',
        description: 'APNs environment for iOS push',
        default_value: 'production',
        is_editable: true,
      },
    ],
    { onConflict: 'setting_key' },
  );

  console.log('✅ push_firebase_config saved');
  console.log(`   project_id: ${payload.project_id}`);
  console.log(`   client_email: ${payload.client_email}`);
  console.log(`   use_db_credentials: true`);
  console.log(`   push_enabled: true`);
  console.log('');
  console.log('Next: Firebase Console → upload APNs .p8 (Key ID W9XQWZPN59, Production environment)');
  console.log('Then: Admin → Firebase Settings → Test Connection');
}

main().catch((e) => {
  console.error('❌', e.message || e);
  process.exit(1);
});
