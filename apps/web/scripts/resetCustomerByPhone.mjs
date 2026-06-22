/**
 * Fully reset a customer phone so next login is treated as brand new.
 *
 * Usage:
 *   node scripts/resetCustomerByPhone.mjs --phone 9867070586 --dry-run
 *   node scripts/resetCustomerByPhone.mjs --phone 9867070586 --execute
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
  const digits = String(input || '').replace(/\D/g, '').slice(-10);
  return digits || null;
}

function envOr(...names) {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  return '';
}

const LEAD_CHILD_TABLES = [
  'lead_status_history',
  'lead_activities',
  'lead_events',
  'lead_assignments_history',
  'lead_pricing_items',
  'telecaller_call_logs',
  'telecaller_follow_ups',
  'pickup_delivery_tasks',
  'pickup_incidents',
  'pickup_location_tracking',
  'pickup_otps',
  'vehicle_condition_photos',
  'job_cards',
  'payment_transactions',
  'refund_requests',
  'customer_complaints',
  'invoices',
];

async function deleteByCustomerId(supabase, customerId, table, column = 'customer_id') {
  const { error, count } = await supabase.from(table).delete({ count: 'exact' }).eq(column, customerId);
  if (error && !String(error.message || '').includes('does not exist')) {
    console.warn(`  warn ${table}: ${error.message}`);
    return 0;
  }
  return count || 0;
}

async function main() {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const phoneArg = args[args.indexOf('--phone') + 1];
  const execute = args.includes('--execute');
  const dryRun = !execute;

  const phone = normalizePhone(phoneArg);
  if (!phone) throw new Error('Pass --phone with 10-digit number');

  const supabaseUrl = envOr('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = envOr('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY');
  if (!supabaseUrl || !serviceKey) throw new Error('Missing Supabase env');

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const phoneFilter = `phone.eq.${phone},phone.eq.91${phone},phone.eq.+91${phone},phone.ilike.%${phone}`;
  const leadPhoneFilter = `customer_phone.eq.${phone},customer_phone.eq.91${phone},customer_phone.eq.+91${phone},customer_phone.ilike.%${phone}`;

  const { data: customers, error: custErr } = await supabase
    .from('customers')
    .select('id, phone, full_name, created_at')
    .or(phoneFilter);
  if (custErr) throw new Error(`Fetch customers failed: ${custErr.message}`);

  const { data: leads } = await supabase
    .from('service_leads')
    .select('id, lead_number, status, created_at')
    .or(leadPhoneFilter);

  const { data: otpRows } = await supabase
    .from('otp_requests')
    .select('id')
    .or(`phone.eq.${phone},phone.eq.91${phone},phone.eq.+91${phone},phone.ilike.%${phone}`);

  console.log(`Phone: ${phone}`);
  console.log(`Customers: ${(customers || []).length}`);
  (customers || []).forEach((c) => console.log(`  - ${c.id} | ${c.phone} | ${c.full_name || '(no name)'} | ${c.created_at}`));
  console.log(`Service leads: ${(leads || []).length}`);
  console.log(`OTP requests: ${(otpRows || []).length}`);

  if (dryRun) {
    console.log('\nDry run only. Re-run with --execute to delete everything.');
    return;
  }

  const leadIds = (leads || []).map((r) => r.id);
  if (leadIds.length) {
    for (const table of LEAD_CHILD_TABLES) {
      const n = await supabase.from(table).delete({ count: 'exact' }).in('lead_id', leadIds);
      if (n.count) console.log(`Deleted ${n.count} from ${table}`);
    }
    const { count: leadCount, error: leadDelErr } = await supabase
      .from('service_leads')
      .delete({ count: 'exact' })
      .in('id', leadIds);
    if (leadDelErr) throw new Error(`Delete service_leads failed: ${leadDelErr.message}`);
    console.log(`Deleted ${leadCount ?? leadIds.length} service_leads`);
  }

  for (const customer of customers || []) {
    const id = customer.id;
    console.log(`Resetting customer ${id}...`);

    const { data: carts } = await supabase.from('carts').select('id').eq('customer_id', id);
    for (const cart of carts || []) {
      await supabase.from('cart_items').delete().eq('cart_id', cart.id);
    }
    await deleteByCustomerId(supabase, id, 'carts');
    await deleteByCustomerId(supabase, id, 'customer_coupon_assignments');
    await deleteByCustomerId(supabase, id, 'customer_analytics_events');
    await deleteByCustomerId(supabase, id, 'customer_sessions');
    await deleteByCustomerId(supabase, id, 'customer_carts');

    const { error: delErr } = await supabase.from('customers').delete().eq('id', id);
    if (delErr) throw new Error(`Delete customer failed: ${delErr.message}`);
    console.log(`Deleted customer ${id}`);
  }

  if (otpRows?.length) {
    const otpIds = otpRows.map((r) => r.id);
    await supabase.from('otp_requests').delete().in('id', otpIds);
    console.log(`Deleted ${otpIds.length} otp_requests`);
  }

  const { data: remaining } = await supabase.from('customers').select('id').or(phoneFilter);
  if (remaining?.length) {
    throw new Error(`Customer still exists after delete (${remaining.length} row(s))`);
  }

  console.log('Done. Next login will create a fresh customer with welcome bonus.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
