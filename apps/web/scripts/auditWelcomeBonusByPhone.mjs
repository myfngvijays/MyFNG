/**
 * Read-only audit: welcome bonus state for phone(s).
 * Usage: node scripts/auditWelcomeBonusByPhone.mjs --phones 9152307030,9594294017
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WELCOME_SIGNUP_GRACE_MS = 24 * 60 * 60 * 1000;

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
  const { data: customer } = await supabase
    .from('customers')
    .select('id, phone, full_name, created_at')
    .eq('phone', phone)
    .maybeSingle();

  console.log(`\n=== ${phone} ===`);
  if (!customer) {
    console.log('Customer: NONE (next login = fresh signup → welcome bonus SHOULD credit if server has latest code)');
    return;
  }

  const createdAtMs = Date.parse(String(customer.created_at));
  const ageMin = Number.isFinite(createdAtMs)
    ? Math.round((Date.now() - createdAtMs) / 60000)
    : null;
  const withinGrace =
    Number.isFinite(createdAtMs) && createdAtMs >= Date.now() - WELCOME_SIGNUP_GRACE_MS;

  const { data: welcomeTx } = await supabase
    .from('wallet_transactions')
    .select('id, amount, created_at, idempotency_key')
    .eq('customer_id', customer.id)
    .eq('idempotency_key', `welcome:${customer.id}`)
    .maybeSingle();

  const { data: wallet } = await supabase
    .from('wallet_accounts')
    .select('current_balance, lifetime_credited')
    .eq('customer_id', customer.id)
    .maybeSingle();

  console.log(`Customer: ${customer.id} | ${customer.full_name || 'no name'}`);
  console.log(`Created: ${customer.created_at} (${ageMin} min ago)`);
  console.log(`Within 24h backfill window: ${withinGrace ? 'yes' : 'no'}`);
  console.log(`Welcome tx: ${welcomeTx ? `₹${welcomeTx.amount} at ${welcomeTx.created_at}` : 'NONE'}`);
  console.log(`Wallet balance: ₹${wallet?.current_balance ?? 0}`);

  if (welcomeTx) {
    console.log('Verdict: ALREADY got welcome bonus — re-login will NOT credit again (correct).');
  } else if (ageMin !== null && ageMin < 5) {
    console.log('Verdict: NEW account, no welcome tx yet — SHOULD get ₹1000 on login if production has fix deployed.');
  } else if (withinGrace) {
    console.log('Verdict: Same-day account without welcome tx — claim-welcome backfill MAY still credit.');
  } else {
    console.log('Verdict: EXISTING old account — welcome bonus will NOT credit (correct).');
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
  if (!phones.length) throw new Error('Pass --phones 9152307030,9594294017');

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  console.log('Welcome bonus audit (read-only)');
  for (const phone of phones) await auditPhone(supabase, phone);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
