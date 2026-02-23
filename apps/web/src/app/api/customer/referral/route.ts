import { NextRequest, NextResponse } from 'next/server';
import { ensureWalletAccount, logCustomerEvent, requireCustomer } from '@/lib/customer-api';

function makeCode(phone: string) {
  const suffix = phone.slice(-4);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MYF${suffix}${rand}`;
}

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;

  let { data: codeRow } = await supabaseAdmin
    .from('referral_codes')
    .select('*')
    .eq('customer_id', customer.id)
    .maybeSingle();

  if (!codeRow) {
    const generated = makeCode(customer.phone);
    const { data } = await supabaseAdmin
      .from('referral_codes')
      .insert({ customer_id: customer.id, code: generated, active: true })
      .select('*')
      .single();
    codeRow = data;
  }

  const { data: events } = await supabaseAdmin
    .from('referral_events')
    .select('*')
    .eq('referrer_customer_id', customer.id)
    .order('created_at', { ascending: false });

  const { data: rewards } = await supabaseAdmin
    .from('referral_rewards')
    .select('*')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false });

  return NextResponse.json({
    code: codeRow,
    events: events || [],
    rewards: rewards || [],
  });
}

export async function POST(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const body = await request.json().catch(() => ({}));
  const referredCode = String(body.referral_code || '').trim().toUpperCase();

  if (!referredCode) {
    return NextResponse.json({ error: 'referral_code is required' }, { status: 400 });
  }

  const { data: refCode } = await supabaseAdmin
    .from('referral_codes')
    .select('*')
    .eq('code', referredCode)
    .eq('active', true)
    .maybeSingle();
  if (!refCode) return NextResponse.json({ error: 'Invalid referral code' }, { status: 400 });
  if (refCode.customer_id === customer.id) {
    return NextResponse.json({ error: 'Self referral is not allowed' }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from('referral_events')
    .select('id')
    .eq('referee_customer_id', customer.id)
    .maybeSingle();
  if (existing) return NextResponse.json({ error: 'Referral already used' }, { status: 400 });

  const antiFraudFlags: string[] = [];
  if (String(body.device_id || '').length > 0) {
    const { data: byDevice } = await supabaseAdmin
      .from('referral_events')
      .select('id')
      .contains('anti_fraud_flags', [`device:${String(body.device_id)}`])
      .limit(1);
    if (byDevice && byDevice.length > 0) antiFraudFlags.push('same_device_guard');
    antiFraudFlags.push(`device:${String(body.device_id)}`);
  }

  const { data: event, error } = await supabaseAdmin
    .from('referral_events')
    .insert({
      referrer_customer_id: refCode.customer_id,
      referee_customer_id: customer.id,
      referral_code: referredCode,
      status: antiFraudFlags.includes('same_device_guard') ? 'REJECTED' : 'PENDING',
      anti_fraud_flags: antiFraudFlags,
    })
    .select('*')
    .single();

  if (error || !event) return NextResponse.json({ error: 'Failed to apply referral' }, { status: 500 });

  await logCustomerEvent(supabaseAdmin, customer.id, 'referral_applied', 'referral', { referral_code: referredCode });
  return NextResponse.json({ success: true, event });
}

// Reward after first completed order (manual trigger from admin/system)
export async function PATCH(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const body = await request.json().catch(() => ({}));
  const eventId = String(body.referral_event_id || '');
  const rewardAmount = Number(body.reward_amount || 0);
  if (!eventId || rewardAmount <= 0) {
    return NextResponse.json({ error: 'referral_event_id and reward_amount required' }, { status: 400 });
  }

  const { data: event } = await supabaseAdmin
    .from('referral_events')
    .select('*')
    .eq('id', eventId)
    .eq('referrer_customer_id', customer.id)
    .maybeSingle();
  if (!event || event.status === 'REWARDED') {
    return NextResponse.json({ error: 'Invalid referral event' }, { status: 400 });
  }

  const wallet = await ensureWalletAccount(supabaseAdmin, customer.id);
  const nextBalance = Number(wallet.current_balance || 0) + rewardAmount;
  const idempotencyKey = `referral:${eventId}`;

  await supabaseAdmin.from('wallet_transactions').insert({
    wallet_account_id: wallet.id,
    customer_id: customer.id,
    transaction_type: 'CREDIT',
    amount: rewardAmount,
    balance_after: nextBalance,
    source: 'REFERRAL',
    source_ref_id: eventId,
    idempotency_key: idempotencyKey,
    metadata: { reason: 'refer_and_earn' },
  });
  await supabaseAdmin.from('wallet_accounts').update({
    current_balance: nextBalance,
    lifetime_credited: Number(wallet.lifetime_credited || 0) + rewardAmount,
    updated_at: new Date().toISOString(),
  }).eq('id', wallet.id);

  await supabaseAdmin.from('referral_events').update({ status: 'REWARDED', updated_at: new Date().toISOString() }).eq('id', eventId);
  await supabaseAdmin.from('referral_rewards').insert({
    referral_event_id: eventId,
    customer_id: customer.id,
    reward_type: 'WALLET_CREDIT',
    reward_amount: rewardAmount,
    status: 'CREDITED',
  });
  await logCustomerEvent(supabaseAdmin, customer.id, 'referral_reward_credited', 'referral', { rewardAmount });

  return NextResponse.json({ success: true, balance: nextBalance });
}

