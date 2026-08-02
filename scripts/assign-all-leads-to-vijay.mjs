#!/usr/bin/env node
/**
 * One-off: assign all service_leads to Vijay (primary telecaller).
 * Usage (from apps/web with .env.local):
 *   node ../../scripts/assign-all-leads-to-vijay.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '../apps/web/.env.local');

function loadEnv() {
  const raw = readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
  return env;
}

const env = loadEnv();
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function findVijayId() {
  const { data: roles } = await sb.from('roles').select('id').eq('role_code', 'TELECALLER').limit(1);
  const roleId = roles?.[0]?.id;
  if (!roleId) throw new Error('TELECALLER role not found');

  const { data: tcs, error } = await sb
    .from('users_login')
    .select('id, full_name, email, phone, is_active')
    .eq('role_id', roleId)
    .order('full_name');
  if (error) throw error;

  const vijay = (tcs || []).find((t) => {
    const name = String(t.full_name || '').toLowerCase();
    const email = String(t.email || '').toLowerCase();
    if (name.includes('ajit') || name.includes('bhushan')) return false;
    return name.includes('vijay') || email.includes('vijay');
  });

  if (!vijay) {
    console.error('Telecallers found:', (tcs || []).map((t) => ({ id: t.id, name: t.full_name, email: t.email })));
    throw new Error('Vijay telecaller not found');
  }
  return vijay;
}

async function assignAll(vijayId) {
  const now = new Date().toISOString();
  let totalUpdated = 0;
  const batch = 500;

  const assignBatch = async (applyFilter) => {
    let count = 0;
    while (true) {
      let query = sb
        .from('service_leads')
        .select('id')
        .is('deleted_at', null)
        .limit(batch);
      query = applyFilter(query);
      const { data: rows, error: selErr } = await query;
      if (selErr) throw selErr;
      if (!rows?.length) break;

      const ids = rows.map((r) => r.id);
      const { error: upErr } = await sb
        .from('service_leads')
        .update({ assigned_telecaller_id: vijayId, assigned_at: now, updated_at: now })
        .in('id', ids);
      if (upErr) throw upErr;
      count += ids.length;
      totalUpdated += ids.length;
      process.stdout.write(`\rUpdated ${totalUpdated} service_leads...`);
    }
    return count;
  };

  // PostgREST: neq() does not match NULL — handle unassigned first.
  await assignBatch((q) => q.is('assigned_telecaller_id', null));
  await assignBatch((q) => q.not('assigned_telecaller_id', 'is', null).neq('assigned_telecaller_id', vijayId));
  console.log(`\nDone service_leads: ${totalUpdated}`);

  const { data: enquiryRows, error: enqSelErr } = await sb
    .from('enquiry_hub')
    .select('id')
    .eq('kind', 'LEAD')
    .neq('assigned_telecaller_id', vijayId);
  if (enqSelErr && !/does not exist/i.test(enqSelErr.message)) throw enqSelErr;

  if (!enqSelErr && enquiryRows?.length) {
    const { error: enqUpErr } = await sb
      .from('enquiry_hub')
      .update({
        assigned_telecaller_id: vijayId,
        assigned_at: now,
        assignment_mode: 'MANUAL',
        updated_at: now,
      })
      .eq('kind', 'LEAD')
      .neq('assigned_telecaller_id', vijayId);
    if (enqUpErr) throw enqUpErr;
    console.log(`Updated enquiry_hub LEAD rows: ${enquiryRows.length}`);
  }

  const { data: allocs } = await sb
    .from('enquiry_hub')
    .select('id, telecaller_id')
    .eq('kind', 'ALLOCATION')
    .eq('is_active', true);

  for (const row of allocs || []) {
    const isVijay = String(row.telecaller_id) === String(vijayId);
    await sb
      .from('enquiry_hub')
      .update({
        allocation_percent: isVijay ? 100 : 0,
        allocation_status: isVijay ? 'ACTIVE' : 'INACTIVE',
        updated_at: now,
      })
      .eq('id', row.id);
  }

  const hasVijayAlloc = (allocs || []).some((r) => String(r.telecaller_id) === String(vijayId));
  if (!hasVijayAlloc) {
    await sb.from('enquiry_hub').insert({
      kind: 'ALLOCATION',
      is_active: true,
      telecaller_id: vijayId,
      allocation_percent: 100,
      allocation_status: 'ACTIVE',
    });
    console.log('Created Vijay allocation row (100%)');
  } else {
    console.log('Telecaller distribution: Vijay 100%, others inactive');
  }

  return totalUpdated;
}

async function printSummary(vijay) {
  const { data: roles } = await sb.from('roles').select('id').eq('role_code', 'TELECALLER').limit(1);
  const { data: tcs } = await sb
    .from('users_login')
    .select('id, full_name')
    .eq('role_id', roles?.[0]?.id);

  console.log('\n=== Lead counts by telecaller ===');
  for (const t of tcs || []) {
    const { count } = await sb
      .from('service_leads')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_telecaller_id', t.id)
      .is('deleted_at', null);
    console.log(`${t.full_name || t.id}: ${count ?? 0}`);
  }
  console.log(`\nPrimary telecaller: ${vijay.full_name} (${vijay.id})`);
}

const vijay = await findVijayId();
console.log('Assigning all leads to:', vijay.full_name, vijay.email || vijay.phone || vijay.id);
await assignAll(vijay.id);
await printSummary(vijay);
