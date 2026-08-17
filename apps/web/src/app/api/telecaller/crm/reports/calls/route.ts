import { NextRequest, NextResponse } from 'next/server';
import {
  isNextResponse,
  requireCrmReportsContext,
} from '@/lib/telecaller/crmReportsAuth';
import { resolveReportPeriod } from '@/lib/telecaller/crmReportsRange';

export const dynamic = 'force-dynamic';

/**
 * Call report: lean log scan for charts + small joined list for the feed.
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
    const listLimit = Math.min(120, Math.max(40, Number(sp.get('limit') || 80) || 80));

    const applyTc = (query: any) => {
      if (!seesAll) return query.eq('telecaller_id', teleCallerId);
      if (filterTc) return query.eq('telecaller_id', filterTc);
      return query;
    };

    // Chart/summary: no joins, capped for year/month windows
    const aggLimit = range.period === 'day' ? 2500 : range.period === 'week' ? 4000 : 5000;
    let aggQ = applyTc(
      db
        .from('telecaller_call_logs')
        .select('call_type, call_status, call_duration, created_at, lead_id')
        .gte('created_at', range.start)
        .lte('created_at', range.end)
        .limit(aggLimit),
    );

    // List feed: light lead join only
    let listQ = applyTc(
      db
        .from('telecaller_call_logs')
        .select(
          `
          id, telecaller_id, call_type, call_status, call_duration, phone_number, created_at,
          lead:service_leads!lead_id(
            id, lead_number, customer_name, customer_phone, status, is_incomplete
          )
        `,
        )
        .gte('created_at', range.start)
        .lte('created_at', range.end)
        .order('created_at', { ascending: false })
        .limit(listLimit),
    );

    const [aggRes, listRes] = await Promise.all([aggQ, listQ]);
    if (aggRes.error) throw aggRes.error;
    if (listRes.error) throw listRes.error;

    const aggRows = aggRes.data || [];
    let listRows = listRes.data || [];

    if (q) {
      listRows = listRows.filter((r: any) => {
        const lead = r.lead || {};
        const hay = [lead.customer_name, lead.customer_phone, lead.lead_number, r.phone_number]
          .map((x) => String(x || '').toLowerCase())
          .join(' ');
        return hay.includes(q);
      });
    }

    const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
    let incoming = 0;
    let outgoing = 0;
    let missed = 0;
    let connected = 0;
    let duration = 0;
    let firstAt: string | null = null;
    let lastAt: string | null = null;
    const seenLeads = new Set<string>();
    const stageMap = new Map<string, number>();

    for (const r of aggRows) {
      const at = r.created_at ? new Date(r.created_at) : null;
      if (at && !Number.isNaN(at.getTime())) {
        // IST hour via offset (faster than Intl per row)
        const istMs = at.getTime() + 5.5 * 60 * 60 * 1000;
        const h = new Date(istMs).getUTCHours();
        hourly[h].count += 1;
        const iso = at.toISOString();
        if (!firstAt || iso < firstAt) firstAt = iso;
        if (!lastAt || iso > lastAt) lastAt = iso;
      }

      const type = String(r.call_type || '').toUpperCase();
      if (type === 'INBOUND') incoming += 1;
      else outgoing += 1;

      const status = String(r.call_status || '').toUpperCase();
      const dur = Number(r.call_duration) || 0;
      duration += dur;
      if (status === 'NO_ANSWER' || status === 'BUSY' || status === 'SWITCHED_OFF') missed += 1;
      if (dur >= 1 || status === 'ANSWERED' || status === 'COMPLETED') connected += 1;

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
        summary: {
          total_calls: aggRows.length,
          duration_seconds: duration,
          incoming,
          outgoing,
          missed,
          connected,
          first_call_at: firstAt,
          last_call_at: lastAt,
          unique_leads: seenLeads.size,
          truncated: aggRows.length >= aggLimit,
        },
        hourly,
        stages: Array.from(stageMap.entries()).map(([label, count]) => ({ label, count })),
        calls: listRows.map((r: any) => ({
          id: r.id,
          created_at: r.created_at,
          call_type: r.call_type,
          call_status: r.call_status,
          call_duration: r.call_duration,
          phone_number: r.phone_number,
          telecaller_id: r.telecaller_id,
          lead: r.lead
            ? {
                id: r.lead.id,
                lead_number: r.lead.lead_number,
                customer_name: r.lead.customer_name,
                customer_phone: r.lead.customer_phone,
                status: r.lead.status,
                is_incomplete: r.lead.is_incomplete,
                telecaller_name: null,
              }
            : null,
        })),
      },
      { headers: { 'Cache-Control': 'private, max-age=20' } },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
