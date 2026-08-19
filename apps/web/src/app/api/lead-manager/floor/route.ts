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

    const [attendanceRes, assignedRes, followupsRes, updatedRes] = await Promise.all([
      ids.length
        ? supabaseAdmin
            .from('telecaller_attendance')
            .select('telecaller_id, punch_in_at, punch_out_at')
            .in('telecaller_id', ids)
            .is('punch_out_at', null)
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
    ]);

    const openPunch = new Map<string, string>();
    for (const row of attendanceRes.data || []) {
      const id = String((row as any).telecaller_id || '');
      if (id && !openPunch.has(id)) openPunch.set(id, String((row as any).punch_in_at || ''));
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

    const floor = agents.map((a: any) => {
      const id = String(a.id);
      const punchedIn = openPunch.has(id);
      return {
        id,
        name: a.full_name || a.email || id.slice(0, 8),
        phone: a.phone || null,
        punched_in: punchedIn,
        punch_in_at: openPunch.get(id) || null,
        last_login: a.last_login || null,
        assigned_today: assignedToday.get(id) || 0,
        updates_today: updatesToday.get(id) || 0,
        overdue_followups: overdueFu.get(id) || 0,
        status: punchedIn ? 'on_floor' : 'off_duty',
      };
    });

    floor.sort((a, b) => {
      if (a.punched_in !== b.punched_in) return a.punched_in ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      success: true,
      date: today,
      on_floor: floor.filter((f) => f.punched_in).length,
      off_duty: floor.filter((f) => !f.punched_in).length,
      agents: floor,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Floor failed' }, { status: 500 });
  }
}
