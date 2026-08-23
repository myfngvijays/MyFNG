import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb } from '../db.js';
import { BOOKED_STATUSES, fail, ok, periodRange } from '../helpers.js';

function isAnswered(status: unknown, duration: unknown) {
  const st = String(status || '').toUpperCase();
  const dur = Number(duration) || 0;
  return dur >= 1 || st === 'ANSWERED' || st === 'COMPLETED' || st === 'CONNECTED';
}

function isBooked(status: unknown) {
  const st = String(status || '').toUpperCase().replace(/\s+/g, '_');
  return (BOOKED_STATUSES as readonly string[]).includes(st);
}

async function aggregatePerformance(
  telecallerId: string | null,
  range: { start: string; end: string },
) {
  const db = getDb();
  let callsQ = db
    .from('telecaller_call_logs')
    .select('telecaller_id, call_status, call_duration, created_at')
    .gte('created_at', range.start)
    .lte('created_at', range.end)
    .limit(6000);
  if (telecallerId) callsQ = callsQ.eq('telecaller_id', telecallerId);

  let leadsQ = db
    .from('service_leads')
    .select('created_by_id, assigned_telecaller_id, status, updated_at')
    .gte('updated_at', range.start)
    .lte('updated_at', range.end)
    .limit(4000);
  if (telecallerId) {
    leadsQ = leadsQ.or(
      `created_by_id.eq.${telecallerId},assigned_telecaller_id.eq.${telecallerId}`,
    );
  }

  const [callsRes, leadsRes] = await Promise.all([callsQ, leadsQ]);
  if (callsRes.error) throw new Error(callsRes.error.message);

  type Agg = {
    id: string;
    calls: number;
    answered: number;
    talk: number;
    bookings: number;
    hourly: number[];
  };
  const byId = new Map<string, Agg>();
  const ensure = (id: string): Agg => {
    let a = byId.get(id);
    if (!a) {
      a = { id, calls: 0, answered: 0, talk: 0, bookings: 0, hourly: Array(24).fill(0) };
      byId.set(id, a);
    }
    return a;
  };

  for (const row of callsRes.data || []) {
    const id = String(row.telecaller_id || '');
    if (!id) continue;
    const a = ensure(id);
    a.calls += 1;
    const dur = Number(row.call_duration) || 0;
    a.talk += dur;
    if (isAnswered(row.call_status, dur)) a.answered += 1;
    if (row.created_at) {
      try {
        const d = new Date(String(row.created_at));
        const istMs = d.getTime() + 5.5 * 60 * 60 * 1000;
        const h = new Date(istMs).getUTCHours();
        if (h >= 0 && h < 24) a.hourly[h] += 1;
      } catch {
        /* ignore */
      }
    }
  }

  for (const row of leadsRes.data || []) {
    if (!isBooked(row.status)) continue;
    const owner = String(row.created_by_id || row.assigned_telecaller_id || '');
    if (!owner) continue;
    if (telecallerId && owner !== telecallerId) continue;
    ensure(owner).bookings += 1;
  }

  const members = [...byId.values()].map((a) => ({
    telecaller_id: a.id,
    calls: a.calls,
    answered: a.answered,
    talk_seconds: a.talk,
    connect_rate: a.calls ? a.answered / a.calls : 0,
    avg_talk_seconds: a.answered ? Math.round(a.talk / a.answered) : 0,
    bookings: a.bookings,
    hourly: a.hourly,
    score: scoreOf(a),
  }));

  members.sort((a, b) => b.score - a.score || b.calls - a.calls);
  return {
    members,
    totals: members.reduce(
      (acc, m) => {
        acc.calls += m.calls;
        acc.answered += m.answered;
        acc.talk_seconds += m.talk_seconds;
        acc.bookings += m.bookings;
        return acc;
      },
      { calls: 0, answered: 0, talk_seconds: 0, bookings: 0 },
    ),
    leads_error: leadsRes.error?.message || null,
  };
}

function scoreOf(a: { calls: number; answered: number; talk: number; bookings: number }) {
  if (!a.calls) return 0;
  const connect = a.answered / a.calls;
  const avgTalk = a.answered ? a.talk / a.answered : 0;
  const bookRate = a.answered ? a.bookings / a.answered : 0;
  const raw =
    connect * 35 + Math.min(1, avgTalk / 120) * 20 + Math.min(1, bookRate) * 25 + Math.min(1, a.calls / 40) * 20;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

export function registerReportsTools(server: McpServer) {
  server.tool(
    'get_leaderboard',
    'Live call-log leaderboard with scores, connect rate, talk, real bookings.',
    {
      period: z.enum(['day', 'week', 'month', 'year']).optional(),
      date: z.string().optional(),
      telecaller_id: z.string().uuid().optional().describe('If set, only this agent'),
    },
    async ({ period, date, telecaller_id }) => {
      try {
        const range = periodRange(period || 'day', date);
        const agg = await aggregatePerformance(telecaller_id || null, range);
        const db = getDb();
        const ids = agg.members.map((m) => m.telecaller_id);
        let names: Record<string, string> = {};
        if (ids.length) {
          const { data } = await db.from('users_login').select('id, full_name').in('id', ids);
          for (const u of data || []) names[String(u.id)] = String(u.full_name || 'Telecaller');
        }
        const ranked = agg.members.map((m, i) => ({
          rank: i + 1,
          full_name: names[m.telecaller_id] || 'Telecaller',
          ...m,
        }));
        return ok({ ok: true, source: 'call_logs', range, totals: agg.totals, members: ranked });
      } catch (e: any) {
        return fail(e?.message || 'get_leaderboard failed');
      }
    },
  );

  server.tool(
    'get_call_activity',
    'Call activity summary + hourly IST buckets for a telecaller or team sample.',
    {
      period: z.enum(['day', 'week', 'month', 'year']).optional(),
      date: z.string().optional(),
      telecaller_id: z.string().uuid().optional(),
    },
    async ({ period, date, telecaller_id }) => {
      try {
        const range = periodRange(period || 'day', date);
        const agg = await aggregatePerformance(telecaller_id || null, range);
        const hourly = Array.from({ length: 24 }, (_, hour) => {
          let count = 0;
          for (const m of agg.members) count += m.hourly[hour] || 0;
          return { hour, count };
        });
        const peak = hourly.reduce(
          (best, h) => (h.count > best.count ? h : best),
          { hour: 0, count: 0 },
        );
        return ok({
          ok: true,
          range,
          summary: {
            ...agg.totals,
            connect_rate: agg.totals.calls ? agg.totals.answered / agg.totals.calls : 0,
            agents: agg.members.length,
          },
          hourly,
          peak_hour_ist: peak.count ? peak.hour : null,
        });
      } catch (e: any) {
        return fail(e?.message || 'get_call_activity failed');
      }
    },
  );

  server.tool(
    'get_team_performance',
    'Team rollup: active telecallers vs who dialed in period.',
    {
      period: z.enum(['day', 'week', 'month', 'year']).optional(),
      date: z.string().optional(),
    },
    async ({ period, date }) => {
      try {
        const range = periodRange(period || 'day', date);
        const db = getDb();
        const [usersRes, agg] = await Promise.all([
          db
            .from('users_login')
            .select('id, full_name, is_active, roles!inner(role_code)')
            .eq('is_active', true)
            .eq('roles.role_code', 'TELECALLER')
            .limit(200),
          aggregatePerformance(null, range),
        ]);
        if (usersRes.error) return fail(usersRes.error.message);
        const active = usersRes.data || [];
        const dialed = new Set(agg.members.map((m) => m.telecaller_id));
        const idle = active
          .filter((u) => !dialed.has(String(u.id)))
          .map((u) => ({ id: u.id, full_name: u.full_name }));
        return ok({
          ok: true,
          range,
          team_size: active.length,
          dialed_count: dialed.size,
          idle_count: idle.length,
          idle_sample: idle.slice(0, 30),
          totals: agg.totals,
        });
      } catch (e: any) {
        return fail(e?.message || 'get_team_performance failed');
      }
    },
  );

  server.tool(
    'compare_periods',
    'Compare current period totals vs previous equal-length window (calls, answered, bookings).',
    {
      period: z.enum(['day', 'week', 'month', 'year']).optional(),
      date: z.string().optional(),
      telecaller_id: z.string().uuid().optional(),
    },
    async ({ period, date, telecaller_id }) => {
      try {
        const cur = periodRange(period || 'day', date);
        const startMs = new Date(cur.start).getTime();
        const endMs = new Date(cur.end).getTime();
        const span = Math.max(0, endMs - startMs);
        const prev = {
          start: new Date(startMs - span - 1).toISOString(),
          end: new Date(startMs - 1).toISOString(),
        };
        const [a, b] = await Promise.all([
          aggregatePerformance(telecaller_id || null, cur),
          aggregatePerformance(telecaller_id || null, prev),
        ]);
        return ok({
          ok: true,
          current: { range: cur, totals: a.totals },
          previous: { range: prev, totals: b.totals },
          delta: {
            calls: a.totals.calls - b.totals.calls,
            answered: a.totals.answered - b.totals.answered,
            talk_seconds: a.totals.talk_seconds - b.totals.talk_seconds,
            bookings: a.totals.bookings - b.totals.bookings,
          },
        });
      } catch (e: any) {
        return fail(e?.message || 'compare_periods failed');
      }
    },
  );
}
