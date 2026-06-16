/**
 * Remove demo service_leads (and related rows) for a customer phone.
 *
 * Usage:
 *   node scripts/cleanupDemoLeads.mjs --phone 8652710389 --dry-run
 *   node scripts/cleanupDemoLeads.mjs --phone 8652710389 --execute
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

async function main() {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const phoneArg = args[args.indexOf('--phone') + 1] || '8652710389';
  const execute = args.includes('--execute');
  const dryRun = !execute;

  const phone = normalizePhone(phoneArg);
  if (!phone) throw new Error('Invalid phone');

  const supabaseUrl = envOr('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = envOr('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY');
  if (!supabaseUrl || !serviceKey) throw new Error('Missing Supabase env');

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: leads, error } = await supabase
    .from('service_leads')
    .select('id, lead_number, status, customer_phone, vehicle_number, vehicle_make, vehicle_model, created_at')
    .or(`customer_phone.eq.${phone},customer_phone.eq.91${phone},customer_phone.eq.+91${phone},customer_phone.ilike.%${phone}`)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Fetch leads failed: ${error.message}`);

  const rows = leads || [];
  console.log(`Found ${rows.length} service lead(s) for phone ending ${phone}`);
  if (rows.length === 0) return;

  rows.slice(0, 20).forEach((r) => {
    console.log(`- ${r.lead_number} | ${r.status} | ${r.vehicle_make || ''} ${r.vehicle_model || ''} | ${r.created_at}`);
  });
  if (rows.length > 20) console.log(`... and ${rows.length - 20} more`);

  if (dryRun) {
    console.log('\nDry run only. Re-run with --execute to delete.');
    return;
  }

  const leadIds = rows.map((r) => r.id);
  for (const table of LEAD_CHILD_TABLES) {
    const { error: delErr, count } = await supabase.from(table).delete({ count: 'exact' }).in('lead_id', leadIds);
    if (delErr && !String(delErr.message || '').includes('does not exist')) {
      console.warn(`Warning deleting ${table}:`, delErr.message);
    } else if (count) {
      console.log(`Deleted ${count} row(s) from ${table}`);
    }
  }

  const { error: leadDelErr, count: leadCount } = await supabase
    .from('service_leads')
    .delete({ count: 'exact' })
    .in('id', leadIds);

  if (leadDelErr) throw new Error(`Delete service_leads failed: ${leadDelErr.message}`);
  console.log(`Deleted ${leadCount ?? leadIds.length} service_leads`);

  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .or(`phone.eq.${phone},phone.eq.91${phone},phone.eq.+91${phone}`)
    .maybeSingle();

  if (customer?.id) {
    await supabase.from('customer_carts').delete().eq('customer_id', customer.id);
    console.log('Cleared customer cart');
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
