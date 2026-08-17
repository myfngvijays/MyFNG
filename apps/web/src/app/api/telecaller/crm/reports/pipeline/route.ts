import { NextRequest, NextResponse } from 'next/server';
import {
  isNextResponse,
  requireCrmReportsContext,
} from '@/lib/telecaller/crmReportsAuth';

export const dynamic = 'force-dynamic';

function dayBounds(ymd: string, endOfDay: boolean) {
  const day = String(ymd || '').slice(0, 10);
  return endOfDay ? `${day}T23:59:59.999+05:30` : `${day}T00:00:00.000+05:30`;
}

/**
 * Pipeline analytics — lean columns, no join; workshop names batched.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireCrmReportsContext(request);
    if (isNextResponse(ctx)) return ctx;
    const { db, seesAll } = ctx;

    if (!seesAll) {
      return NextResponse.json({ error: 'Lead Manager / admin only' }, { status: 403 });
    }

    const sp = new URL(request.url).searchParams;
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const fromYmd = String(sp.get('from') || today).slice(0, 10);
    const toYmd = String(sp.get('to') || today).slice(0, 10);
    const start = dayBounds(fromYmd, false);
    const end = dayBounds(toYmd, true);

    const { data, error } = await db
      .from('service_leads')
      .select(
        'status, city, lead_priority, sla_state, created_at, is_incomplete, workshop_id',
      )
      .is('deleted_at', null)
      .gte('created_at', start)
      .lte('created_at', end)
      .limit(3000);

    if (error) throw error;
    const rows = data || [];

    const statusCounts: Record<string, number> = {};
    const cityCounts: Record<string, number> = {};
    const priorityCounts: Record<string, number> = {};
    const dailyData: Record<string, { date: string; total: number; validated: number; assigned: number }> =
      {};
    const workshopStats: Record<
      string,
      { total: number; accepted: number; completed: number; rejected: number }
    > = {};

    let validated = 0;
    let incomplete = 0;
    let assigned = 0;
    let onTime = 0;
    let atRisk = 0;
    let breached = 0;

    for (const lead of rows) {
      const status = String(lead.status || 'UNKNOWN');
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      if (status === 'VALIDATED') validated += 1;
      if (lead.is_incomplete) incomplete += 1;
      if (['ASSIGNED_TO_WORKSHOP', 'ACCEPTED', 'IN_PROGRESS', 'VALIDATED'].includes(status)) {
        assigned += 1;
      }

      const city = String(lead.city || 'Unknown').trim() || 'Unknown';
      cityCounts[city] = (cityCounts[city] || 0) + 1;

      const priority = String(lead.lead_priority || 'NORMAL').toUpperCase();
      priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;

      const date = String(lead.created_at || '').slice(0, 10);
      if (date) {
        if (!dailyData[date]) dailyData[date] = { date, total: 0, validated: 0, assigned: 0 };
        dailyData[date].total += 1;
        if (status === 'VALIDATED') dailyData[date].validated += 1;
        if (['ASSIGNED_TO_WORKSHOP', 'ACCEPTED', 'IN_PROGRESS', 'VALIDATED'].includes(status)) {
          dailyData[date].assigned += 1;
        }
      }

      const sla = String(lead.sla_state || 'ON_TIME').toUpperCase();
      if (sla === 'AT_RISK') atRisk += 1;
      else if (sla === 'BREACHED') breached += 1;
      else onTime += 1;

      if (lead.workshop_id) {
        const wid = String(lead.workshop_id);
        if (!workshopStats[wid]) {
          workshopStats[wid] = { total: 0, accepted: 0, completed: 0, rejected: 0 };
        }
        workshopStats[wid].total += 1;
        if (status === 'ACCEPTED') workshopStats[wid].accepted += 1;
        if (status === 'COMPLETED') workshopStats[wid].completed += 1;
        if (status === 'REJECTED') workshopStats[wid].rejected += 1;
      }
    }

    const topWorkshopIds = Object.entries(workshopStats)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([id]) => id);

    let workshopNames = new Map<string, { name: string; city: string }>();
    if (topWorkshopIds.length > 0) {
      const { data: workshops } = await db
        .from('workshops')
        .select('id, name, city')
        .in('id', topWorkshopIds);
      for (const w of workshops || []) {
        workshopNames.set(String(w.id), {
          name: String(w.name || 'Unknown'),
          city: String(w.city || 'N/A'),
        });
      }
    }

    const total = rows.length;
    const denom = Math.max(total, 1);

    return NextResponse.json(
      {
        ok: true,
        range: { from: fromYmd, to: toYmd, start, end },
        stats: {
          total_leads: total,
          validated_leads: validated,
          incomplete_leads: incomplete,
          assigned_leads: assigned,
          validation_rate: Math.round((validated / denom) * 100),
          avg_validation_time: 0,
          truncated: total >= 3000,
        },
        status_breakdown: Object.entries(statusCounts)
          .map(([status, count]) => ({
            status,
            count,
            percentage: ((count / denom) * 100).toFixed(1),
          }))
          .sort((a, b) => b.count - a.count),
        city_distribution: Object.entries(cityCounts)
          .map(([city, count]) => ({
            city,
            count,
            percentage: ((count / denom) * 100).toFixed(1),
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        priority_distribution: Object.entries(priorityCounts).map(([priority, count]) => ({
          priority,
          count,
          percentage: ((count / denom) * 100).toFixed(1),
        })),
        daily_trends: Object.values(dailyData)
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(-14),
        workshop_performance: topWorkshopIds.map((id) => {
          const s = workshopStats[id];
          const meta = workshopNames.get(id);
          return {
            workshop_id: id,
            workshop_name: meta?.name || 'Unknown',
            city: meta?.city || 'N/A',
            total: s.total,
            accepted: s.accepted,
            completed: s.completed,
            rejected: s.rejected,
            acceptance_rate: s.total > 0 ? ((s.accepted / s.total) * 100).toFixed(1) : '0',
            completion_rate: s.total > 0 ? ((s.completed / s.total) * 100).toFixed(1) : '0',
          };
        }),
        sla: {
          on_time: onTime,
          at_risk: atRisk,
          breached: breached,
          on_time_percentage: Math.round((onTime / denom) * 100),
          at_risk_percentage: Math.round((atRisk / denom) * 100),
          breached_percentage: Math.round((breached / denom) * 100),
        },
      },
      { headers: { 'Cache-Control': 'private, max-age=30' } },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
