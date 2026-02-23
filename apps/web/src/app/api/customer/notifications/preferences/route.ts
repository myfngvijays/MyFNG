import { NextRequest, NextResponse } from 'next/server';
import { logCustomerEvent, requireCustomer } from '@/lib/customer-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;

  const { data } = await supabaseAdmin
    .from('customer_notification_preferences')
    .select('*')
    .eq('customer_id', customer.id)
    .maybeSingle();

  if (data) return NextResponse.json({ preferences: data });

  const { data: inserted } = await supabaseAdmin
    .from('customer_notification_preferences')
    .insert({ customer_id: customer.id })
    .select('*')
    .single();

  return NextResponse.json({ preferences: inserted });
}

export async function PUT(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const body = await request.json().catch(() => ({}));

  const payload = {
    customer_id: customer.id,
    push_enabled: Boolean(body.push_enabled),
    sms_enabled: Boolean(body.sms_enabled),
    email_enabled: Boolean(body.email_enabled),
    order_updates: Boolean(body.order_updates),
    offers: Boolean(body.offers),
    wallet_credits: Boolean(body.wallet_credits),
    referral_updates: Boolean(body.referral_updates),
    support_updates: Boolean(body.support_updates),
    updated_at: new Date().toISOString(),
  };
  await supabaseAdmin.from('customer_notification_preferences').upsert(payload, { onConflict: 'customer_id' });
  await logCustomerEvent(supabaseAdmin, customer.id, 'notification_preferences_updated', 'notifications');

  return NextResponse.json({ success: true });
}

