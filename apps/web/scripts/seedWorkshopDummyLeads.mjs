/**
 * Seed 3 dummy ACCEPTED leads for workshop flow testing.
 * Usage: node scripts/seedWorkshopDummyLeads.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSHOP_ID = 'c248e9cc-359f-4131-a4ec-4cd4837dcb54';

const LEADS = [
  {
    lead_number: 'L-DUM2609011',
    customer_name: 'Rahul Dummy',
    customer_phone: '9999900101',
    customer_email: 'rahul.dummy@test.myfng.in',
    customer_address: 'Thane West, Maharashtra',
    vehicle_number: 'MH12DUM201',
    vehicle_make: 'Maruti',
    vehicle_model: 'Swift',
    vehicle_year: 2020,
    pickup_otp: '111111',
  },
  {
    lead_number: 'L-DUM2609012',
    customer_name: 'Priya Dummy',
    customer_phone: '9999900102',
    customer_email: 'priya.dummy@test.myfng.in',
    customer_address: 'Andheri East, Mumbai',
    vehicle_number: 'GJ01DUM202',
    vehicle_make: 'Hyundai',
    vehicle_model: 'Creta',
    vehicle_year: 2021,
    pickup_otp: '222222',
  },
  {
    lead_number: 'L-DUM2609013',
    customer_name: 'Arjun Dummy',
    customer_phone: '9999900103',
    customer_email: 'arjun.dummy@test.myfng.in',
    customer_address: 'Borivali West, Mumbai',
    vehicle_number: 'DL8CDUM203',
    vehicle_make: 'Honda',
    vehicle_model: 'City',
    vehicle_year: 2019,
    pickup_otp: '333333',
  },
];

function loadEnvLocal() {
  const envPath = path.join(__dirname, '../.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
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

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local');
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });
const now = new Date().toISOString();

for (const lead of LEADS) {
  const row = {
    ...lead,
    lead_type: 'NORMAL',
    status: 'ACCEPTED',
    workshop_id: WORKSHOP_ID,
    address: lead.customer_address,
    city: lead.customer_address.includes('Thane') ? 'Thane' : 'Mumbai',
    state: 'Maharashtra',
    service_type: 'General Service',
    problem_description: 'Dummy lead — full end-to-end flow test',
    pickup_required: true,
    pickup_status: 'NOT_ASSIGNED',
    pickup_address: lead.customer_address,
    assigned_pickup_boy_id: null,
    assigned_mechanic_id: null,
    assigned_supervisor_id: null,
    qc_status: 'PENDING',
    accepted_at: now,
    created_from: 'DUMMY_SEED',
    created_at: now,
    updated_at: now,
  };

  const { data: existing } = await admin
    .from('service_leads')
    .select('id, lead_number')
    .eq('lead_number', lead.lead_number)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await admin.from('service_leads').update(row).eq('id', existing.id);
    if (error) {
      console.error(`Update failed ${lead.lead_number}:`, error.message);
      process.exit(1);
    }
    console.log(`Updated ${lead.lead_number} (${lead.customer_name})`);
    continue;
  }

  const { error } = await admin.from('service_leads').insert(row);
  if (error) {
    console.error(`Insert failed ${lead.lead_number}:`, error.message);
    process.exit(1);
  }
  console.log(`Inserted ${lead.lead_number} (${lead.customer_name})`);
}

const { data } = await admin
  .from('service_leads')
  .select('lead_number, customer_name, vehicle_number, status, pickup_status, pickup_otp')
  .in('lead_number', LEADS.map((l) => l.lead_number))
  .order('lead_number');

console.table(data || []);
