import { NextRequest, NextResponse } from 'next/server';
import {
  isNextResponse,
  requireCrmReportsContext,
} from '@/lib/telecaller/crmReportsAuth';
import { resolveReportPeriod } from '@/lib/telecaller/crmReportsRange';
import { resolveCrmPermissionsForUser } from '@/lib/telecaller/resolveCrmPermissions';

export const dynamic = 'force-dynamic';

function isAnsweredCall(status: unknown, duration: unknown): boolean {
  const st = String(status || '').toUpperCase();
  const dur = Number(duration) || 0;
  return dur >= 1 || st === 'ANSWERED' || st === 'COMPLETED' || st === 'CONNECTED';
}

function isMissedCall(status: unknown, duration: unknown): boolean {
  const st = String(status || '').toUpperCase();
  const dur = Number(duration) || 0;
  if (dur >= 1) return false;
  return (
    st === 'NO_ANSWER' ||
    st === 'BUSY' ||
    st === 'FAILED' ||
    st === 'CANCELLED' ||
    st === 'MISSED' ||
    st === 'SWITCHED_OFF'
  );
}

/** Real conversions — not every lead created in the window. */
function isBookedLeadStatus(status: unknown): boolean {
  const st = String(status || '').toUpperCase().replace(/\s+/g, '_');
  return (
    st === 'BOOKING_CONFIRMED' ||
    st === 'BOOKED' ||
    st === 'CONFIRMED' ||
    st === 'IN_SERVICE' ||
    st === 'SERVICE_DONE' ||
    st === 'COMPLETED' ||
    st === 'VALIDATED'
  );
}

function scoreMember(m: {
  calls: number;
  answered: number;
  duration: number;
  bookings: number;
  withRecording: number;
  withNotes: number;
}): number {
  if (!m.calls) return 0;
  const connect = m.answered / m.calls;
  const avgTalk = m.answered ? m.duration / m.answered : 0;
  const bookRate = m.answered ? m.bookings / m.answered : 0;
  const recRate = m.answered ? m.withRecording / Math.max(1, m.answered) : 0;
  const notesRate = m.calls ? m.withNotes / m.calls : 0;
  // Weighted 0–100
  const raw =
    connect * 35 +
    Math.min(1, avgTalk / 120) * 20 +
    Math.min(1, bookRate) * 25 +
    Math.min(1, recRate) * 10 +
    Math.min(1, notesRate) * 10;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

type Agg = {
  id: string;
  calls: number;
  answered: number;
  missed: number;
  shortCalls: number;
  duration: number;
  bookings: number;
  completed: number;
  withRecording: number;
  withNotes: number;
  inbound: number;
  outbound: number;
  firstCallAt: string | null;
  lastCallAt: string | null;
  statusMix: Record<string, number>;
  hourly: number[];
};

function emptyAgg(id: string): Agg {
  return {
    id,
    calls: 0,
    answered: 0,
    missed: 0,
    shortCalls: 0,
    duration: 0,
    bookings: 0,
    completed: 0,
    withRecording: 0,
    withNotes: 0,
    inbound: 0,
    outbound: 0,
    firstCallAt: null,
    lastCallAt: null,
    statusMix: {},
    hourly: Array.from({ length: 24 }, () => 0),
  };
}

function finalizeMember(
  a: Agg,
  meta: { full_name: string | null; phone: string | null } | undefined,
) {
  const connectRate = a.calls ? a.answered / a.calls : 0;
  const avgTalk = a.answered ? a.duration / a.answered : 0;
  const bookRate = a.answered ? a.bookings / a.answered : 0;
  const score = scoreMember({
    calls: a.calls,
    answered: a.answered,
    duration: a.duration,
    bookings: a.bookings,
    withRecording: a.withRecording,
    withNotes: a.withNotes,
  });
  return {
    id: a.id,
    full_name: meta?.full_name || 'Telecaller',
    phone: meta?.phone || null,
    role: 'Telecaller',
    score,
    calls: a.calls,
    answered: a.answered,
    missed: a.missed,
    short_calls: a.shortCalls,
    connect_rate: connectRate,
    duration_seconds: a.duration,
    avg_talk_seconds: Math.round(avgTalk),
    bookings: a.bookings,
    completed: a.completed,
    book_rate: bookRate,
    with_recording: a.withRecording,
    recording_rate: a.answered ? a.withRecording / a.answered : 0,
    with_notes: a.withNotes,
    notes_rate: a.calls ? a.withNotes / a.calls : 0,
    inbound: a.inbound,
    outbound: a.outbound,
    first_call_at: a.firstCallAt,
    last_call_at: a.lastCallAt,
    status_mix: a.statusMix,
    hourly: a.hourly,
  };
}

/**
 * Advanced leaderboard from live call logs + leads.
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
    const sortBy = String(sp.get('sort') || 'score').toLowerCase(); // score | calls | talk | bookings

    let usersQ = db
      .from('users_login')
      .select('id, full_name, phone, roles!inner(role_code)')
      .eq('is_active', true)
      .eq('roles.role_code', 'TELECALLER')
      .limit(200);
    if (!seeTeam) usersQ = usersQ.eq('id', teleCallerId);

    const aggLimit =
      range.period === 'day' ? 4000 : range.period === 'week' ? 6000 : 8000;

    let callsQ = db
      .from('telecaller_call_logs')
      .select(
        'telecaller_id, call_type, call_status, call_duration, created_at, call_recording_url, notes',
      )
      .gte('created_at', range.start)
      .lte('created_at', range.end)
      .limit(aggLimit);
    if (!seeTeam) callsQ = callsQ.eq('telecaller_id', teleCallerId);

    // Bookings: leads that reached a booked/done status, attributed by updated_at
    // (so a lead created last week but confirmed today counts for today).
    let leadsQ = db
      .from('service_leads')
      .select('id, created_by_id, assigned_telecaller_id, status, created_at, updated_at')
      .gte('updated_at', range.start)
      .lte('updated_at', range.end)
      .limit(aggLimit);
    if (!seeTeam) {
      leadsQ = leadsQ.or(
        `created_by_id.eq.${teleCallerId},assigned_telecaller_id.eq.${teleCallerId}`,
      );
    }

    // Previous period for delta (same length window before start)
    const startMs = new Date(range.start).getTime();
    const endMs = new Date(range.end).getTime();
    const span = Math.max(0, endMs - startMs);
    const prevStart = new Date(startMs - span - 1).toISOString();
    const prevEnd = new Date(startMs - 1).toISOString();

    let prevCallsQ = db
      .from('telecaller_call_logs')
      .select('telecaller_id, call_status, call_duration')
      .gte('created_at', prevStart)
      .lte('created_at', prevEnd)
      .limit(aggLimit);
    if (!seeTeam) prevCallsQ = prevCallsQ.eq('telecaller_id', teleCallerId);

    let prevLeadsQ = db
      .from('service_leads')
      .select('id, created_by_id, assigned_telecaller_id, status, updated_at')
      .gte('updated_at', prevStart)
      .lte('updated_at', prevEnd)
      .limit(aggLimit);
    if (!seeTeam) {
      prevLeadsQ = prevLeadsQ.or(
        `created_by_id.eq.${teleCallerId},assigned_telecaller_id.eq.${teleCallerId}`,
      );
    }

    const [usersRes, callsRes, leadsRes, prevCallsRes, prevLeadsRes] = await Promise.all([
      usersQ,
      callsQ,
      leadsQ,
      prevCallsQ,
      prevLeadsQ,
    ]);
    if (usersRes.error) throw usersRes.error;
    if (callsRes.error) throw callsRes.error;
    const leadsRows = leadsRes.error ? [] : leadsRes.data || [];
    const prevCalls = prevCallsRes.error ? [] : prevCallsRes.data || [];
    const prevLeads = prevLeadsRes.error ? [] : prevLeadsRes.data || [];

    const nameById = new Map<string, { full_name: string | null; phone: string | null }>();
    for (const u of usersRes.data || []) {
      nameById.set(String(u.id), {
        full_name: u.full_name ? String(u.full_name) : null,
        phone: u.phone ? String(u.phone) : null,
      });
    }

    const byId = new Map<string, Agg>();
    const ensure = (id: string): Agg => {
      let a = byId.get(id);
      if (!a) {
        a = emptyAgg(id);
        byId.set(id, a);
      }
      return a;
    };

    const teamHourly = Array.from({ length: 24 }, () => 0);
    const teamStatusMix: Record<string, number> = {};

    for (const row of callsRes.data || []) {
      const id = String(row.telecaller_id || '');
      if (!id) continue;
      const a = ensure(id);
      a.calls += 1;
      const dur = Number(row.call_duration) || 0;
      a.duration += dur;
      const st = String(row.call_status || 'UNKNOWN').toUpperCase() || 'UNKNOWN';
      a.statusMix[st] = (a.statusMix[st] || 0) + 1;
      teamStatusMix[st] = (teamStatusMix[st] || 0) + 1;

      if (isAnsweredCall(st, dur)) a.answered += 1;
      if (isMissedCall(st, dur)) a.missed += 1;
      if (dur > 0 && dur < 15) a.shortCalls += 1;

      const type = String(row.call_type || '').toUpperCase();
      if (type === 'INBOUND') a.inbound += 1;
      else a.outbound += 1;

      if (String(row.call_recording_url || '').trim()) a.withRecording += 1;
      if (String(row.notes || '').trim()) a.withNotes += 1;

      const at = row.created_at ? String(row.created_at) : null;
      if (at) {
        if (!a.firstCallAt || at < a.firstCallAt) a.firstCallAt = at;
        if (!a.lastCallAt || at > a.lastCallAt) a.lastCallAt = at;
        try {
          const d = new Date(at);
          const istMs = d.getTime() + 5.5 * 60 * 60 * 1000;
          const h = new Date(istMs).getUTCHours();
          if (h >= 0 && h < 24) {
            a.hourly[h] += 1;
            teamHourly[h] += 1;
          }
        } catch {
          /* ignore */
        }
      }
    }

    for (const row of leadsRows) {
      const owner = String(row.created_by_id || row.assigned_telecaller_id || '');
      if (!owner) continue;
      if (!seeTeam && owner !== teleCallerId) continue;
      if (!isBookedLeadStatus(row.status)) continue;
      const a = ensure(owner);
      a.bookings += 1;
      const st = String(row.status || '').toUpperCase().replace(/\s+/g, '_');
      if (st === 'COMPLETED' || st === 'SERVICE_DONE') a.completed += 1;
    }

    // Previous period totals (for delta cards)
    let prevCallsCount = 0;
    let prevAnswered = 0;
    let prevDuration = 0;
    for (const row of prevCalls) {
      prevCallsCount += 1;
      const dur = Number(row.call_duration) || 0;
      prevDuration += dur;
      if (isAnsweredCall(row.call_status, dur)) prevAnswered += 1;
    }
    let prevBookings = 0;
    for (const row of prevLeads) {
      const owner = String(row.created_by_id || row.assigned_telecaller_id || '');
      if (!owner) continue;
      if (!seeTeam && owner !== teleCallerId) continue;
      if (isBookedLeadStatus(row.status)) prevBookings += 1;
    }

    if (seeTeam) {
      for (const id of nameById.keys()) ensure(id);
    } else {
      ensure(teleCallerId);
    }

    let members = Array.from(byId.values())
      .filter((a) => seeTeam || a.id === teleCallerId)
      .map((a) => finalizeMember(a, nameById.get(a.id)));

    const sortFn = (a: (typeof members)[0], b: (typeof members)[0]) => {
      if (sortBy === 'calls') return b.calls - a.calls || b.score - a.score;
      if (sortBy === 'talk') return b.duration_seconds - a.duration_seconds || b.score - a.score;
      if (sortBy === 'bookings') return b.bookings - a.bookings || b.score - a.score;
      return b.score - a.score || b.calls - a.calls;
    };
    members = members.sort(sortFn);

    const ranked = members.map((m, i) => ({ ...m, rank: i + 1 }));

    const totalsBase = ranked.reduce(
      (acc, m) => {
        acc.calls += m.calls;
        acc.answered += m.answered;
        acc.missed += m.missed;
        acc.short_calls += m.short_calls;
        acc.duration_seconds += m.duration_seconds;
        acc.bookings += m.bookings;
        acc.completed += m.completed;
        acc.with_recording += m.with_recording;
        acc.with_notes += m.with_notes;
        acc.inbound += m.inbound;
        acc.outbound += m.outbound;
        return acc;
      },
      {
        calls: 0,
        answered: 0,
        missed: 0,
        short_calls: 0,
        duration_seconds: 0,
        bookings: 0,
        completed: 0,
        with_recording: 0,
        with_notes: 0,
        inbound: 0,
        outbound: 0,
      },
    );

    const totals = {
      ...totalsBase,
      connect_rate: totalsBase.calls ? totalsBase.answered / totalsBase.calls : 0,
      avg_talk_seconds: totalsBase.answered
        ? Math.round(totalsBase.duration_seconds / totalsBase.answered)
        : 0,
      book_rate: totalsBase.answered ? totalsBase.bookings / totalsBase.answered : 0,
      recording_rate: totalsBase.answered
        ? totalsBase.with_recording / totalsBase.answered
        : 0,
      notes_rate: totalsBase.calls ? totalsBase.with_notes / totalsBase.calls : 0,
      score: scoreMember({
        calls: totalsBase.calls,
        answered: totalsBase.answered,
        duration: totalsBase.duration_seconds,
        bookings: totalsBase.bookings,
        withRecording: totalsBase.with_recording,
        withNotes: totalsBase.with_notes,
      }),
    };

    const delta = {
      calls: totals.calls - prevCallsCount,
      answered: totals.answered - prevAnswered,
      duration_seconds: totals.duration_seconds - prevDuration,
      bookings: totals.bookings - prevBookings,
    };

    const peakHour = teamHourly.reduce(
      (best, count, hour) => (count > best.count ? { hour, count } : best),
      { hour: 0, count: 0 },
    );

    return NextResponse.json(
      {
        ok: true,
        source: 'call_logs_v2',
        sort: sortBy,
        range: {
          period: range.period,
          start: range.start,
          end: range.end,
          start_ymd: range.startYmd,
          end_ymd: range.endYmd,
          label: range.label,
        },
        previous_range: { start: prevStart, end: prevEnd },
        team_size: ranked.length,
        totals,
        delta,
        insights: {
          peak_hour_ist: peakHour.count > 0 ? peakHour.hour : null,
          peak_hour_calls: peakHour.count,
          hourly: teamHourly.map((count, hour) => ({ hour, count })),
          status_mix: teamStatusMix,
          top_performer: ranked[0]
            ? { id: ranked[0].id, full_name: ranked[0].full_name, score: ranked[0].score }
            : null,
        },
        members: ranked,
      },
      { headers: { 'Cache-Control': 'private, max-age=15' } },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
