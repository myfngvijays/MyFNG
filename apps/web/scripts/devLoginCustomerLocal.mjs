/**
 * Dev-only: create customer session + inject into debug APK via USB (no OTP needed).
 *
 * Usage:
 *   node scripts/devLoginCustomerLocal.mjs --phone 9594294017
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE = 'com.myfng.app';
const SESSION_KEY = 'customer_session_token';
const ADB = process.env.ADB_PATH || '/Users/abcom/Library/Android/sdk/platform-tools/adb';
const SESSION_DAYS = 30;

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
      let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');
  return createClient(url, key, { auth: { persistSession: false } });
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function adb(cmd) {
  return execSync(`"${ADB}" ${cmd}`, { encoding: 'utf8' }).trim();
}

function ensureDevice() {
  const lines = adb('devices').split('\n').slice(1).filter((l) => l.includes('\tdevice'));
  if (!lines.length) throw new Error('No Android device connected via USB');
}

function writeAsyncStorageKey(token) {
  const tmpDir = path.join(__dirname, '..', '.tmp-adb-storage');
  fs.mkdirSync(tmpDir, { recursive: true });
  const dbFile = path.join(tmpDir, 'RKStorage');
  if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);

  execSync(
    `sqlite3 "${dbFile}" "CREATE TABLE IF NOT EXISTS catalystLocalStorage (key TEXT PRIMARY KEY NOT NULL, value TEXT); INSERT OR REPLACE INTO catalystLocalStorage (key, value) VALUES ('${SESSION_KEY}', '${token.replace(/'/g, "''")}');"`,
    { stdio: 'ignore' },
  );

  const remote = '/data/local/tmp/myfng-RKStorage';
  execSync(`"${ADB}" push "${dbFile}" ${remote}`, { stdio: 'ignore' });
  execSync(`"${ADB}" shell run-as ${PACKAGE} mkdir -p databases`, { stdio: 'ignore' });
  execSync(`"${ADB}" shell run-as ${PACKAGE} cp ${remote} databases/RKStorage`, { stdio: 'ignore' });
  execSync(`"${ADB}" shell run-as ${PACKAGE} chmod 660 databases/RKStorage`, { stdio: 'ignore' });
}

async function main() {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const phoneIdx = args.indexOf('--phone');
  const phoneArg = phoneIdx >= 0 ? args[phoneIdx + 1] : null;
  const phone = phoneArg ? String(phoneArg).replace(/\D/g, '').slice(-10) : null;
  if (!phone || phone.length !== 10) throw new Error('Pass --phone 9594294017');

  ensureDevice();

  const supabase = getSupabase();
  let { data: customer } = await supabase
    .from('customers')
    .select('id, full_name, is_active')
    .or(`phone.eq.${phone},phone.eq.91${phone}`)
    .maybeSingle();

  if (!customer) {
    const { data: inserted, error } = await supabase
      .from('customers')
      .insert({
        phone,
        full_name: `User ${phone.slice(-4)}`,
        phone_verified: true,
        is_active: true,
        last_login_at: new Date().toISOString(),
      })
      .select('id, full_name, is_active')
      .single();
    if (error) throw new Error(error.message);
    customer = inserted;
    console.log('Created customer');
  }

  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error: sessionErr } = await supabase.from('customer_sessions').insert({
    customer_id: customer.id,
    token,
    expires_at: expiresAt,
    app_platform: 'ANDROID',
    user_agent: 'devLoginCustomerLocal',
  });
  if (sessionErr) throw new Error(sessionErr.message);

  writeAsyncStorageKey(token);
  try {
    adb(`shell monkey -p ${PACKAGE} -c android.intent.category.LAUNCHER 1`);
  } catch {
    // ignore
  }

  console.log(`✓ Dev login ready for ${phone} (${customer.full_name || 'no name'})`);
  console.log('✓ Session injected into debug APK — app relaunch ho chuki hai');
  console.log('\nAb phone par: Settings → Push Notifications → ON karo');
  console.log('Phir run: node scripts/registerFcmTokenLocal.mjs --phone ' + phone + ' --adb --send');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
