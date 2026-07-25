import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';

export const dynamic = 'force-dynamic';

/**
 * GET /api/telecaller/crm/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Aggregated home KPIs + 7-day trend for Advanced CRM Home tab.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const profile = await resolveUserProfile(supabase, user);
    const teleCallerId = String(profile?.id || '').trim();
    if (!teleCallerId) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const url = new URL(request.url);
    const today = new Date().toISOString().slice(0, 10);
    const from = String(url.searchParams.get('from') || today).slice(0, 10);
    const to = String(url.searchParams.get('to') || today).slice(0, 10);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    const weekStart = weekAgo.toISOString().slice(0, 10);

    const rangeStart = `${from}T00:00:00`;
    const rangeEnd = `${to}T23:59:59`;

    const [
      newLeads,
      callbacks,
      followUps,
      booked,
      incomplete,
      rejected,
      rangeCalls,
      metrics,
      attendance,
    ] = await Promise.all([
      supabase
        .from('service_leads')
        .select('id', { count: 'exact', head: true })
        .or(`assigned_telecaller_id.is.null,assigned_telecaller_id.eq.${teleCallerId}`)
        .eq('status', 'NEW')
        .is('last_call_at', null)
        .gte('created_at', rangeStart)
        .lte('created_at', rangeEnd),
      supabase
        .from('service_leads')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_telecaller_id', teleCallerId)
        .eq('follow_up_required', true)
        .lte('next_follow_up_at', rangeEnd)
        .gte('next_follow_up_at', rangeStart),
      supabase
        .from('telecaller_follow_ups')
        .select('id', { count: 'exact', head: true })
        .eq('telecaller_id', teleCallerId)
        .eq('status', 'PENDING')
        .gte('scheduled_time', rangeStart)
        .lte('scheduled_time', rangeEnd),
      supabase
        .from('service_leads')
        .select('id', { count: 'exact', head: true })
        .eq('created_by_id', teleCallerId)
        .in('status', ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'])
        .gte('created_at', rangeStart)
        .lte('created_at', rangeEnd),
      supabase
        .from('service_leads')
        .select('id', { count: 'exact', head: true })
        .or(`assigned_telecaller_id.is.null,assigned_telecaller_id.eq.${teleCallerId}`)
        .eq('is_incomplete', true)
        .gte('created_at', rangeStart)
        .lte('created_at', rangeEnd),
      supabase
        .from('service_leads')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_telecaller_id', teleCallerId)
        .eq('status', 'REJECTED')
        .gte('created_at', rangeStart)
        .lte('created_at', rangeEnd),
      supabase
        .from('telecaller_call_logs')
        .select('call_status')
        .eq('telecaller_id', teleCallerId)
        .gte('created_at', rangeStart)
        .lte('created_at', rangeEnd),
      supabase
        .from('telecaller_performance_metrics')
        .select('date, total_calls, answered_calls, leads_created, leads_completed, call_to_lead_conversion_rate')
        .eq('telecaller_id', teleCallerId)
        .gte('date', weekStart)
        .lte('date', today)
        .order('date', { ascending: true }),
      supabase
        .from('telecaller_attendance')
        .select('*')
        .eq('telecaller_id', teleCallerId)
        .is('punch_out_at', null)
        .maybeSingle(),
    ]);

    const calls = rangeCalls.data || [];
    const answered = calls.filter((c: any) => c.call_status === 'ANSWERED').length;

    const seriesMap: Record<string, any> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      seriesMap[key] = {
        date: key,
        label: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        calls: 0,
        answered: 0,
        leads_created: 0,
        leads_completed: 0,
        conversion: 0,
      };
    }
    (metrics.data || []).forEach((m: any) => {
      const key = String(m.date).slice(0, 10);
      if (seriesMap[key]) {
        seriesMap[key].calls = Number(m.total_calls || 0);
        seriesMap[key].answered = Number(m.answered_calls || 0);
        seriesMap[key].leads_created = Number(m.leads_created || 0);
        seriesMap[key].leads_completed = Number(m.leads_completed || 0);
        seriesMap[key].conversion = Number(m.call_to_lead_conversion_rate || 0);
      }
    });

    const trend = Object.values(seriesMap);
    if (!(metrics.data || []).length && calls.length && from === today && to === today) {
      const todayPoint = trend[trend.length - 1] as any;
      todayPoint.calls = calls.length;
      todayPoint.answered = answered;
    }

    return NextResponse.json({
      success: true,
      range: { from, to },
      kpis: {
        new_leads: newLeads.count || 0,
        callbacks: callbacks.count || 0,
        followups_today: followUps.count || 0,
        booked: booked.count || 0,
        incomplete: incomplete.count || 0,
        rejected: rejected.count || 0,
        today_calls: calls.length,
        answered_calls: answered,
        answer_rate: calls.length ? Math.round((answered / calls.length) * 100) : 0,
      },
      trend,
      attendance: {
        is_punched_in: Boolean(attendance.data),
        open_session: attendance.data || null,
      },
      profile: {
        id: profile.id,
        name: (profile as any).full_name || null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Dashboard failed' }, { status: 500 });
  }
}
