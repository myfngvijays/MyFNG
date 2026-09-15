import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { MOBILE_PUSH_PLATFORM } from '@/lib/push/constants';

export const dynamic = 'force-dynamic';

function isFcmToken(token: string): boolean {
  const value = String(token || '').trim();
  if (value.length < 20 || value.length > 4096) return false;
  if (value.startsWith('ExponentPushToken[') || value.startsWith('ExpoPushToken[')) return false;
  return !/\s/.test(value);
}

async function requireStaffUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: staff } = await supabase
    .from('users_login')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (!staff?.id) {
    return { response: NextResponse.json({ error: 'Staff profile not found' }, { status: 404 }) };
  }

  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return {
      response: NextResponse.json(
        { error: adminError || 'Admin client not configured' },
        { status: 500 },
      ),
    };
  }

  return { userId: staff.id as string, supabaseAdmin };
}

export async function POST(request: NextRequest) {
  const ctx = await requireStaffUser();
  if ('response' in ctx) return ctx.response;

  const { userId, supabaseAdmin } = ctx;
  const body = await request.json().catch(() => ({}));
  const token = String(body?.token || '').trim();
  const platform = String(body?.platform || MOBILE_PUSH_PLATFORM).trim().toUpperCase();

  if (!token || !isFcmToken(token)) {
    return NextResponse.json({ error: 'Valid FCM device token is required' }, { status: 400 });
  }
  if (platform !== MOBILE_PUSH_PLATFORM) {
    return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const deviceName = body?.device_name ? String(body.device_name).slice(0, 120) : null;
  const deviceId = body?.device_id ? String(body.device_id).slice(0, 120) : null;

  await supabaseAdmin
    .from('notification_devices')
    .update({ is_active: false, updated_at: now })
    .eq('user_id', userId)
    .eq('platform', platform)
    .neq('token', token)
    .eq('is_active', true);

  const { data: existing } = await supabaseAdmin
    .from('notification_devices')
    .select('id')
    .eq('user_id', userId)
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
    user_id: userId,
    customer_id: null,
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
  const ctx = await requireStaffUser();
  if ('response' in ctx) return ctx.response;

  const { userId, supabaseAdmin } = ctx;
  const { error } = await supabaseAdmin
    .from('notification_devices')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('platform', MOBILE_PUSH_PLATFORM);

  if (error) {
    return NextResponse.json({ error: 'Failed to deactivate push tokens' }, { status: 500 });
  }

  return NextResponse.json({ success: true, deactivated: true });
}
