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
  return { ok: true as const };
}

/**
 * GET /api/lead-manager/floor
 * Live floor: telecallers punch status + today's lead/activity counts (no Tata telephony).
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await requireManager(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: 'Admin unavailable' }, { status: 500 });

    const today = istYmd();
    const bounds = istDayBounds(today);

    const { data: telecallers, error: tcErr } = await supabaseAdmin
      .from('users_login')
      .select('id, full_name, phone, email, is_active, last_login, roles!role_id(role_code)')
      .eq('is_active', true)
      .order('full_name');

    if (tcErr) return NextResponse.json({ error: tcErr.message }, { status: 500 });

    const agents = (telecallers || []).filter(
      (u: any) => String(u?.roles?.role_code || '').toUpperCase() === 'TELECALLER',
    );

    const ids = agents.map((a: any) => String(a.id));

    const [attendanceRes, assignedRes, followupsRes, updatedRes, callsRes, loginsRes, devicesRes] = await Promise.all([
      // Only today's punches. An old punch nobody closed is not "on floor" today.
      ids.length
        ? supabaseAdmin
            .from('telecaller_attendance')
            .select('telecaller_id, punch_in_at, punch_out_at')
            .in('telecaller_id', ids)
            .gte('punch_in_at', bounds.start)
            .lte('punch_in_at', bounds.end)
            .order('punch_in_at', { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      ids.length
        ? supabaseAdmin
            .from('service_leads')
            .select('assigned_telecaller_id')
            .in('assigned_telecaller_id', ids)
            .gte('created_at', bounds.start)
            .lte('created_at', bounds.end)
        : Promise.resolve({ data: [] as any[] }),
      ids.length
        ? supabaseAdmin
            .from('telecaller_follow_ups')
            .select('telecaller_id, status, scheduled_time')
            .in('telecaller_id', ids)
            .eq('status', 'PENDING')
            .lte('scheduled_time', new Date().toISOString())
        : Promise.resolve({ data: [] as any[] }),
      ids.length
        ? supabaseAdmin
            .from('service_leads')
            .select('assigned_telecaller_id, updated_at')
            .in('assigned_telecaller_id', ids)
            .gte('updated_at', bounds.start)
            .lte('updated_at', bounds.end)
        : Promise.resolve({ data: [] as any[] }),
      ids.length
        ? supabaseAdmin
            .from('telecaller_call_logs')
            .select('telecaller_id, call_status')
            .in('telecaller_id', ids)
            .gte('created_at', bounds.start)
            .lte('created_at', bounds.end)
        : Promise.resolve({ data: [] as any[] }),
      ids.length
        ? supabaseAdmin
            .from('user_login_history')
            .select('user_id, logged_in_at, platform')
            .in('user_id', ids)
            .gte('logged_in_at', bounds.start)
            .lte('logged_in_at', bounds.end)
            .order('logged_in_at', { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      // The phone app refreshes its push token on open: best "app open" signal.
      ids.length
        ? supabaseAdmin
            .from('notification_devices')
            .select('user_id, last_seen_at')
            .in('user_id', ids)
            .eq('platform', 'FCM')
            .eq('is_active', true)
            .order('last_seen_at', { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
    ]);

    // Latest punch of today per telecaller (open or closed).
    const todayPunch = new Map<string, { in: string; out: string | null }>();
    for (const row of attendanceRes.data || []) {
      const id = String((row as any).telecaller_id || '');
      if (!id || todayPunch.has(id)) continue;
      todayPunch.set(id, {
        in: String((row as any).punch_in_at || ''),
        out: (row as any).punch_out_at ? String((row as any).punch_out_at) : null,
      });
    }

    const callsToday = new Map<string, number>();
    for (const row of callsRes.data || []) {
      const st = String((row as any).call_status || '').toUpperCase();
      if (st === 'CANCELLED' || st === 'DEVICE_PENDING') continue;
      const id = String((row as any).telecaller_id || '');
      if (id) callsToday.set(id, (callsToday.get(id) || 0) + 1);
    }

    const loginToday = new Map<string, { at: string; platform: string }>();
    for (const row of loginsRes.data || []) {
      const id = String((row as any).user_id || '');
      if (id && !loginToday.has(id)) {
        loginToday.set(id, {
          at: String((row as any).logged_in_at || ''),
          platform: String((row as any).platform || ''),
        });
      }
    }

    const appSeen = new Map<string, string>();
    for (const row of devicesRes.data || []) {
      const id = String((row as any).user_id || '');
      const at = String((row as any).last_seen_at || '');
      if (id && at && !appSeen.has(id)) appSeen.set(id, at);
    }

    const assignedToday = new Map<string, number>();
    for (const row of assignedRes.data || []) {
      const id = String((row as any).assigned_telecaller_id || '');
      if (!id) continue;
      assignedToday.set(id, (assignedToday.get(id) || 0) + 1);
    }

    const overdueFu = new Map<string, number>();
    for (const row of followupsRes.data || []) {
      const id = String((row as any).telecaller_id || '');
      if (!id) continue;
      overdueFu.set(id, (overdueFu.get(id) || 0) + 1);
    }

    const updatesToday = new Map<string, number>();
    for (const row of updatedRes.data || []) {
      const id = String((row as any).assigned_telecaller_id || '');
      if (!id) continue;
      updatesToday.set(id, (updatesToday.get(id) || 0) + 1);
    }

    const inToday = (iso: string | null | undefined) =>
      Boolean(iso) && String(iso) >= bounds.start && String(iso) <= bounds.end;
    const STATUS_ORDER: Record<string, number> = { on_floor: 0, punched_out: 1, online: 2, off_duty: 3 };

    const floor = agents.map((a: any) => {
      const id = String(a.id);
      const punch = todayPunch.get(id) || null;
      const punchedIn = Boolean(punch && !punch.out);
      const login = loginToday.get(id) || null;
      const seen = appSeen.get(id) || null;
      const webLoginToday = inToday(a.last_login);
      const appToday = inToday(seen);
      const calls = callsToday.get(id) || 0;
      // on_floor: punched in now · punched_out: worked today, punched out
      // online: working today (login / app open / calls) without punch-in · off_duty: nothing today
      const status = punchedIn
        ? 'on_floor'
        : punch
          ? 'punched_out'
          : login || webLoginToday || appToday || calls > 0
            ? 'online'
            : 'off_duty';
      return {
        id,
        name: a.full_name || a.email || id.slice(0, 8),
        phone: a.phone || null,
        punched_in: punchedIn,
        punch_in_at: punch?.in || null,
        punch_out_at: punch?.out || null,
        last_login: a.last_login || null,
        last_login_platform: login?.platform || null,
        app_last_seen: seen,
        assigned_today: assignedToday.get(id) || 0,
        calls_today: calls,
        updates_today: updatesToday.get(id) || 0,
        overdue_followups: overdueFu.get(id) || 0,
        status,
      };
    });

    floor.sort((a, b) => {
      const d = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
      return d || a.name.localeCompare(b.name);
    });

    const count = (st: string) => floor.filter((f) => f.status === st).length;
    return NextResponse.json({
      success: true,
      date: today,
      on_floor: count('on_floor'),
      punched_out: count('punched_out'),
      online_no_punch: count('online'),
      off_duty: count('off_duty'),
      agents: floor,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Floor failed' }, { status: 500 });
  }
}
