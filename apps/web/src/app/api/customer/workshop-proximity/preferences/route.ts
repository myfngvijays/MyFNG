import { NextRequest, NextResponse } from 'next/server';
import { logCustomerEvent, requireCustomer } from '@/lib/customer-api';
import { getWorkshopGeofenceRadiusM } from '@/lib/workshop-proximity';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;

  const { data } = await supabaseAdmin
    .from('customer_notification_preferences')
    .select('workshop_proximity_alerts')
    .eq('customer_id', customer.id)
    .maybeSingle();

  const radiusM = await getWorkshopGeofenceRadiusM(supabaseAdmin);

  return NextResponse.json({
    enabled: Boolean(data?.workshop_proximity_alerts),
    radius_m: radiusM,
  });
}

export async function PUT(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const body = await request.json().catch(() => ({}));
  const enabled = Boolean(body.enabled);

  const { data: existing } = await supabaseAdmin
    .from('customer_notification_preferences')
    .select('*')
    .eq('customer_id', customer.id)
    .maybeSingle();

  const payload = {
    customer_id: customer.id,
    updated_at: new Date().toISOString(),
    workshop_proximity_alerts: enabled,
    push_enabled: existing?.push_enabled ?? true,
    sms_enabled: existing?.sms_enabled ?? true,
    email_enabled: existing?.email_enabled ?? true,
    order_updates: existing?.order_updates ?? true,
    offers: existing?.offers ?? true,
    wallet_credits: existing?.wallet_credits ?? true,
    referral_updates: existing?.referral_updates ?? true,
    support_updates: existing?.support_updates ?? true,
  };

  await supabaseAdmin
    .from('customer_notification_preferences')
    .upsert(payload, { onConflict: 'customer_id' });

  await logCustomerEvent(supabaseAdmin, customer.id, 'workshop_proximity_pref_updated', 'location', {
    enabled,
  });

  const radiusM = await getWorkshopGeofenceRadiusM(supabaseAdmin);

  return NextResponse.json({ success: true, enabled, radius_m: radiusM });
}
