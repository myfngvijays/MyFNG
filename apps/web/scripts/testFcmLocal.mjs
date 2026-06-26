/**
 * Local FCM test — no VPS deploy needed.
 * Uses Firebase Admin from .env.local and optionally Supabase service role.
 *
 * Usage:
 *   node scripts/testFcmLocal.mjs
 *   node scripts/testFcmLocal.mjs --phone 9594294017
 *   node scripts/testFcmLocal.mjs --token <FCM_DEVICE_TOKEN>
 *   node scripts/testFcmLocal.mjs --phone 9594294017 --token <FCM_TOKEN> --register
 *   node scripts/testFcmLocal.mjs --phone 9594294017 --adb
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADB_PATHS = [
  process.env.ADB_PATH,
  '/Users/abcom/Library/Android/sdk/platform-tools/adb',
  'adb',
].filter(Boolean);
const PACKAGE = 'com.myfng.app';
const ASYNC_KEY = 'myfng_fcm_push_token_v1';

function unquoteEnvValue(value) {
  const v = String(value || '').trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

function loadEnvLocal() {
  for (const name of ['.env.local', '.env']) {
    const envPath = path.join(__dirname, '..', name);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i <= 0) continue;
      const k = t.slice(0, i).trim();
      const v = unquoteEnvValue(t.slice(i + 1));
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

function getFirebaseAdmin() {
  if (admin.apps.length) return admin.app();

  const jsonRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonRaw) {
    const parsed = JSON.parse(jsonRaw);
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key,
      }),
    });
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = unquoteEnvValue(process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase Admin env (FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY or FIREBASE_SERVICE_ACCOUNT_JSON)',
    );
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env (SUPABASE_SERVICE_ROLE_KEY)');
  return createClient(url, key, { auth: { persistSession: false } });
}

function resolveAdb() {
  for (const candidate of ADB_PATHS) {
    try {
      execSync(`"${candidate}" version`, { stdio: 'pipe' });
      return candidate;
    } catch {
      // try next
    }
  }
  return null;
}

function adbDevices(adb) {
  return execSync(`"${adb}" devices`, { encoding: 'utf8' }).trim();
}

function adbShell(adb, command) {
  return execSync(`"${adb}" shell ${command}`, { encoding: 'utf8' }).trim();
}

function readFcmTokenFromPhone() {
  const adb = resolveAdb();
  if (!adb) {
    throw new Error('adb not found — install Android platform-tools or set ADB_PATH');
  }

  const devices = adbDevices(adb).split('\n').slice(1).filter((line) => line.includes('\tdevice'));
  if (!devices.length) {
    throw new Error('No Android device connected — enable USB debugging and connect phone');
  }

  // AsyncStorage SQLite (RN async-storage)
  const dbPaths = [
    `/data/data/${PACKAGE}/databases/RKStorage`,
    `/data/data/${PACKAGE}/files/RKStorage`,
  ];

  for (const dbPath of dbPaths) {
    try {
      const hex = execSync(`"${adb}" exec-out "run-as ${PACKAGE} cat '${dbPath}'"`, {
        encoding: 'buffer',
        maxBuffer: 10 * 1024 * 1024,
      });
      if (!hex?.length) continue;

      const tmp = path.join(__dirname, '..', '.tmp-rkstorage.sqlite');
      fs.writeFileSync(tmp, hex);

      let token = '';
      try {
        token = execSync(
          `sqlite3 "${tmp}" "SELECT value FROM catalystLocalStorage WHERE key='${ASYNC_KEY}'"`,
          { encoding: 'utf8' },
        ).trim();
      } catch {
        // sqlite3 CLI missing — scan raw file for FCM token shape
        const raw = fs.readFileSync(tmp, 'utf8');
        const match = raw.match(/[a-zA-Z0-9_-]{20,}:[a-zA-Z0-9_-]{100,}/);
        token = match?.[0] || '';
      } finally {
        if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      }

      if (token.length >= 20) return token;
    } catch {
      // try next path
    }
  }

  // Fallback: scan recent logcat for FCM token pattern
  try {
    const log = adbShell(adb, 'logcat -d -t 500');
    const match = log.match(/[a-zA-Z0-9_-]{140,200}/g);
    if (match?.length) {
      const likely = match.find((t) => !t.includes('ExponentPushToken') && t.includes(':'));
      if (likely) return likely;
    }
  } catch {
    // ignore
  }

  throw new Error(
    'Could not read FCM token from phone. Open MyFNG → Settings → Push ON, then retry --adb',
  );
}

async function lookupCustomer(supabase, phone) {
  const { data: customer } = await supabase
    .from('customers')
    .select('id, phone, full_name')
    .or(`phone.eq.${phone},phone.eq.91${phone}`)
    .maybeSingle();
  return customer;
}

async function registerTokenForCustomer(supabase, customerId, token, deviceName = 'local-test') {
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from('notification_devices')
    .select('id')
    .eq('customer_id', customerId)
    .eq('platform', 'FCM')
    .eq('token', token)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from('notification_devices')
      .update({
        is_active: true,
        last_seen_at: now,
        device_name: deviceName,
        updated_at: now,
      })
      .eq('id', existing.id);
    if (error) throw new Error(`Register update failed: ${error.message}`);
    return 'updated';
  }

  const { error } = await supabase.from('notification_devices').insert({
    customer_id: customerId,
    user_id: null,
    platform: 'FCM',
    token,
    device_name: deviceName,
    is_active: true,
    last_seen_at: now,
  });
  if (error) throw new Error(`Register insert failed: ${error.message}`);
  return 'inserted';
}

async function sendTestPush(messaging, token, label = 'device') {
  console.log(`\nSending test push to ${label}...`);
  console.log(`  Token: ${token.slice(0, 24)}…${token.slice(-8)}`);
  try {
    const id = await messaging.send({
      token,
      notification: {
        title: 'MyFNG Local Test',
        body: `FCM test at ${new Date().toLocaleTimeString('en-IN')}`,
      },
      data: { type: 'LOCAL_TEST' },
      android: { notification: { channelId: 'default', sound: 'default' } },
    });
    console.log(`✓ Delivered to FCM — message id: ${id}`);
    return true;
  } catch (err) {
    console.error(`✗ Send failed: ${err?.code || ''} ${err?.message || err}`);
    return false;
  }
}

async function main() {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const phoneIdx = args.indexOf('--phone');
  const tokenIdx = args.indexOf('--token');
  const phoneArg = phoneIdx >= 0 ? args[phoneIdx + 1] : null;
  const tokenArg = tokenIdx >= 0 ? args[tokenIdx + 1] : null;
  const phone = phoneArg ? String(phoneArg).replace(/\D/g, '').slice(-10) : null;
  const register = args.includes('--register');
  const useAdb = args.includes('--adb');
  const skipCheck = args.includes('--skip-check');

  console.log('=== FCM local smoke test (no deploy) ===\n');

  const app = getFirebaseAdmin();
  const messaging = app.messaging();
  console.log('✓ Firebase Admin initialized');
  console.log(`  Project: ${app.options.projectId || process.env.FIREBASE_PROJECT_ID || 'unknown'}\n`);

  if (!skipCheck) {
    const fakeToken = 'fake-fcm-token-for-credential-check';
    try {
      await messaging.send({
        token: fakeToken,
        notification: { title: 'Test', body: 'Credential check' },
      });
      console.log('✗ Unexpected: fake token send succeeded');
    } catch (err) {
      const code = err?.code || err?.errorInfo?.code || 'unknown';
      const msg = err?.message || String(err);
      if (
        code === 'messaging/invalid-argument' ||
        code === 'messaging/registration-token-not-registered' ||
        msg.includes('registration token')
      ) {
        console.log('✓ FCM API reachable — credentials OK');
        console.log(`  Expected rejection: ${code}\n`);
      } else if (code === 'app/invalid-credential' || msg.includes('credential')) {
        console.error('✗ Firebase credentials invalid:', msg);
        process.exit(1);
      } else {
        console.log(`? FCM responded with: ${code} — ${msg}\n`);
      }
    }
  }

  let token = tokenIdx >= 0 && tokenArg ? String(tokenArg).trim() : null;

  if (!token && useAdb) {
    console.log('Reading FCM token from connected Android device...');
    token = readFcmTokenFromPhone();
    console.log(`✓ Got token from phone (${token.length} chars)\n`);
  }

  if (token && register && phone) {
    const supabase = getSupabase();
    const customer = await lookupCustomer(supabase, phone);
    if (!customer) {
      console.error(`No customer for phone ${phone}`);
      process.exit(1);
    }
    const action = await registerTokenForCustomer(supabase, customer.id, token, 'adb-local');
    console.log(`✓ Token ${action} in DB for ${phone} (${customer.full_name || 'no name'})\n`);
  }

  if (token) {
    await sendTestPush(messaging, token, register && phone ? phone : 'direct token');
    return;
  }

  if (phone) {
    const supabase = getSupabase();
    const customer = await lookupCustomer(supabase, phone);
    if (!customer) {
      console.log(`No customer for ${phone}`);
      return;
    }

    const { data: devices } = await supabase
      .from('notification_devices')
      .select('token, platform, last_seen_at, device_name')
      .eq('customer_id', customer.id)
      .eq('platform', 'FCM')
      .eq('is_active', true);

    console.log(`Customer ${phone} (${customer.full_name || 'no name'}):`);
    console.log(`  FCM devices: ${(devices || []).length}`);

    if (!devices?.length) {
      console.log('\n→ No FCM token in DB.');
      console.log('\nLocal test options (no VPS deploy):');
      console.log('  1) USB phone + Push ON in app:');
      console.log('       node scripts/testFcmLocal.mjs --phone ' + phone + ' --adb --register');
      console.log('  2) Paste token manually:');
      console.log('       node scripts/testFcmLocal.mjs --phone ' + phone + ' --token <FCM_TOKEN> --register');
      console.log('  3) Send only (skip DB):');
      console.log('       node scripts/testFcmLocal.mjs --token <FCM_TOKEN>');
      return;
    }

    for (const device of devices) {
      await sendTestPush(messaging, device.token, device.device_name || 'device');
    }
    return;
  }

  console.log('Tips:');
  console.log('  node scripts/testFcmLocal.mjs --phone 9594294017 --adb --register');
  console.log('  node scripts/testFcmLocal.mjs --token <FCM_TOKEN>');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
