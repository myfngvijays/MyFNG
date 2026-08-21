import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { istDayBounds, istYmd } from '@/lib/telecaller/crmDateRange';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function requireManager(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('users_login')
    .select('id, roles!role_id(role_code)')
    .eq('id', user.id)
    .maybeSingle();

  const roleCode = String((profile as { roles?: { role_code?: string } } | null)?.roles?.role_code || '')
    .trim()
    .toUpperCase();

  if (!['LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }
  return { ok: true as const, managerId: String(profile?.id || user.id) };
}

/**
 * GET /api/lead-manager/telecaller-logins
 * Team telecaller login audit: counts + recent rows (time, platform, IP, location).
 * Query: telecaller_id?, days?=14, limit?=200
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await requireManager(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: 'Admin unavailable' }, { status: 500 });

    const daysRaw = Number(request.nextUrl.searchParams.get('days') || 14);
    const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(90, Math.floor(daysRaw))) : 14;
    const limitRaw = Number(request.nextUrl.searchParams.get('limit') || 200);
    const limit = Number.isFinite(limitRaw) ? Math.max(20, Math.min(500, Math.floor(limitRaw))) : 200;
    const telecallerFilter = String(request.nextUrl.searchParams.get('telecaller_id') || '').trim();

    const { data: users, error: uErr } = await supabaseAdmin
      .from('users_login')
      .select('id, full_name, phone, email, is_active, last_login, roles!role_id(role_code)')
      .order('full_name');

    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

    const telecallers = (users || []).filter(
      (u: any) => String(u?.roles?.role_code || '').toUpperCase() === 'TELECALLER',
    );
    const idSet = new Set(telecallers.map((t: any) => String(t.id)));
    if (telecallerFilter && !idSet.has(telecallerFilter)) {
      return NextResponse.json({ error: 'Unknown telecaller' }, { status: 404 });
    }

    const ids = [...idSet];
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const today = istYmd();
    const todayBounds = istDayBounds(today);

    let history: any[] = [];
    if (ids.length) {
      const { data, error } = await supabaseAdmin
        .from('user_login_history')
        .select(
          'id, user_id, logged_in_at, platform, user_agent, ip_address, latitude, longitude, location_label, city, device_label',
        )
        .in('user_id', ids)
        .gte('logged_in_at', since)
        .order('logged_in_at', { ascending: false })
        .limit(Math.max(limit, 500));

      if (error && /column|ip_address|latitude|device_label/i.test(error.message || '')) {
        const fallback = await supabaseAdmin
          .from('user_login_history')
          .select('id, user_id, logged_in_at, platform, user_agent')
          .in('user_id', ids)
          .gte('logged_in_at', since)
          .order('logged_in_at', { ascending: false })
          .limit(Math.max(limit, 500));
        if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 });
        history = fallback.data || [];
      } else if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      } else {
        history = data || [];
      }
    }

    const nameById = new Map(
      telecallers.map((t: any) => [
        String(t.id),
        {
          name: String(t.full_name || t.email || 'Telecaller').trim(),
          phone: t.phone || null,
          email: t.email || null,
          last_login: t.last_login || null,
          is_active: t.is_active !== false,
        },
      ]),
    );

    const countByUser = new Map<string, { total: number; today: number; mobile: number; web: number }>();
    for (const id of ids) {
      countByUser.set(id, { total: 0, today: 0, mobile: 0, web: 0 });
    }
    for (const row of history) {
      const uid = String(row.user_id || '');
      const bucket = countByUser.get(uid) || { total: 0, today: 0, mobile: 0, web: 0 };
      bucket.total += 1;
      const at = String(row.logged_in_at || '');
      if (at >= todayBounds.start && at <= todayBounds.end) bucket.today += 1;
      const p = String(row.platform || '').toLowerCase();
      if (p === 'mobile') bucket.mobile += 1;
      else if (p === 'web') bucket.web += 1;
      countByUser.set(uid, bucket);
    }

    const summary = ids.map((id) => {
      const meta = nameById.get(id)!;
      const c = countByUser.get(id) || { total: 0, today: 0, mobile: 0, web: 0 };
      return {
        telecaller_id: id,
        name: meta.name,
        phone: meta.phone,
        email: meta.email,
        is_active: meta.is_active,
        last_login: meta.last_login,
        logins_in_range: c.total,
        logins_today: c.today,
        logins_mobile: c.mobile,
        logins_web: c.web,
      };
    }).sort((a, b) => b.logins_today - a.logins_today || b.logins_in_range - a.logins_in_range);

    const filteredHistory = telecallerFilter
      ? history.filter((r) => String(r.user_id) === telecallerFilter)
      : history;
    const events = filteredHistory.slice(0, limit).map((row) => {
      const meta = nameById.get(String(row.user_id)) || {
        name: 'Telecaller',
        phone: null,
        email: null,
      };
      const where =
        String(row.location_label || '').trim() ||
        String(row.city || '').trim() ||
        (row.latitude != null && row.longitude != null
          ? `${Number(row.latitude).toFixed(4)}, ${Number(row.longitude).toFixed(4)}`
          : '') ||
        (row.ip_address ? `IP ${row.ip_address}` : '—');
      return {
        id: row.id,
        telecaller_id: row.user_id,
        telecaller_name: meta.name,
        logged_in_at: row.logged_in_at,
        platform: row.platform || 'unknown',
        device_label: row.device_label || null,
        ip_address: row.ip_address || null,
        city: row.city || null,
        location_label: row.location_label || null,
        latitude: row.latitude ?? null,
        longitude: row.longitude ?? null,
        where,
      };
    });

    return NextResponse.json({
      success: true,
      days,
      date: today,
      summary,
      events,
      count: events.length,
      filtered_telecaller_id: telecallerFilter || null,
    });
  } catch (e: unknown) {
    console.error('[telecaller-logins]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 },
    );
  }
}
