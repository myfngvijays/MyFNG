/**
 * Clear wallet transactions, reset balance, and suppress welcome bonus re-credit.
 *
 * Usage:
 *   node scripts/clearWalletHistoryByPhone.mjs --phone 9422082780 --dry-run
 *   node scripts/clearWalletHistoryByPhone.mjs --phone 9422082780 --execute
 *   node scripts/clearWalletHistoryByPhone.mjs --phones 9422082780,9308650188 --execute
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

async function findCustomerByPhone(supabase, phone) {
  const { data: exact } = await supabase
    .from('customers')
    .select('id, phone, full_name, created_at')
    .eq('phone', phone)
    .maybeSingle();
  if (exact?.id) return exact;

  const { data: fuzzy } = await supabase
    .from('customers')
    .select('id, phone, full_name, created_at')
    .or(`phone.eq.91${phone},phone.eq.+91${phone},phone.ilike.%${phone}`)
    .limit(1)
    .maybeSingle();
  return fuzzy || null;
}

async function ensureWalletAccount(supabase, customerId) {
  const { data: existing } = await supabase
    .from('wallet_accounts')
    .select('id, current_balance, lifetime_credited, lifetime_debited')
    .eq('customer_id', customerId)
    .maybeSingle();
  if (existing?.id) return existing;

  const { data, error } = await supabase
    .from('wallet_accounts')
    .insert({ customer_id: customerId, current_balance: 0 })
    .select('id, current_balance, lifetime_credited, lifetime_debited')
    .single();
  if (error || !data) throw error || new Error('Failed to create wallet account');
  return data;
}

async function suppressWelcomeBonus(supabase, customerId) {
  const { data: existingEvent } = await supabase
    .from('customer_analytics_events')
    .select('id')
    .eq('customer_id', customerId)
    .eq('event_name', 'welcome_bonus_suppressed')
    .limit(1)
    .maybeSingle();
  if (existingEvent?.id) {
    return { suppressed: false, reason: 'already_marked' };
  }

  await ensureWalletAccount(supabase, customerId);

  const { error: walletError } = await supabase
    .from('wallet_accounts')
    .update({
      welcome_bonus_suppressed: true,
      updated_at: new Date().toISOString(),
    })
    .eq('customer_id', customerId);
  if (
    walletError &&
    !String(walletError.message || '').includes('welcome_bonus_suppressed') &&
    !String(walletError.message || '').includes('column')
  ) {
    throw walletError;
  }

  const { error: eventError } = await supabase.from('customer_analytics_events').insert({
    customer_id: customerId,
    event_name: 'welcome_bonus_suppressed',
    event_group: 'wallet',
    properties: { reason: 'admin_wallet_history_clear' },
  });
  if (eventError) throw eventError;

  return { suppressed: true };
}

async function clearWalletHistory(supabase, customerId, execute) {
  const { data: wallet } = await supabase
    .from('wallet_accounts')
    .select('id, current_balance, lifetime_credited, lifetime_debited')
    .eq('customer_id', customerId)
    .maybeSingle();

  const { data: transactions, count } = await supabase
    .from('wallet_transactions')
    .select('id, transaction_type, amount, source, created_at, balance_after, idempotency_key, metadata', {
      count: 'exact',
    })
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  const preview = {
    wallet: wallet || null,
    transaction_count: count || 0,
    transactions: (transactions || []).slice(0, 20),
  };

  if (!execute) {
    return { dryRun: true, ...preview };
  }

  if ((transactions || []).length > 0) {
    const { error: deleteError } = await supabase
      .from('wallet_transactions')
      .delete()
      .eq('customer_id', customerId);
    if (deleteError) throw deleteError;
  }

  const now = new Date().toISOString();
  if (wallet?.id) {
    const { error: updateError } = await supabase
      .from('wallet_accounts')
      .update({
        current_balance: 0,
        lifetime_credited: 0,
        lifetime_debited: 0,
        updated_at: now,
      })
      .eq('id', wallet.id);
    if (updateError) throw updateError;
  }

  const suppress = await suppressWelcomeBonus(supabase, customerId);

  const { data: walletAfter } = await supabase
    .from('wallet_accounts')
    .select('id, current_balance, lifetime_credited, lifetime_debited')
    .eq('customer_id', customerId)
    .maybeSingle();

  const { count: txAfter } = await supabase
    .from('wallet_transactions')
    .select('id, amount, metadata', { count: 'exact' })
    .eq('customer_id', customerId);

  const { data: allTx } = await supabase
    .from('wallet_transactions')
    .select('id, amount, metadata')
    .eq('customer_id', customerId);

  const visibleCount = (allTx || []).filter((tx) => {
    const meta = tx.metadata && typeof tx.metadata === 'object' ? tx.metadata : {};
    return !(meta.hidden_from_history === true || meta.suppressed === true);
  }).length;

  return {
    cleared: true,
    deleted_transactions: count || 0,
    welcome_suppressed: suppress.suppressed === true,
    wallet_after: walletAfter || null,
    transactions_remaining: txAfter || 0,
    visible_transactions_remaining: visibleCount,
  };
}

async function runForPhone(supabase, phone, execute) {
  const customer = await findCustomerByPhone(supabase, phone);
  if (!customer?.id) throw new Error(`No customer found for ${phone}`);

  console.log(`\nPhone: ${phone}`);
  console.log(`Customer: ${customer.id} (${customer.full_name || 'no name'})`);

  const result = await clearWalletHistory(supabase, customer.id, execute);
  console.log('Result:', JSON.stringify(result, null, 2));
  return result;
}

async function main() {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const phoneArg = args[args.indexOf('--phone') + 1];
  const phonesArg = args[args.indexOf('--phones') + 1];
  const execute = args.includes('--execute');
  const dryRun = args.includes('--dry-run') || !execute;

  const phones = phonesArg
    ? phonesArg.split(',').map((p) => normalizePhone(p)).filter(Boolean)
    : phoneArg
      ? [normalizePhone(phoneArg)].filter(Boolean)
      : [];

  if (!phones.length) throw new Error('Pass --phone or --phones');
  if (!execute && !dryRun) throw new Error('Pass --dry-run or --execute');

  const supabaseUrl = envOr('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = envOr('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY');
  if (!supabaseUrl || !serviceKey) throw new Error('Missing Supabase env');

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`Mode: ${execute ? 'EXECUTE' : 'DRY-RUN'}`);

  for (const phone of phones) {
    await runForPhone(supabase, phone, execute);
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
