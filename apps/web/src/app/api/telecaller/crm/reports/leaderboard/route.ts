import { NextRequest, NextResponse } from 'next/server';
import {
  isNextResponse,
  requireCrmReportsContext,
} from '@/lib/telecaller/crmReportsAuth';
import { resolveReportPeriod } from '@/lib/telecaller/crmReportsRange';
import { resolveCrmPermissionsForUser } from '@/lib/telecaller/resolveCrmPermissions';

export const dynamic = 'force-dynamic';

/**
 * Fast leaderboard: prefers daily performance metrics (few rows) over raw call logs.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireCrmReportsContext(request);
    if (isNextResponse(ctx)) return ctx;
    const { db, teleCallerId, seesAll, roleCode } = ctx;

    const { permissions } = await resolveCrmPermissionsForUser(db, teleCallerId, roleCode);
    const seeTeam = Boolean(seesAll || permissions.reports_team_leaderboard);

    const sp = new URL(request.url).searchParams;
    const range = resolveReportPeriod(sp.get('period') || 'day', sp.get('date'));

    let metricsQ = db
      .from('telecaller_performance_metrics')
      .select(
        'telecaller_id, date, total_calls, answered_calls, call_duration_total, leads_created, leads_completed',
      )
      .gte('date', range.startYmd)
      .lte('date', range.endYmd)
      .limit(2000);
    if (!seeTeam) metricsQ = metricsQ.eq('telecaller_id', teleCallerId);

    let usersQ = db
      .from('users_login')
      .select('id, full_name, phone, roles!inner(role_code)')
      .eq('is_active', true)
      .eq('roles.role_code', 'TELECALLER')
      .limit(200);
    if (!seeTeam) usersQ = usersQ.eq('id', teleCallerId);

    // Lightweight first/last call only for day view (small window)
    const wantCallBounds = range.period === 'day';
    let callsBoundsQ = wantCallBounds
      ? db
          .from('telecaller_call_logs')
          .select('telecaller_id, created_at')
          .gte('created_at', range.start)
          .lte('created_at', range.end)
          .order('created_at', { ascending: true })
          .limit(3000)
      : null;
    if (callsBoundsQ && !seeTeam) {
      callsBoundsQ = callsBoundsQ.eq('telecaller_id', teleCallerId);
    }

    const [metricsRes, usersRes, callsRes] = await Promise.all([
      metricsQ,
      usersQ,
      callsBoundsQ ? callsBoundsQ : Promise.resolve({ data: [], error: null }),
    ]);

    if (metricsRes.error) throw metricsRes.error;
    if (usersRes.error) throw usersRes.error;

    // Fallback: if metrics empty for range, light call-log aggregate (keeps day/week usable)
    let metricsRows = metricsRes.data || [];
    if (metricsRows.length === 0) {
      let fallbackQ = db
        .from('telecaller_call_logs')
        .select('telecaller_id, call_status, call_duration')
        .gte('created_at', range.start)
        .lte('created_at', range.end)
        .limit(4000);
      if (!seesAll) fallbackQ = fallbackQ.eq('telecaller_id', teleCallerId);
      const fb = await fallbackQ;
      if (!fb.error && fb.data?.length) {
        const tmp = new Map<string, any>();
        for (const row of fb.data) {
          const id = String(row.telecaller_id || '');
          if (!id) continue;
          const cur = tmp.get(id) || {
            telecaller_id: id,
            total_calls: 0,
            answered_calls: 0,
            call_duration_total: 0,
            leads_created: 0,
            leads_completed: 0,
          };
          cur.total_calls += 1;
          const st = String(row.call_status || '').toUpperCase();
          if (st === 'ANSWERED' || st === 'COMPLETED') cur.answered_calls += 1;
          cur.call_duration_total += Number(row.call_duration) || 0;
          tmp.set(id, cur);
        }
        metricsRows = Array.from(tmp.values());
      }
    }

    const nameById = new Map<string, { full_name: string | null; phone: string | null }>();
    for (const u of usersRes.data || []) {
      nameById.set(String(u.id), {
        full_name: u.full_name ? String(u.full_name) : null,
        phone: u.phone ? String(u.phone) : null,
      });
    }

    type Agg = {
      id: string;
      calls: number;
      answered: number;
      duration: number;
      bookings: number;
      completed: number;
      firstCallAt: string | null;
      lastCallAt: string | null;
    };
    const byId = new Map<string, Agg>();
    const ensure = (id: string): Agg => {
      let a = byId.get(id);
      if (!a) {
        a = {
          id,
          calls: 0,
          answered: 0,
          duration: 0,
          bookings: 0,
          completed: 0,
          firstCallAt: null,
          lastCallAt: null,
        };
        byId.set(id, a);
      }
      return a;
    };

    for (const row of metricsRows) {
      const id = String(row.telecaller_id || '');
      if (!id) continue;
      const a = ensure(id);
      a.calls += Number(row.total_calls) || 0;
      a.answered += Number(row.answered_calls) || 0;
      a.duration += Number(row.call_duration_total) || 0;
      a.bookings += Number(row.leads_created) || 0;
      a.completed += Number(row.leads_completed) || 0;
    }

    for (const row of callsRes.data || []) {
      const id = String(row.telecaller_id || '');
      if (!id) continue;
      const a = ensure(id);
      const at = row.created_at ? String(row.created_at) : null;
      if (!at) continue;
      if (!a.firstCallAt || at < a.firstCallAt) a.firstCallAt = at;
      if (!a.lastCallAt || at > a.lastCallAt) a.lastCallAt = at;
    }

    if (seeTeam) {
      for (const id of nameById.keys()) ensure(id);
    }

    const members = Array.from(byId.values())
      .map((a) => {
        const meta = nameById.get(a.id);
        return {
          id: a.id,
          full_name: meta?.full_name || 'Telecaller',
          phone: meta?.phone || null,
          role: 'Telecaller',
          calls: a.calls,
          answered: a.answered,
          duration_seconds: a.duration,
          bookings: a.bookings,
          completed: a.completed,
          first_call_at: a.firstCallAt,
          last_call_at: a.lastCallAt,
        };
      })
      .sort((a, b) => b.calls - a.calls || b.duration_seconds - a.duration_seconds);

    const ranked = members.map((m, i) => ({ ...m, rank: i + 1 }));
    const totals = ranked.reduce(
      (acc, m) => {
        acc.calls += m.calls;
        acc.duration_seconds += m.duration_seconds;
        acc.bookings += m.bookings;
        acc.answered += m.answered;
        return acc;
      },
      { calls: 0, duration_seconds: 0, bookings: 0, answered: 0 },
    );

    return NextResponse.json(
      {
        ok: true,
        range: {
          period: range.period,
          start: range.start,
          end: range.end,
          start_ymd: range.startYmd,
          end_ymd: range.endYmd,
          label: range.label,
        },
        team_size: ranked.length,
        totals,
        members: ranked,
      },
      { headers: { 'Cache-Control': 'private, max-age=20' } },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
