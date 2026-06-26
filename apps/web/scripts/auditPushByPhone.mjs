/**
 * Read-only: push notification readiness for customer phone(s).
 * Usage: node scripts/auditPushByPhone.mjs --phones 9619945926,8652710389
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const envPath = path.join(__dirname, '../.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

function normalizePhone(input) {
  return String(input || '').replace(/\D/g, '').slice(-10) || null;
}

async function auditPhone(supabase, phone) {
  console.log(`\n=== ${phone} ===`);

  const { data: customer } = await supabase
    .from('customers')
    .select('id, phone, full_name, last_login_at')
    .or(`phone.eq.${phone},phone.eq.91${phone}`)
    .maybeSingle();

  if (!customer) {
    console.log('Customer: NONE — admin test will say "No customer found"');
    return;
  }

  console.log(`Customer: ${customer.id} | ${customer.full_name || 'no name'}`);
  console.log(`Last login: ${customer.last_login_at || 'never'}`);

  const { data: prefs } = await supabase
    .from('customer_notification_preferences')
    .select('push_enabled, updated_at')
    .eq('customer_id', customer.id)
    .maybeSingle();

  const pushEnabled = prefs?.push_enabled !== false;
  console.log(`Push preference: ${pushEnabled ? 'ON' : 'OFF'}${prefs ? ` (updated ${prefs.updated_at})` : ' (default ON — no row)'}`);

  const { data: devices } = await supabase
    .from('notification_devices')
    .select('id, token, platform, is_active, device_name, last_seen_at')
    .eq('customer_id', customer.id)
    .eq('platform', 'FCM')
    .order('last_seen_at', { ascending: false });

  const active = (devices || []).filter((d) => d.is_active);
  console.log(`Active Expo devices: ${active.length} / ${(devices || []).length} total`);

  for (const d of active) {
    const preview = String(d.token || '').slice(0, 32);
    console.log(`  - ${d.device_name || 'device'} | ${preview}… | last_seen ${d.last_seen_at || '?'}`);
  }

  if (!pushEnabled) {
    console.log('Verdict: Push OFF in app settings — admin send will be blocked.');
  } else if (active.length === 0) {
    console.log('Verdict: No active push token — open app, login, allow notifications, keep Push ON in Settings.');
  } else {
    console.log('Verdict: Ready for admin test-by-phone (if backend deploy has latest send route).');
  }
}

async function main() {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const phonesArg = args[args.indexOf('--phones') + 1] || args[args.indexOf('--phone') + 1];
  const phones = String(phonesArg || '')
    .split(',')
    .map(normalizePhone)
    .filter(Boolean);
  if (!phones.length) throw new Error('Pass --phones 9619945926');

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  console.log('Push notification audit (read-only)');
  for (const phone of phones) await auditPhone(supabase, phone);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
