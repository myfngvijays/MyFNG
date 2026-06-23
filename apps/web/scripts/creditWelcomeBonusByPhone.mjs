/**
 * Credit welcome bonus for a customer phone (idempotent).
 *
 * Usage:
 *   node scripts/creditWelcomeBonusByPhone.mjs --phone 9594294017
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WELCOME_SOURCE = 'WELCOME_BONUS';
const DEFAULT_AMOUNT = 1000;
const DEFAULT_EXPIRY_DAYS = 90;

function loadEnvLocal() {
  const envPath = path.join(__dirname, '../.env.local');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function normalizePhone(input) {
  return String(input || '').replace(/\D/g, '').slice(-10) || null;
}

function envOr(...names) {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  return '';
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

async function readWelcomeConfig(supabase) {
  const keys = ['wallet_welcome_bonus_amount', 'wallet_welcome_expiry_days'];
  const { data } = await supabase.from('system_settings').select('setting_key, setting_value').in('setting_key', keys);
  const map = new Map((data || []).map((row) => [row.setting_key, row.setting_value]));
  const amountRaw = Number(map.get('wallet_welcome_bonus_amount'));
  const expiryRaw = Number(map.get('wallet_welcome_expiry_days'));
  return {
    amount: Number.isFinite(amountRaw) && amountRaw > 0 ? amountRaw : DEFAULT_AMOUNT,
    expiryDays: Number.isFinite(expiryRaw) && expiryRaw > 0 ? expiryRaw : DEFAULT_EXPIRY_DAYS,
  };
}

async function ensureWalletAccount(supabase, customerId) {
  const { data: existing } = await supabase
    .from('wallet_accounts')
    .select('id, current_balance, lifetime_credited, lifetime_debited')
    .eq('customer_id', customerId)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await supabase
    .from('wallet_accounts')
    .insert({ customer_id: customerId, current_balance: 0 })
    .select('id, current_balance, lifetime_credited, lifetime_debited')
    .single();
  if (error || !data) throw new Error(`Failed to create wallet account: ${error?.message || 'unknown'}`);
  return data;
}

async function creditWelcomeBonus(supabase, customerId) {
  const idempotencyKey = `welcome:${customerId}`;
  const { data: existing } = await supabase
    .from('wallet_transactions')
    .select('id')
    .eq('customer_id', customerId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  if (existing) return { credited: false, reason: 'already_credited' };

  const config = await readWelcomeConfig(supabase);
  const wallet = await ensureWalletAccount(supabase, customerId);
  const amount = config.amount;
  const expiresAt = new Date(Date.now() + config.expiryDays * 24 * 60 * 60 * 1000);
  const nextBalance = roundMoney(Number(wallet.current_balance || 0) + amount);

  const { error } = await supabase.from('wallet_transactions').insert({
    wallet_account_id: wallet.id,
    customer_id: customerId,
    transaction_type: 'CREDIT',
    amount,
    balance_after: nextBalance,
    source: WELCOME_SOURCE,
    idempotency_key: idempotencyKey,
    expires_at: expiresAt.toISOString(),
    metadata: {
      label: 'Welcome Bonus Credited',
      description: 'New app install welcome bonus',
    },
  });
  if (error) {
    if (String(error.message || '').includes('duplicate') || String(error.code || '') === '23505') {
      return { credited: false, reason: 'already_credited' };
    }
    throw error;
  }

  await supabase
    .from('wallet_accounts')
    .update({
      current_balance: nextBalance,
      lifetime_credited: roundMoney(Number(wallet.lifetime_credited || 0) + amount),
      updated_at: new Date().toISOString(),
    })
    .eq('id', wallet.id);

  return { credited: true, amount, expires_at: expiresAt.toISOString() };
}

async function main() {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const phoneArg = args[args.indexOf('--phone') + 1];
  const phone = normalizePhone(phoneArg);
  if (!phone) throw new Error('Pass --phone with 10-digit number');

  const supabaseUrl = envOr('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = envOr('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY');
  if (!supabaseUrl || !serviceKey) throw new Error('Missing Supabase env');

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: customer, error } = await supabase
    .from('customers')
    .select('id, phone, full_name')
    .eq('phone', phone)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!customer?.id) throw new Error(`No customer found for ${phone}`);

  const result = await creditWelcomeBonus(supabase, customer.id);
  console.log(`Phone: ${phone}`);
  console.log(`Customer: ${customer.id} (${customer.full_name || 'no name'})`);
  console.log('Result:', result);

  const { data: wallet } = await supabase
    .from('wallet_accounts')
    .select('current_balance, lifetime_credited')
    .eq('customer_id', customer.id)
    .maybeSingle();
  console.log('Wallet balance:', wallet?.current_balance ?? 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
