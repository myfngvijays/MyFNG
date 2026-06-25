/**
 * Reverse an incorrectly credited welcome bonus for an existing customer.
 * Idempotent — safe to run more than once.
 *
 * Usage:
 *   node scripts/reverseWelcomeBonusByPhone.mjs --phone 8652710389 --dry-run
 *   node scripts/reverseWelcomeBonusByPhone.mjs --phone 8652710389 --execute
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WELCOME_SOURCE = 'WELCOME_BONUS';

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

async function findWelcomeCredit(supabase, customerId) {
  const welcomeKey = `welcome:${customerId}`;
  const { data: byKey } = await supabase
    .from('wallet_transactions')
    .select('id, amount, balance_after, created_at, expires_at, idempotency_key, metadata')
    .eq('customer_id', customerId)
    .eq('idempotency_key', welcomeKey)
    .eq('transaction_type', 'CREDIT')
    .maybeSingle();
  if (byKey) return byKey;

  const { data: rows } = await supabase
    .from('wallet_transactions')
    .select('id, amount, balance_after, created_at, expires_at, idempotency_key, metadata')
    .eq('customer_id', customerId)
    .eq('transaction_type', 'CREDIT')
    .eq('source', WELCOME_SOURCE)
    .order('created_at', { ascending: false })
    .limit(1);
  return rows?.[0] || null;
}

async function reverseWelcomeBonus(supabase, customerId, execute) {
  const reverseKey = `reverse:welcome:${customerId}`;

  const { data: existingReverse } = await supabase
    .from('wallet_transactions')
    .select('id, amount, balance_after, created_at')
    .eq('customer_id', customerId)
    .eq('idempotency_key', reverseKey)
    .maybeSingle();
  if (existingReverse) {
    return {
      reversed: false,
      reason: 'already_reversed',
      existingReverse,
    };
  }

  const welcomeCredit = await findWelcomeCredit(supabase, customerId);
  if (!welcomeCredit) {
    return { reversed: false, reason: 'no_welcome_credit' };
  }

  const { data: wallet, error: walletError } = await supabase
    .from('wallet_accounts')
    .select('id, current_balance, lifetime_credited, lifetime_debited')
    .eq('customer_id', customerId)
    .maybeSingle();
  if (walletError) throw new Error(walletError.message);
  if (!wallet?.id) return { reversed: false, reason: 'no_wallet_account' };

  const welcomeAmount = roundMoney(Number(welcomeCredit.amount || 0));
  const currentBalance = roundMoney(Number(wallet.current_balance || 0));
  if (welcomeAmount <= 0) {
    return { reversed: false, reason: 'invalid_welcome_amount', welcomeCredit };
  }

  const debitAmount = roundMoney(Math.min(welcomeAmount, currentBalance));
  if (debitAmount <= 0) {
    return {
      reversed: false,
      reason: 'insufficient_balance',
      welcomeCredit,
      currentBalance,
      welcomeAmount,
    };
  }

  const nextBalance = roundMoney(currentBalance - debitAmount);
  const partial = debitAmount < welcomeAmount;

  if (!execute) {
    return {
      reversed: false,
      dryRun: true,
      welcomeCredit,
      welcomeAmount,
      currentBalance,
      wouldDebit: debitAmount,
      nextBalance,
      partial,
    };
  }

  const now = new Date().toISOString();
  const { error: insertError } = await supabase.from('wallet_transactions').insert({
    wallet_account_id: wallet.id,
    customer_id: customerId,
    transaction_type: 'DEBIT',
    amount: debitAmount,
    balance_after: nextBalance,
    source: WELCOME_SOURCE,
    idempotency_key: reverseKey,
    metadata: {
      label: 'Welcome Bonus Reversed',
      description: 'Admin reversal — welcome bonus credited to existing customer by mistake',
      reversed_credit_id: welcomeCredit.id,
      welcome_amount: welcomeAmount,
      partial,
    },
  });
  if (insertError) {
    if (String(insertError.message || '').includes('duplicate') || String(insertError.code || '') === '23505') {
      return { reversed: false, reason: 'already_reversed' };
    }
    throw insertError;
  }

  const { error: updateError } = await supabase
    .from('wallet_accounts')
    .update({
      current_balance: nextBalance,
      lifetime_credited: roundMoney(Math.max(0, Number(wallet.lifetime_credited || 0) - debitAmount)),
      lifetime_debited: roundMoney(Number(wallet.lifetime_debited || 0) + debitAmount),
      updated_at: now,
    })
    .eq('id', wallet.id);
  if (updateError) throw updateError;

  return {
    reversed: true,
    welcomeCredit,
    debited: debitAmount,
    balanceAfter: nextBalance,
    partial,
  };
}

async function main() {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const phoneArg = args[args.indexOf('--phone') + 1];
  const phone = normalizePhone(phoneArg);
  const execute = args.includes('--execute');
  const dryRun = args.includes('--dry-run') || !execute;

  if (!phone) throw new Error('Pass --phone with 10-digit number');
  if (!execute && !dryRun) throw new Error('Pass --dry-run or --execute');

  const supabaseUrl = envOr('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = envOr('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY');
  if (!supabaseUrl || !serviceKey) throw new Error('Missing Supabase env');

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: customer, error } = await supabase
    .from('customers')
    .select('id, phone, full_name, created_at')
    .eq('phone', phone)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!customer?.id) throw new Error(`No customer found for ${phone}`);

  console.log(`Mode: ${execute ? 'EXECUTE' : 'DRY-RUN'}`);
  console.log(`Phone: ${phone}`);
  console.log(`Customer: ${customer.id} (${customer.full_name || 'no name'})`);
  console.log(`Created: ${customer.created_at || 'unknown'}`);

  const result = await reverseWelcomeBonus(supabase, customer.id, execute);
  console.log('Result:', JSON.stringify(result, null, 2));

  const { data: wallet } = await supabase
    .from('wallet_accounts')
    .select('current_balance, lifetime_credited, lifetime_debited')
    .eq('customer_id', customer.id)
    .maybeSingle();
  console.log('Wallet after:', wallet || { current_balance: 0 });

  if (execute && result.reversed) {
    console.log(`Reversed ₹${result.debited} welcome bonus for ${phone}.`);
    if (result.partial) {
      console.warn(
        `Partial reversal only (₹${result.debited} of welcome credit). Customer had already spent part of the bonus.`,
      );
    }
  } else if (dryRun && result.dryRun) {
    console.log(`Would reverse ₹${result.wouldDebit} (balance ${result.currentBalance} → ${result.nextBalance}).`);
    console.log('Run with --execute to apply.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
