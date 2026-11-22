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

type Platform = 'mobile' | 'web' | 'unknown';

function platformOf(raw: unknown): Platform {
  const p = String(raw || '').toLowerCase();
  return p === 'mobile' ? 'mobile' : p === 'web' ? 'web' : 'unknown';
}

/**
 * GET /api/lead-manager/telecaller-logins
 * Team telecaller login audit, split by phone app vs website.
 * Query: days?=14 (1 = today), platform?=all|mobile|web, status?=active|inactive|all,
 *        telecaller_id?, limit?=250
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await requireManager(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: 'Admin unavailable' }, { status: 500 });

    const sp = request.nextUrl.searchParams;
    const daysRaw = Number(sp.get('days') || 14);
    const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(90, Math.floor(daysRaw))) : 14;
    const limitRaw = Number(sp.get('limit') || 250);
    const limit = Number.isFinite(limitRaw) ? Math.max(20, Math.min(500, Math.floor(limitRaw))) : 250;
    const telecallerFilter = String(sp.get('telecaller_id') || '').trim();
    const platformParam = String(sp.get('platform') || 'all').toLowerCase();
    const platformFilter: Platform | 'all' =
      platformParam === 'mobile' || platformParam === 'web' ? platformParam : 'all';
    const statusParam = String(sp.get('status') || 'active').toLowerCase();
    const statusFilter = statusParam === 'inactive' || statusParam === 'all' ? statusParam : 'active';

    const { data: users, error: uErr } = await supabaseAdmin
      .from('users_login')
      .select('id, full_name, phone, email, is_active, last_login, roles!role_id(role_code)')
      .order('full_name');

    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

    const allTelecallers = (users || []).filter(
      (u: any) => String(u?.roles?.role_code || '').toUpperCase() === 'TELECALLER',
    );
    const telecallers = allTelecallers.filter((t: any) => {
      const active = t.is_active !== false;
      return statusFilter === 'all' ? true : statusFilter === 'active' ? active : !active;
    });
    const idSet = new Set(telecallers.map((t: any) => String(t.id)));
    if (telecallerFilter && !idSet.has(telecallerFilter)) {
      return NextResponse.json({ error: 'Unknown telecaller' }, { status: 404 });
    }

    const ids = [...idSet];
    const today = istYmd();
    const todayBounds = istDayBounds(today);
    // days=1 → today only (IST); otherwise a rolling window.
    const since =
      days === 1 ? todayBounds.start : new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Counts need every row in range, not just the newest few hundred.
    const COUNT_CAP = 10000;
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
        .limit(COUNT_CAP);

      if (error && /column|ip_address|latitude|device_label/i.test(error.message || '')) {
        const fallback = await supabaseAdmin
          .from('user_login_history')
          .select('id, user_id, logged_in_at, platform, user_agent')
          .in('user_id', ids)
          .gte('logged_in_at', since)
          .order('logged_in_at', { ascending: false })
          .limit(COUNT_CAP);
        if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 });
        history = fallback.data || [];
      } else if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      } else {
        history = data || [];
      }
    }

    // Phone app stays signed in for days, so "app opened" (push token refresh) shows
    // who is really working on the phone even without a fresh login.
    const appSeen = new Map<string, { at: string; device: string | null }>();
    if (ids.length) {
      const { data: devices } = await supabaseAdmin
        .from('notification_devices')
        .select('user_id, last_seen_at, device_name')
        .in('user_id', ids)
        .eq('platform', 'FCM')
        .order('last_seen_at', { ascending: false });
      for (const d of devices || []) {
        const uid = String((d as any).user_id || '');
        const at = String((d as any).last_seen_at || '');
        if (uid && at && !appSeen.has(uid)) {
          appSeen.set(uid, { at, device: (d as any).device_name || null });
        }
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

    type Bucket = {
      total: number;
      today: number;
      mobile: number;
      web: number;
      unknown: number;
      today_mobile: number;
      today_web: number;
      last_mobile: string | null;
      last_web: string | null;
      devices: Set<string>;
      ips: Set<string>;
    };
    const emptyBucket = (): Bucket => ({
      total: 0,
      today: 0,
      mobile: 0,
      web: 0,
      unknown: 0,
      today_mobile: 0,
      today_web: 0,
      last_mobile: null,
      last_web: null,
      devices: new Set(),
      ips: new Set(),
    });
    const countByUser = new Map<string, Bucket>();
    for (const id of ids) countByUser.set(id, emptyBucket());

    let todayMobile = 0;
    let todayWeb = 0;
    let rangeMobile = 0;
    let rangeWeb = 0;
    for (const row of history) {
      const uid = String(row.user_id || '');
      const b = countByUser.get(uid) || emptyBucket();
      const at = String(row.logged_in_at || '');
      const isToday = at >= todayBounds.start && at <= todayBounds.end;
      const p = platformOf(row.platform);
      b.total += 1;
      b[p] += 1;
      if (isToday) b.today += 1;
      if (p === 'mobile') {
        rangeMobile += 1;
        if (isToday) {
          b.today_mobile += 1;
          todayMobile += 1;
        }
        if (!b.last_mobile) b.last_mobile = at; // rows are newest first
      } else if (p === 'web') {
        rangeWeb += 1;
        if (isToday) {
          b.today_web += 1;
          todayWeb += 1;
        }
        if (!b.last_web) b.last_web = at;
      }
      if (row.device_label) b.devices.add(String(row.device_label));
      if (row.ip_address) b.ips.add(String(row.ip_address));
      countByUser.set(uid, b);
    }

    const summary = ids
      .map((id) => {
        const meta = nameById.get(id)!;
        const c = countByUser.get(id) || emptyBucket();
        const seen = appSeen.get(id) || null;
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
          logins_unknown: c.unknown,
          today_mobile: c.today_mobile,
          today_web: c.today_web,
          last_mobile_login: c.last_mobile,
          last_web_login: c.last_web,
          app_last_seen: seen?.at || null,
          app_device: seen?.device || null,
          devices: c.devices.size,
          ips: c.ips.size,
        };
      })
      .sort(
        (a, b) =>
          b.logins_today - a.logins_today ||
          b.logins_in_range - a.logins_in_range ||
          String(b.app_last_seen || '').localeCompare(String(a.app_last_seen || '')) ||
          a.name.localeCompare(b.name),
      );

    const filteredHistory = history.filter(
      (r) =>
        (!telecallerFilter || String(r.user_id) === telecallerFilter) &&
        (platformFilter === 'all' || platformOf(r.platform) === platformFilter),
    );
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
        platform: platformOf(row.platform),
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
      platform: platformFilter,
      status: statusFilter,
      totals: {
        today: todayMobile + todayWeb,
        today_mobile: todayMobile,
        today_web: todayWeb,
        range_mobile: rangeMobile,
        range_web: rangeWeb,
        telecallers: ids.length,
        logged_in_today: summary.filter((s) => s.logins_today > 0).length,
        app_open_today: summary.filter(
          (s) => s.app_last_seen && s.app_last_seen >= todayBounds.start,
        ).length,
      },
      summary,
      events,
      events_total: filteredHistory.length,
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
