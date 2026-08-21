import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function clientIp(request: NextRequest): string | null {
  const fwd = String(request.headers.get('x-forwarded-for') || '')
    .split(',')[0]
    ?.trim();
  if (fwd) return fwd.slice(0, 64);
  const real = String(request.headers.get('x-real-ip') || '').trim();
  if (real) return real.slice(0, 64);
  return null;
}

function deviceFromUa(ua: string, platform: string): string {
  const s = ua.toLowerCase();
  if (platform === 'mobile' || /myfng mobile/i.test(ua)) return 'MyFNG Mobile App';
  if (/iphone|ipad|ipod/.test(s)) return 'iOS Browser';
  if (/android/.test(s)) return 'Android Browser';
  if (/edg\//.test(s)) return 'Edge';
  if (/chrome\//.test(s) && !/edg\//.test(s)) return 'Chrome';
  if (/safari\//.test(s) && !/chrome\//.test(s)) return 'Safari';
  if (/firefox\//.test(s)) return 'Firefox';
  return platform === 'web' ? 'Web Browser' : 'Unknown device';
}

/**
 * POST /api/auth/record-login
 * After successful client auth — server records last_login + history with IP / optional GPS.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const platformRaw = String(body?.platform || 'web').toLowerCase();
    const platform =
      platformRaw === 'mobile' ? 'mobile' : platformRaw === 'unknown' ? 'unknown' : 'web';
    const userAgent = String(
      body?.user_agent || request.headers.get('user-agent') || '',
    )
      .trim()
      .slice(0, 400);
    const lat =
      body?.latitude != null && Number.isFinite(Number(body.latitude))
        ? Number(body.latitude)
        : null;
    const lng =
      body?.longitude != null && Number.isFinite(Number(body.longitude))
        ? Number(body.longitude)
        : null;
    const locationLabel =
      String(body?.location_label || '')
        .trim()
        .slice(0, 200) || null;
    const city = String(body?.city || '')
      .trim()
      .slice(0, 120) || null;
    const deviceLabel =
      String(body?.device_label || '').trim().slice(0, 120) ||
      deviceFromUa(userAgent, platform);

    const ip = clientIp(request);
    const now = new Date().toISOString();

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = supabaseAdmin || supabase;

    try {
      await db.from('users_login').update({ last_login: now }).eq('id', user.id);
    } catch (e) {
      console.warn('[record-login] last_login failed', e);
    }

    const row: Record<string, unknown> = {
      user_id: user.id,
      logged_in_at: now,
      platform,
      user_agent: userAgent || null,
      ip_address: ip,
      latitude: lat,
      longitude: lng,
      location_label: locationLabel,
      city,
      device_label: deviceLabel,
    };

    let { error: insertErr } = await db.from('user_login_history').insert(row);
    // Older DB without geo columns — retry slim insert
    if (insertErr && /column|ip_address|latitude|device_label|city|location_label/i.test(insertErr.message || '')) {
      const slim = {
        user_id: user.id,
        logged_in_at: now,
        platform,
        user_agent: userAgent || null,
      };
      const retry = await db.from('user_login_history').insert(slim);
      insertErr = retry.error;
    }
    if (insertErr) {
      console.warn('[record-login] insert failed', insertErr.message);
      return NextResponse.json({ success: false, warning: insertErr.message }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      logged_in_at: now,
      ip_address: ip,
      platform,
      device_label: deviceLabel,
    });
  } catch (e: unknown) {
    console.error('[record-login]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 },
    );
  }
}
