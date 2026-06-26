/**
 * Register customer FCM token in DB (service role) — no VPS deploy needed.
 *
 * Usage:
 *   node scripts/registerFcmTokenLocal.mjs --phone 9594294017 --adb
 *   node scripts/registerFcmTokenLocal.mjs --phone 9594294017 --token <FCM_TOKEN>
 *   node scripts/registerFcmTokenLocal.mjs --phone 9594294017 --token <FCM_TOKEN> --send
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

function extractFcmTokenFromText(text) {
  const tagged = String(text || '').match(/\[MYFNG_FCM_TOKEN\]\s*([^\s]+)/);
  if (tagged?.[1] && tagged[1].length >= 20) return tagged[1].trim();

  const matches = String(text || '').match(/[a-zA-Z0-9_-]{10,}:[a-zA-Z0-9_-]{100,}/g) || [];
  return (
    matches.find(
      (token) =>
        !token.includes('ExponentPushToken') &&
        !token.includes('ExpoPushToken') &&
        token.length >= 120 &&
        token.length <= 4096,
    ) || null
  );
}

function sleep(ms) {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  if (process.platform === 'win32') {
    execSync(`timeout /t ${seconds}`, { stdio: 'ignore', shell: true });
  } else {
    execSync(`sleep ${seconds}`, { stdio: 'ignore' });
  }
}

function readFcmTokenFromLogcat(adb, waitMs = 15000) {
  console.log('Release APK detected — reading token from logcat...');
  console.log('→ Phone par MyFNG kholo → Settings → Push OFF → ON karo\n');

  execSync(`"${adb}" logcat -c`, { stdio: 'ignore' });
  try {
    execSync(`"${adb}" shell monkey -p ${PACKAGE} -c android.intent.category.LAUNCHER 1`, {
      stdio: 'ignore',
    });
  } catch {
    // app may already be open
  }

  sleep(waitMs);

  const log = execSync(`"${adb}" logcat -d -t 4000`, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });

  const token = extractFcmTokenFromText(log);
  if (token) return token;

  throw new Error(
    'FCM token not found in logcat. Open MyFNG → Settings → Push OFF → ON, then rerun with --adb',
  );
}

function canRunAsPackage(adb) {
  try {
    adbShell(adb, `run-as ${PACKAGE} ls`);
    return true;
  } catch {
    return false;
  }
}

function readFcmTokenFromPhone() {
  const adb = resolveAdb();
  if (!adb) throw new Error('adb not found — connect phone via USB or pass --token');

  const devices = adbDevices(adb)
    .split('\n')
    .slice(1)
    .filter((line) => line.includes('\tdevice'));
  if (!devices.length) {
    throw new Error('No Android device connected — enable USB debugging');
  }

  if (canRunAsPackage(adb)) {
    const dbPaths = [
      `/data/data/${PACKAGE}/databases/RKStorage`,
      `/data/data/${PACKAGE}/files/RKStorage`,
    ];

    let sawStorage = false;
    for (const dbPath of dbPaths) {
      try {
        const buf = execSync(`"${adb}" exec-out "run-as ${PACKAGE} cat '${dbPath}'"`, {
          encoding: 'buffer',
          maxBuffer: 10 * 1024 * 1024,
        });
        if (!buf?.length) continue;
        sawStorage = true;

        const tmp = path.join(__dirname, '..', '.tmp-rkstorage.sqlite');
        fs.writeFileSync(tmp, buf);

        let token = '';
        try {
          token = execSync(
            `sqlite3 "${tmp}" "SELECT value FROM catalystLocalStorage WHERE key='${ASYNC_KEY}'"`,
            { encoding: 'utf8' },
          ).trim();
        } catch {
          token = extractFcmTokenFromText(fs.readFileSync(tmp, 'utf8')) || '';
        } finally {
          if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
        }

        if (token.length >= 20) return token;
      } catch {
        // try next path
      }
    }

    if (!sawStorage) {
      throw new Error(
        'Debug APK installed — pehle app mein login karo (9594294017) aur Settings → Push ON karo, phir retry',
      );
    }
  }

  return readFcmTokenFromLogcat(adb);
}

async function lookupCustomer(supabase, phone) {
  const { data: customer, error } = await supabase
    .from('customers')
    .select('id, phone, full_name')
    .or(`phone.eq.${phone},phone.eq.91${phone}`)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return customer;
}

async function registerToken(supabase, customerId, token, deviceName = 'Android') {
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
    if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
  return 'inserted';
}

function getFirebaseMessaging() {
  if (admin.apps.length) return admin.app().messaging();

  const jsonRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonRaw) {
    const parsed = JSON.parse(jsonRaw);
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key,
      }),
    });
    return admin.app().messaging();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = unquoteEnvValue(process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin env for --send');
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
  return admin.app().messaging();
}

async function main() {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const phoneIdx = args.indexOf('--phone');
  const tokenIdx = args.indexOf('--token');
  const phoneArg = phoneIdx >= 0 ? args[phoneIdx + 1] : null;
  const tokenArg = tokenIdx >= 0 ? args[tokenIdx + 1] : null;
  const phone = phoneArg ? String(phoneArg).replace(/\D/g, '').slice(-10) : null;
  const useAdb = args.includes('--adb');
  const send = args.includes('--send');

  if (!phone) throw new Error('Pass --phone 9594294017');

  let token = tokenIdx >= 0 && tokenArg ? String(tokenArg).trim() : null;
  if (!token && useAdb) {
    console.log('Reading FCM token from phone...');
    token = readFcmTokenFromPhone();
    console.log(`✓ Token read (${token.length} chars)\n`);
  }
  if (!token) {
    throw new Error('Pass --token <FCM_TOKEN> or --adb with USB-connected phone');
  }

  const supabase = getSupabase();
  const customer = await lookupCustomer(supabase, phone);
  if (!customer) throw new Error(`No customer for ${phone}`);

  const action = await registerToken(supabase, customer.id, token, useAdb ? 'Android-usb' : 'Android-local');
  console.log(`✓ Token ${action} in notification_devices`);
  console.log(`  Customer: ${phone} (${customer.full_name || 'no name'})`);
  console.log(`  Token: ${token.slice(0, 24)}…${token.slice(-8)}`);

  const { data: devices } = await supabase
    .from('notification_devices')
    .select('id, platform, is_active, last_seen_at, device_name')
    .eq('customer_id', customer.id)
    .eq('platform', 'FCM')
    .eq('is_active', true);
  console.log(`  Active FCM devices: ${(devices || []).length}`);

  if (send) {
    const messaging = getFirebaseMessaging();
    const id = await messaging.send({
      token,
      notification: {
        title: 'MyFNG Local Test',
        body: `Registered + sent at ${new Date().toLocaleTimeString('en-IN')}`,
      },
      data: { type: 'LOCAL_TEST' },
      android: { notification: { channelId: 'default', sound: 'default' } },
    });
    console.log(`✓ Test push sent — message id: ${id}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
