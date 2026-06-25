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

const PREF_FIELDS = [
  'push_enabled',
  'sms_enabled',
  'email_enabled',
  'order_updates',
  'offers',
  'wallet_credits',
  'referral_updates',
  'support_updates',
] as const;

const PREF_DEFAULTS: Record<(typeof PREF_FIELDS)[number], boolean> = {
  push_enabled: true,
  sms_enabled: true,
  email_enabled: true,
  order_updates: true,
  offers: true,
  wallet_credits: true,
  referral_updates: true,
  support_updates: true,
};

export async function PUT(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const body = await request.json().catch(() => ({}));

  const { data: existing } = await supabaseAdmin
    .from('customer_notification_preferences')
    .select('*')
    .eq('customer_id', customer.id)
    .maybeSingle();

  const payload: Record<string, unknown> = {
    customer_id: customer.id,
    updated_at: new Date().toISOString(),
  };
  for (const field of PREF_FIELDS) {
    if (field in body) payload[field] = Boolean(body[field]);
    else if (existing && field in existing) payload[field] = Boolean((existing as any)[field]);
    else payload[field] = PREF_DEFAULTS[field];
  }

  await supabaseAdmin.from('customer_notification_preferences').upsert(payload, { onConflict: 'customer_id' });

  if (payload.push_enabled === false) {
    await supabaseAdmin
      .from('notification_devices')
      .update({ is_active: false })
      .eq('customer_id', customer.id)
      .eq('platform', 'EXPO');
  }

  await logCustomerEvent(supabaseAdmin, customer.id, 'notification_preferences_updated', 'notifications');

  return NextResponse.json({ success: true, preferences: payload });
}

