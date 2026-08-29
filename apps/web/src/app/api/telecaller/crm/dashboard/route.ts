import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  crmSeesAllLeads,
  isTelecallerCrmRole,
  normalizeRoleCode,
} from '@/lib/telecaller/crmRoles';
import { applyCrmNewLeadFilter } from '@/lib/telecaller/crmLeadFilters';

export const dynamic = 'force-dynamic';

function dayBoundsFromParam(raw: string | null, fallbackYmd: string) {
  const v = String(raw || '').trim();
  if (!v) {
    return {
      start: `${fallbackYmd}T00:00:00.000+05:30`,
      end: `${fallbackYmd}T23:59:59.999+05:30`,
      ymd: fallbackYmd,
    };
  }
  // Full ISO already (from mobile CRM)
  if (v.includes('T')) {
    const ymd = v.slice(0, 10);
    return { start: v, end: v, ymd };
  }
  const ymd = v.slice(0, 10);
  return {
    start: `${ymd}T00:00:00.000+05:30`,
    end: `${ymd}T23:59:59.999+05:30`,
    ymd,
  };
}

function istYmdToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * GET /api/telecaller/crm/dashboard?from=&to=&all=1
 * Aggregated home KPIs + 7-day trend for Advanced CRM Home tab.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const profile = await resolveUserProfile(supabase, user);
    const teleCallerId = String(profile?.id || '').trim();
    if (!teleCallerId) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const roleCode = normalizeRoleCode((profile as { roles?: { role_code?: string } })?.roles?.role_code);
    if (!isTelecallerCrmRole(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const seesAll = crmSeesAllLeads(roleCode);
    const telecallerFilter = String(new URL(request.url).searchParams.get('telecaller_id') || '').trim();

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = (supabaseAdmin ?? supabase) as any;

    const url = new URL(request.url);
    const allTime =
      url.searchParams.get('all') === '1' ||
      url.searchParams.get('all_time') === '1' ||
      String(url.searchParams.get('preset') || '').toLowerCase() === 'all_time';

    const today = istYmdToday();
    const fromRaw = url.searchParams.get('from');
    const toRaw = url.searchParams.get('to');

    let rangeStart: string | null = null;
    let rangeEnd: string | null = null;
    let fromYmd = today;
    let toYmd = today;

    if (!allTime) {
      const fromB = dayBoundsFromParam(fromRaw, today);
      const toB = dayBoundsFromParam(toRaw, today);
      // When mobile sends full ISO start/end, use them directly
      if (fromRaw && fromRaw.includes('T') && toRaw && toRaw.includes('T')) {
        rangeStart = fromRaw;
        rangeEnd = toRaw;
        fromYmd = fromRaw.slice(0, 10);
        toYmd = toRaw.slice(0, 10);
      } else {
        rangeStart = fromB.start;
        rangeEnd = toB.end;
        fromYmd = fromB.ymd;
        toYmd = toB.ymd;
      }
    }

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    const weekStartParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(weekAgo);
    const wg = (t: string) => weekStartParts.find((p) => p.type === t)?.value || '';
    const weekStart = `${wg('year')}-${wg('month')}-${wg('day')}`;

    // Telecallers only see leads assigned to them; Lead Manager / admins see full pool.
    const assignedToMe = teleCallerId;
    const applyAssignee = (q: any) => {
      if (seesAll) {
        if (telecallerFilter) return q.eq('assigned_telecaller_id', telecallerFilter);
        return q;
      }
      return q.or(
        `assigned_telecaller_id.eq.${assignedToMe},created_by_id.eq.${assignedToMe}`,
      );
    };

    const applyCreatedRange = (q: any) => {
      if (rangeStart && rangeEnd) return q.gte('created_at', rangeStart).lte('created_at', rangeEnd);
      return q;
    };
    /** Disposition tiles (Interested / Callback / …) count by when the call result was set. */
    const applyActivityRange = (q: any) => {
      if (rangeStart && rangeEnd) return q.gte('last_call_at', rangeStart).lte('last_call_at', rangeEnd);
      return q;
    };
    const applyFuRange = (q: any) => {
      if (rangeStart && rangeEnd) {
        return q.gte('next_follow_up_at', rangeStart).lte('next_follow_up_at', rangeEnd);
      }
      return q;
    };
    const applyCallRange = (q: any) => {
      if (rangeStart && rangeEnd) return q.gte('created_at', rangeStart).lte('created_at', rangeEnd);
      return q;
    };

    const leadBase = () =>
      applyAssignee(
        db
          .from('service_leads')
          .select('id', { count: 'exact', head: true })
          .is('deleted_at', null),
      );

    const followUpBase = () =>
      applyAssignee(
        db
          .from('service_leads')
          .select('id', { count: 'exact', head: true })
          .eq('follow_up_required', true)
          .is('deleted_at', null),
      );

    const freshPreviewQuery = applyCreatedRange(
      applyCrmNewLeadFilter(
        applyAssignee(
          db
            .from('service_leads')
            .select(
              'id, lead_number, customer_name, customer_phone, city, created_at, vehicle_make, vehicle_model',
            )
            .is('deleted_at', null),
        ),
      ),
    )
      .order('created_at', { ascending: false })
      .limit(5);

    const todayStartIso = `${today}T00:00:00.000+05:30`;
    const todayEndIso = `${today}T23:59:59.999+05:30`;
    const pendingFollowUpCount = () =>
      seesAll
        ? db.from('telecaller_follow_ups').select('id', { count: 'exact', head: true }).eq('status', 'PENDING')
        : db
            .from('telecaller_follow_ups')
            .select('id', { count: 'exact', head: true })
            .eq('telecaller_id', teleCallerId)
            .eq('status', 'PENDING');

    const [
      totalLeads,
      newLeads,
      incomplete,
      interested,
      willVisit,
      callbackStatus,
      bookingConfirmed,
      inService,
      serviceDone,
      lost,
      overdueCallbacks,
      followUps,
      pendingReminders,
      rangeCalls,
      metrics,
      attendance,
      freshPreview,
    ] = await Promise.all([
      applyCreatedRange(leadBase()),
      // Same filters as /api/telecaller/crm/leads?filter=…
      applyCreatedRange(applyCrmNewLeadFilter(leadBase())),
      applyCreatedRange(leadBase().eq('is_incomplete', true)),
      applyActivityRange(leadBase().filter('coupon_meta->>last_call_result', 'eq', 'INTERESTED')),
      applyActivityRange(leadBase().filter('coupon_meta->>last_call_result', 'eq', 'WILL_VISIT')),
      applyActivityRange(leadBase().filter('coupon_meta->>last_call_result', 'eq', 'CALLBACK')),
      applyCreatedRange(leadBase().eq('status', 'VALIDATED')),
      applyCreatedRange(leadBase().eq('status', 'IN_PROGRESS')),
      applyCreatedRange(leadBase().eq('status', 'COMPLETED')),
      applyCreatedRange(leadBase().eq('status', 'REJECTED')),
      applyFuRange(followUpBase().lte('next_follow_up_at', new Date().toISOString())),
      pendingFollowUpCount().gte('scheduled_time', todayStartIso).lte('scheduled_time', todayEndIso),
      pendingFollowUpCount(),
      seesAll
        ? applyCallRange(db.from('telecaller_call_logs').select('call_status, call_duration'))
        : applyCallRange(
            db
              .from('telecaller_call_logs')
              .select('call_status, call_duration')
              .eq('telecaller_id', teleCallerId),
          ),
      seesAll
        ? db
            .from('telecaller_performance_metrics')
            .select(
              'date, total_calls, answered_calls, leads_created, leads_completed, call_to_lead_conversion_rate',
            )
            .gte('date', weekStart)
            .lte('date', today)
            .order('date', { ascending: true })
        : db
            .from('telecaller_performance_metrics')
            .select(
              'date, total_calls, answered_calls, leads_created, leads_completed, call_to_lead_conversion_rate',
            )
            .eq('telecaller_id', teleCallerId)
            .gte('date', weekStart)
            .lte('date', today)
            .order('date', { ascending: true }),
      seesAll
        ? Promise.resolve({ data: null })
        : db
            .from('telecaller_attendance')
            .select('*')
            .eq('telecaller_id', teleCallerId)
            .is('punch_out_at', null)
            .maybeSingle(),
      freshPreviewQuery,
    ]);

    const calls = rangeCalls.data || [];
    const answered = calls.filter((c: any) => c.call_status === 'ANSWERED').length;
    const talkDurationSeconds = calls.reduce(
      (sum: number, c: any) => sum + (Number(c.call_duration) || 0),
      0,
    );

    // Upcoming reminders — top 3 pending for today (IST)
    let upcomingReminders: any[] = [];
    try {
      let remQ = db
        .from('telecaller_follow_ups')
        .select(
          'id, scheduled_time, reason, priority, lead_id, lead:service_leads(id, customer_name, customer_phone)',
        )
        .eq('status', 'PENDING')
        .gte('scheduled_time', todayStartIso)
        .lte('scheduled_time', todayEndIso)
        .order('scheduled_time', { ascending: true })
        .limit(3);
      if (!seesAll) remQ = remQ.eq('telecaller_id', teleCallerId);
      const remRes = await remQ;
      upcomingReminders = remRes.data || [];
    } catch {
      upcomingReminders = [];
    }

    // My rank today (by calls among telecallers with metrics today)
    let myRank: number | null = null;
    let leaderboardSize = 0;
    try {
      const { data: rankRows } = await db
        .from('telecaller_performance_metrics')
        .select('telecaller_id, total_calls')
        .eq('date', today)
        .order('total_calls', { ascending: false });
      const rows = Array.isArray(rankRows) ? rankRows : [];
      leaderboardSize = rows.length;
      const idx = rows.findIndex((r: any) => String(r.telecaller_id) === teleCallerId);
      myRank = idx >= 0 ? idx + 1 : null;
    } catch {
      myRank = null;
    }

    const seriesMap: Record<string, any> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const keyParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
      }).formatToParts(d);
      const g = (t: string) => keyParts.find((p) => p.type === t)?.value || '';
      const key = `${g('year')}-${g('month')}-${g('day')}`;
      seriesMap[key] = {
        date: key,
        label: g('weekday'),
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
    if (!(metrics.data || []).length && calls.length && fromYmd === today && toYmd === today && !allTime) {
      const todayPoint = trend[trend.length - 1] as any;
      if (todayPoint) {
        todayPoint.calls = calls.length;
        todayPoint.answered = answered;
      }
    }

    return NextResponse.json({
      success: true,
      range: { from: fromYmd, to: toYmd, all_time: allTime },
      kpis: {
        total_leads: totalLeads.count || 0,
        new_leads: newLeads.count || 0,
        incomplete: incomplete.count || 0,
        interested: interested.count || 0,
        will_visit: willVisit.count || 0,
        callbacks: callbackStatus.count || 0,
        booking_confirmed: bookingConfirmed.count || 0,
        in_service: inService.count || 0,
        service_done: serviceDone.count || 0,
        lost: lost.count || 0,
        // aliases / ops queues (still useful elsewhere)
        booked: bookingConfirmed.count || 0,
        rejected: lost.count || 0,
        overdue_callbacks: overdueCallbacks.count || 0,
        followups_today: followUps.count || 0,
        reminders_pending: pendingReminders.count || 0,
        today_calls: calls.length,
        answered_calls: answered,
        answer_rate: calls.length ? Math.round((answered / calls.length) * 100) : 0,
        talk_duration_seconds: talkDurationSeconds,
        my_rank: myRank,
        leaderboard_size: leaderboardSize,
      },
      upcoming_reminders: upcomingReminders,
      fresh_leads: Array.isArray(freshPreview?.data) ? freshPreview.data : [],
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
