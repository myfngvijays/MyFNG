import { NextRequest, NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/customer-api';
import { MOBILE_PUSH_PLATFORM } from '@/lib/push/constants';

export const dynamic = 'force-dynamic';

function isFcmToken(token: string): boolean {
  const value = String(token || '').trim();
  if (value.length < 20 || value.length > 4096) return false;
  if (value.startsWith('ExponentPushToken[') || value.startsWith('ExpoPushToken[')) return false;
  return !/\s/.test(value);
}

export async function POST(request: NextRequest) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;

  const { customer, supabaseAdmin } = ctx;
  const body = await request.json().catch(() => ({}));
  const token = String(body?.token || '').trim();
  const platform = String(body?.platform || MOBILE_PUSH_PLATFORM).trim().toUpperCase();

  if (!token || !isFcmToken(token)) {
    return NextResponse.json({ error: 'Valid FCM device token is required' }, { status: 400 });
  }
  if (platform !== MOBILE_PUSH_PLATFORM) {
    return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 });
  }

  const { data: prefs } = await supabaseAdmin
    .from('customer_notification_preferences')
    .select('push_enabled')
    .eq('customer_id', customer.id)
    .maybeSingle();

  if (prefs?.push_enabled === false) {
    return NextResponse.json({ error: 'Push notifications are disabled for this account' }, { status: 403 });
  }

  const now = new Date().toISOString();
  const deviceName = body?.device_name ? String(body.device_name).slice(0, 120) : null;
  const deviceId = body?.device_id ? String(body.device_id).slice(0, 120) : null;

  await supabaseAdmin
    .from('notification_devices')
    .update({ is_active: false, updated_at: now })
    .eq('customer_id', customer.id)
    .eq('platform', platform)
    .neq('token', token)
    .eq('is_active', true);

  const { data: existing } = await supabaseAdmin
    .from('notification_devices')
    .select('id')
    .eq('customer_id', customer.id)
    .eq('platform', platform)
    .eq('token', token)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabaseAdmin
      .from('notification_devices')
      .update({
        is_active: true,
        last_seen_at: now,
        device_name: deviceName,
        device_id: deviceId,
        updated_at: now,
      })
      .eq('id', existing.id);

    if (error) {
      return NextResponse.json({ error: 'Failed to refresh push token' }, { status: 500 });
    }
    return NextResponse.json({ success: true, registered: true, platform });
  }

  const { error: insertError } = await supabaseAdmin.from('notification_devices').insert({
    customer_id: customer.id,
    user_id: null,
    platform,
    token,
    device_name: deviceName,
    device_id: deviceId,
    is_active: true,
    last_seen_at: now,
  });

  if (insertError) {
    return NextResponse.json(
      { error: 'Failed to register push token', details: insertError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, registered: true, platform });
}

export async function DELETE() {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;

  const { customer, supabaseAdmin } = ctx;
  const { error } = await supabaseAdmin
    .from('notification_devices')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('customer_id', customer.id)
    .eq('platform', MOBILE_PUSH_PLATFORM);

  if (error) {
    return NextResponse.json({ error: 'Failed to deactivate push tokens' }, { status: 500 });
  }

  return NextResponse.json({ success: true, deactivated: true });
}
