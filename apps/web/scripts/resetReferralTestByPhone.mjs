/**
 * Reset referral history for a test referrer phone and optionally seed dummy referrals.
 *
 * Usage:
 *   node scripts/resetReferralTestByPhone.mjs --phone 8652710389 --dry-run
 *   node scripts/resetReferralTestByPhone.mjs --phone 8652710389 --seed 1 --execute
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
  return String(input || '').replace(/\D/g, '').slice(-10);
}

function phoneVariants(phone) {
  return [phone, `91${phone}`, `+91${phone}`];
}

function phoneOrFilter(column, phone) {
  return phoneVariants(phone)
    .flatMap((v) => [`${column}.eq.${v}`, `${column}.ilike.%${phone}`])
    .join(',');
}

async function deleteByCustomerId(supabase, customerId, table, column = 'customer_id') {
  const { error, count } = await supabase.from(table).delete({ count: 'exact' }).eq(column, customerId);
  if (error && !String(error.message || '').includes('does not exist')) {
    console.warn(`  warn ${table}: ${error.message}`);
    return 0;
  }
  return count || 0;
}

async function ensureReferralCode(supabase, customerId, phone) {
  const { data: existing } = await supabase
    .from('referral_codes')
    .select('code')
    .eq('customer_id', customerId)
    .maybeSingle();
  if (existing?.code) return String(existing.code);

  const suffix = phone.slice(-4);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const code = `MYF${suffix}${rand}`;
  const { data, error } = await supabase
    .from('referral_codes')
    .insert({ customer_id: customerId, code, active: true })
    .select('code')
    .single();
  if (error || !data?.code) throw new Error(`Failed to create referral code: ${error?.message || ''}`);
  return String(data.code);
}

async function seedDummyReferrals(supabase, customerId, referralCode, count, referrerPhone) {
  for (let i = 0; i < count; i += 1) {
    const dummyPhone = `90${String(Date.now()).slice(-8)}${String(i).padStart(1, '0')}`.slice(0, 10);
    const { data: referee, error: refereeErr } = await supabase
      .from('customers')
      .insert({
        phone: dummyPhone,
        full_name: `Test Friend ${i + 1}`,
        phone_verified: false,
        is_active: true,
      })
      .select('id')
      .single();
    if (refereeErr || !referee?.id) {
      throw new Error(`Failed to create dummy referee: ${refereeErr?.message || ''}`);
    }

    const { data: event, error: eventErr } = await supabase
      .from('referral_events')
      .insert({
        referrer_customer_id: customerId,
        referee_customer_id: referee.id,
        referral_code: referralCode,
        status: 'REWARDED',
        anti_fraud_flags: ['test_simulate'],
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (eventErr || !event?.id) {
      throw new Error(`Failed to create referral event: ${eventErr?.message || ''}`);
    }

    await supabase.from('referral_rewards').insert({
      referral_event_id: event.id,
      customer_id: customerId,
      reward_type: 'WALLET_CREDIT',
      reward_amount: 0,
      status: 'CREDITED',
    });

    console.log(`  seeded referral #${i + 1} -> referee ${dummyPhone}`);
    await new Promise((r) => setTimeout(r, 5));
  }
}

async function resetReferralForPhone(supabase, phone, seedCount, execute) {
  const phoneFilter = phoneOrFilter('phone', phone);
  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, phone, full_name')
    .or(phoneFilter)
    .limit(1);
  if (error) throw new Error(error.message);
  const customer = customers?.[0];
  if (!customer?.id) throw new Error(`Customer not found for phone ${phone}`);

  console.log(`Customer: ${customer.full_name || '(no name)'} | ${customer.phone} | ${customer.id}`);

  const { data: claims } = await supabase
    .from('referral_milestone_claims')
    .select('id, coupon_id')
    .eq('customer_id', customer.id);

  const couponIds = (claims || []).map((row) => row.coupon_id).filter(Boolean);
  const claimIds = (claims || []).map((row) => row.id).filter(Boolean);

  const { data: events } = await supabase
    .from('referral_events')
    .select('id, referee_customer_id, anti_fraud_flags')
    .eq('referrer_customer_id', customer.id);

  const refereeIds = (events || []).map((row) => row.referee_customer_id).filter(Boolean);

  if (!execute) {
    console.log(`Would delete ${claimIds.length} milestone claim(s), ${(events || []).length} referral event(s), ${couponIds.length} coupon(s)`);
    console.log(`Would seed ${seedCount} dummy rewarded referral(s)`);
    return;
  }

  if (claimIds.length) {
    await supabase.from('referral_milestone_claims').delete().in('id', claimIds);
    console.log(`Deleted ${claimIds.length} milestone claim(s)`);
  }

  if (couponIds.length) {
    await supabase.from('customer_coupon_assignments').delete().in('coupon_id', couponIds);
    await supabase.from('coupons').delete().in('id', couponIds);
    console.log(`Deleted ${couponIds.length} referral coupon(s)`);
  }

  await deleteByCustomerId(supabase, customer.id, 'referral_rewards');
  await deleteByCustomerId(supabase, customer.id, 'referral_events', 'referrer_customer_id');

  for (const refereeId of refereeIds) {
    const { data: refereeEventCount } = await supabase
      .from('referral_events')
      .select('id', { count: 'exact', head: true })
      .eq('referee_customer_id', refereeId);
    if ((refereeEventCount || 0) <= 1) {
      await supabase.from('customers').delete().eq('id', refereeId);
    }
  }

  if (seedCount > 0) {
    const referralCode = await ensureReferralCode(supabase, customer.id, normalizePhone(customer.phone));
    await seedDummyReferrals(supabase, customer.id, referralCode, seedCount, normalizePhone(customer.phone));
    console.log(`Seeded ${seedCount} rewarded referral(s) for milestone testing`);
  }

  const { count: rewardedCount } = await supabase
    .from('referral_events')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_customer_id', customer.id)
    .eq('status', 'REWARDED');

  console.log(`Done. Rewarded referrals now: ${rewardedCount || 0}`);
}

async function main() {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const phone = normalizePhone(args[args.indexOf('--phone') + 1] || '8652710389');
  const seedCount = Number(args[args.indexOf('--seed') + 1] || 1);
  const execute = args.includes('--execute');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)');

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  await resetReferralForPhone(supabase, phone, seedCount, execute);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
