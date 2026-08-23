import { NextRequest, NextResponse } from 'next/server';
import {
  isNextResponse,
  requireCrmReportsContext,
} from '@/lib/telecaller/crmReportsAuth';
import { resolveReportPeriod } from '@/lib/telecaller/crmReportsRange';

export const dynamic = 'force-dynamic';

function isConnected(status: unknown, duration: unknown) {
  const st = String(status || '').toUpperCase();
  const dur = Number(duration) || 0;
  return dur >= 1 || st === 'ANSWERED' || st === 'COMPLETED' || st === 'CONNECTED';
}

function isMissed(status: unknown, duration: unknown) {
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

/**
 * Advanced call activity: summary + hourly talk + filters + richer feed.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireCrmReportsContext(request);
    if (isNextResponse(ctx)) return ctx;
    const { db, teleCallerId, seesAll } = ctx;

    const sp = new URL(request.url).searchParams;
    const range = resolveReportPeriod(sp.get('period') || 'day', sp.get('date'));
    const filterTc = String(sp.get('telecaller_id') || '').trim();
    const q = String(sp.get('q') || '').trim().toLowerCase();
    const statusFilter = String(sp.get('status') || 'ALL').trim().toUpperCase();
    const typeFilter = String(sp.get('type') || 'ALL').trim().toUpperCase();
    const durationFilter = String(sp.get('duration') || 'ALL').trim().toUpperCase(); // ALL | CONNECTED | SHORT | ZERO
    const listLimit = Math.min(200, Math.max(40, Number(sp.get('limit') || 100) || 100));

    const applyTc = (query: any) => {
      if (!seesAll) return query.eq('telecaller_id', teleCallerId);
      if (filterTc) return query.eq('telecaller_id', filterTc);
      return query;
    };

    const aggLimit = range.period === 'day' ? 3000 : range.period === 'week' ? 5000 : 6000;

    let aggQ = applyTc(
      db
        .from('telecaller_call_logs')
        .select(
          'id, call_type, call_status, call_duration, created_at, lead_id, call_recording_url, notes, phone_number, telecaller_id',
        )
        .gte('created_at', range.start)
        .lte('created_at', range.end)
        .limit(aggLimit),
    );

    let listQ = applyTc(
      db
        .from('telecaller_call_logs')
        .select(
          `
          id, telecaller_id, call_type, call_status, call_duration, phone_number, notes,
          call_recording_url, created_at,
          lead:service_leads!lead_id(
            id, lead_number, customer_name, customer_phone, status, is_incomplete,
            assigned_telecaller_id
          ),
          telecaller:telecaller_id(full_name)
        `,
        )
        .gte('created_at', range.start)
        .lte('created_at', range.end)
        .order('created_at', { ascending: false })
        .limit(listLimit),
    );

    // Previous period for deltas
    const startMs = new Date(range.start).getTime();
    const endMs = new Date(range.end).getTime();
    const span = Math.max(0, endMs - startMs);
    const prevStart = new Date(startMs - span - 1).toISOString();
    const prevEnd = new Date(startMs - 1).toISOString();
    let prevQ = applyTc(
      db
        .from('telecaller_call_logs')
        .select('call_status, call_duration')
        .gte('created_at', prevStart)
        .lte('created_at', prevEnd)
        .limit(aggLimit),
    );

    const [aggRes, listRes, prevRes] = await Promise.all([aggQ, listQ, prevQ]);
    if (aggRes.error) throw aggRes.error;
    if (listRes.error) throw listRes.error;

    const aggRows = aggRes.data || [];
    let listRows = listRes.data || [];
    const prevRows = prevRes.error ? [] : prevRes.data || [];

    const matchFilters = (r: any) => {
      const status = String(r.call_status || '').toUpperCase();
      const type = String(r.call_type || '').toUpperCase();
      const dur = Number(r.call_duration) || 0;
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'CONNECTED') {
          if (!isConnected(status, dur)) return false;
        } else if (statusFilter === 'MISSED') {
          if (!isMissed(status, dur)) return false;
        } else if (statusFilter === 'RINGING') {
          if (status !== 'RINGING' && status !== 'INITIATED') return false;
        } else if (status !== statusFilter) return false;
      }
      if (typeFilter !== 'ALL') {
        if (typeFilter === 'INBOUND' && type !== 'INBOUND') return false;
        if (typeFilter === 'OUTBOUND' && type === 'INBOUND') return false;
      }
      if (durationFilter === 'CONNECTED' && !isConnected(status, dur)) return false;
      if (durationFilter === 'SHORT' && !(dur > 0 && dur < 15)) return false;
      if (durationFilter === 'ZERO' && dur !== 0) return false;
      return true;
    };

    const filteredAgg = aggRows.filter(matchFilters);

    if (q) {
      listRows = listRows.filter((r: any) => {
        const lead = r.lead || {};
        const hay = [
          lead.customer_name,
          lead.customer_phone,
          lead.lead_number,
          r.phone_number,
          r.telecaller?.full_name,
        ]
          .map((x) => String(x || '').toLowerCase())
          .join(' ');
        return hay.includes(q);
      });
    }
    listRows = listRows.filter(matchFilters);

    const hourly = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: 0,
      talk: 0,
      answered: 0,
    }));
    let incoming = 0;
    let outgoing = 0;
    let missed = 0;
    let connected = 0;
    let shortCalls = 0;
    let withRecording = 0;
    let withNotes = 0;
    let duration = 0;
    let firstAt: string | null = null;
    let lastAt: string | null = null;
    const seenLeads = new Set<string>();
    const statusMix: Record<string, number> = {};
    const stageMap = new Map<string, number>();

    for (const r of filteredAgg) {
      const at = r.created_at ? new Date(r.created_at) : null;
      const dur = Number(r.call_duration) || 0;
      const status = String(r.call_status || 'UNKNOWN').toUpperCase() || 'UNKNOWN';
      duration += dur;
      statusMix[status] = (statusMix[status] || 0) + 1;

      if (at && !Number.isNaN(at.getTime())) {
        const istMs = at.getTime() + 5.5 * 60 * 60 * 1000;
        const h = new Date(istMs).getUTCHours();
        hourly[h].count += 1;
        hourly[h].talk += dur;
        if (isConnected(status, dur)) hourly[h].answered += 1;
        const iso = at.toISOString();
        if (!firstAt || iso < firstAt) firstAt = iso;
        if (!lastAt || iso > lastAt) lastAt = iso;
      }

      const type = String(r.call_type || '').toUpperCase();
      if (type === 'INBOUND') incoming += 1;
      else outgoing += 1;

      if (isMissed(status, dur)) missed += 1;
      if (isConnected(status, dur)) connected += 1;
      if (dur > 0 && dur < 15) shortCalls += 1;
      if (String(r.call_recording_url || '').trim()) withRecording += 1;
      if (String(r.notes || '').trim()) withNotes += 1;
      if (r.lead_id) seenLeads.add(String(r.lead_id));
    }

    for (const r of listRows) {
      const lead = r.lead;
      if (!lead?.id) continue;
      const key = lead.is_incomplete
        ? 'Incomplete'
        : String(lead.status || 'NEW').replace(/_/g, ' ');
      stageMap.set(key, (stageMap.get(key) || 0) + 1);
    }

    let prevCalls = 0;
    let prevConnected = 0;
    let prevDuration = 0;
    for (const r of prevRows) {
      prevCalls += 1;
      const dur = Number(r.call_duration) || 0;
      prevDuration += dur;
      if (isConnected(r.call_status, dur)) prevConnected += 1;
    }

    const peak = hourly.reduce(
      (best, row) => (row.count > best.count ? row : best),
      { hour: 0, count: 0, talk: 0, answered: 0 },
    );

    return NextResponse.json(
      {
        ok: true,
        source: 'call_logs_v2',
        filters: {
          status: statusFilter,
          type: typeFilter,
          duration: durationFilter,
          q: q || null,
        },
        range: {
          period: range.period,
          start: range.start,
          end: range.end,
          start_ymd: range.startYmd,
          end_ymd: range.endYmd,
          label: range.label,
        },
        summary: {
          total_calls: filteredAgg.length,
          duration_seconds: duration,
          avg_talk_seconds: connected ? Math.round(duration / connected) : 0,
          connect_rate: filteredAgg.length ? connected / filteredAgg.length : 0,
          incoming,
          outgoing,
          missed,
          connected,
          short_calls: shortCalls,
          with_recording: withRecording,
          recording_rate: connected ? withRecording / connected : 0,
          with_notes: withNotes,
          notes_rate: filteredAgg.length ? withNotes / filteredAgg.length : 0,
          first_call_at: firstAt,
          last_call_at: lastAt,
          unique_leads: seenLeads.size,
          truncated: aggRows.length >= aggLimit,
        },
        delta: {
          calls: filteredAgg.length - prevCalls,
          connected: connected - prevConnected,
          duration_seconds: duration - prevDuration,
        },
        insights: {
          peak_hour_ist: peak.count > 0 ? peak.hour : null,
          peak_hour_calls: peak.count,
          status_mix: statusMix,
        },
        hourly,
        stages: Array.from(stageMap.entries())
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count),
        calls: listRows.map((r: any) => ({
          id: r.id,
          created_at: r.created_at,
          call_type: r.call_type,
          call_status: r.call_status,
          call_duration: r.call_duration,
          phone_number: r.phone_number,
          notes: r.notes || null,
          has_recording: Boolean(String(r.call_recording_url || '').trim()),
          telecaller_id: r.telecaller_id,
          telecaller_name: r.telecaller?.full_name || null,
          lead: r.lead
            ? {
                id: r.lead.id,
                lead_number: r.lead.lead_number,
                customer_name: r.lead.customer_name,
                customer_phone: r.lead.customer_phone,
                status: r.lead.status,
                is_incomplete: r.lead.is_incomplete,
                telecaller_name: r.telecaller?.full_name || null,
              }
            : null,
        })),
      },
      { headers: { 'Cache-Control': 'private, max-age=15' } },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
