/**
 * Remove mistaken duplicate membership records for a customer.
 * Keeps the live ACTIVE membership; deletes other expired/inactive rows (+ usage via CASCADE).
 *
 * Usage:
 *   node scripts/removeDuplicateMembershipsByPhone.mjs --phone 9004078555 --dry-run
 *   node scripts/removeDuplicateMembershipsByPhone.mjs --phone 9004078555 --execute
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

function isLive(row) {
  return (
    String(row.status || '').toUpperCase() === 'ACTIVE' &&
    new Date(String(row.ends_at || 0)).getTime() > Date.now()
  );
}

async function findCustomerByPhone(supabase, phone) {
  const { data: exact } = await supabase
    .from('customers')
    .select('id, phone, full_name')
    .eq('phone', phone)
    .maybeSingle();
  if (exact?.id) return exact;

  const { data: fuzzy } = await supabase
    .from('customers')
    .select('id, phone, full_name')
    .or(`phone.eq.91${phone},phone.eq.+91${phone},phone.ilike.%${phone}`)
    .limit(1)
    .maybeSingle();
  return fuzzy || null;
}

async function main() {
  loadEnvLocal();

  const args = process.argv.slice(2);
  const phoneArg = args.find((a) => a.startsWith('--phone='))?.split('=')[1]
    || (args.includes('--phone') ? args[args.indexOf('--phone') + 1] : null);
  const execute = args.includes('--execute');
  const dryRun = !execute;

  const phone = normalizePhone(phoneArg);
  if (!phone) {
    console.error('Usage: node scripts/removeDuplicateMembershipsByPhone.mjs --phone 9004078555 [--dry-run|--execute]');
    process.exit(1);
  }

  const url = envOr('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL');
  const key = envOr('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY');
  if (!url || !key) {
    console.error('Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const customer = await findCustomerByPhone(supabase, phone);
  if (!customer?.id) {
    console.error(`Customer not found for phone ${phone}`);
    process.exit(1);
  }

  console.log(`Customer: ${customer.full_name || 'Unknown'} (${customer.phone}) id=${customer.id}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}`);

  const { data: memberships, error } = await supabase
    .from('customer_memberships')
    .select('id, status, starts_at, ends_at, created_at, plan_id, source')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch memberships:', error.message);
    process.exit(1);
  }

  if (!memberships?.length) {
    console.log('No memberships found.');
    process.exit(0);
  }

  console.log(`Found ${memberships.length} membership record(s):`);
  for (const m of memberships) {
    console.log(
      `  - ${m.id} | ${m.status} | ${m.starts_at?.slice(0, 10)} → ${m.ends_at?.slice(0, 10)} | live=${isLive(m)} | source=${m.source || '-'}`,
    );
  }

  const liveRows = memberships.filter(isLive);
  if (liveRows.length === 0) {
    console.log('No live ACTIVE membership to keep. Aborting (manual review needed).');
    process.exit(1);
  }

  const keepId = liveRows[0].id;
  const toDelete = memberships.filter((m) => m.id !== keepId);

  if (!toDelete.length) {
    console.log('Nothing to delete — only one membership row exists.');
    process.exit(0);
  }

  console.log(`\nKeeping: ${keepId}`);
  console.log(`Deleting ${toDelete.length} duplicate/history row(s):`);
  for (const m of toDelete) {
    console.log(`  - ${m.id} (${m.status})`);
  }

  if (dryRun) {
    console.log('\nDry run complete. Re-run with --execute to apply.');
    process.exit(0);
  }

  for (const m of toDelete) {
    const { error: delErr } = await supabase.from('customer_memberships').delete().eq('id', m.id);
    if (delErr) {
      console.error(`Failed to delete ${m.id}:`, delErr.message);
      process.exit(1);
    }
    console.log(`Deleted ${m.id}`);
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
