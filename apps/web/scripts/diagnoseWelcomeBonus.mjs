/**
 * Diagnose why welcome bonus credit fails for a customer phone.
 * Usage: node scripts/diagnoseWelcomeBonus.mjs --phone 9619945926
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WELCOME_SOURCE = 'WELCOME_BONUS';
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

async function main() {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const phone = normalizePhone(args[args.indexOf('--phone') + 1]);
  if (!phone) throw new Error('Pass --phone 9619945926');

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: customer } = await supabase
    .from('customers')
    .select('id, phone, created_at')
    .eq('phone', phone)
    .maybeSingle();

  if (!customer?.id) {
    console.log('No customer for', phone);
    return;
  }

  console.log('Customer:', customer.id, customer.created_at);

  const createdAtMs = Date.parse(String(customer.created_at));
  const withinGrace = Number.isFinite(createdAtMs) && createdAtMs >= Date.now() - WELCOME_SIGNUP_GRACE_MS;
  console.log('Within grace:', withinGrace);

  const idempotencyKey = `welcome:${customer.id}`;
  const { data: existingTx } = await supabase
    .from('wallet_transactions')
    .select('id')
    .eq('customer_id', customer.id)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  console.log('Existing welcome tx:', existingTx?.id || 'NONE');

  let { data: wallet } = await supabase
    .from('wallet_accounts')
    .select('id, current_balance')
    .eq('customer_id', customer.id)
    .maybeSingle();

  if (!wallet) {
    console.log('No wallet account — creating...');
    const { data: created, error: createErr } = await supabase
      .from('wallet_accounts')
      .insert({ customer_id: customer.id, current_balance: 0 })
      .select('id, current_balance')
      .single();
    if (createErr) {
      console.error('Wallet create FAILED:', createErr.code, createErr.message, createErr.details);
      return;
    }
    wallet = created;
    console.log('Wallet created:', wallet.id);
  } else {
    console.log('Wallet:', wallet.id, 'balance', wallet.current_balance);
  }

  const amount = 1000;
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const nextBalance = Math.round((Number(wallet.current_balance || 0) + amount) * 100) / 100;

  console.log('Attempting welcome tx insert (dry run will rollback if --execute not passed)...');
  const { data: inserted, error: insertErr } = await supabase
    .from('wallet_transactions')
    .insert({
      wallet_account_id: wallet.id,
      customer_id: customer.id,
      transaction_type: 'CREDIT',
      amount,
      balance_after: nextBalance,
      source: WELCOME_SOURCE,
      idempotency_key: idempotencyKey,
      expires_at: expiresAt,
      metadata: { label: 'Welcome Bonus Credited', description: 'Diagnostic test' },
    })
    .select('id, amount')
    .single();

  if (insertErr) {
    console.error('INSERT FAILED:');
    console.error('  code:', insertErr.code);
    console.error('  message:', insertErr.message);
    console.error('  details:', insertErr.details);
    console.error('  hint:', insertErr.hint);
    return;
  }

  console.log('INSERT OK:', inserted);

  if (!args.includes('--execute')) {
    console.log('Rolling back diagnostic insert...');
    await supabase.from('wallet_transactions').delete().eq('id', inserted.id);
    console.log('Rolled back. Re-run with --execute to keep credit.');
    return;
  }

  await supabase
    .from('wallet_accounts')
    .update({ current_balance: nextBalance, updated_at: new Date().toISOString() })
    .eq('id', wallet.id);
  console.log('Wallet updated to', nextBalance);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
