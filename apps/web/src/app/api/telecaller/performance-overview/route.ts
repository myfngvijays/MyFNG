import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import {
  HIGH_PRIORITY_PENDING_HOURS,
  TALK_TIME_SLOTS,
  ACTIONABLE_NEEDS_ATTENTION_LIMIT,
} from '@/lib/rsa/performanceConstants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isPending(lead: any) {
  const s = String(lead?.lead_status || lead?.complaint_status || '').toLowerCase();
  return s && s !== 'completed' && s !== 'closed' && s !== 'cancelled';
}

function pickLeadDate(lead: any) {
  return lead?.lead_registered_at || lead?.requested_at || lead?.created_at;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user || null;
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await resolveUserProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = String((profile.roles as any)?.role_code || '');
    if (!['TELECALLER', 'SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }
    const db = supabaseAdmin as any;

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const from = searchParams.get('from') || defaultFrom.toISOString();
    const to = searchParams.get('to') || now.toISOString();

    const telecallerId = profile.id;

    const { data: leads, error: leadErr } = await db
      .from('rsa_leads')
      .select(
        'id, lead_registered_at, requested_at, lead_status, complaint_status, customer_name, contact_number, assigned_mechanic_id, customer_quoted_amount'
      )
      .eq('registered_by_id', telecallerId)
      .gte('lead_registered_at', from)
      .lte('lead_registered_at', to)
      .eq('delete_status', false);

    if (leadErr) {
      return NextResponse.json({ error: 'Failed to load leads', details: leadErr.message }, { status: 500 });
    }

    const leadList = Array.isArray(leads) ? leads : [];

    const { data: calls, error: callErr } = await db
      .from('sarv_calls')
      .select(
        'id, created_at, custanswerstime, talkduration, recording_url, summary, disposition, cnumber'
      )
      .eq('assigned_user_id', telecallerId)
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: false });

    if (callErr) {
      return NextResponse.json({ error: 'Failed to load calls', details: callErr.message }, { status: 500 });
    }

    const callList = Array.isArray(calls) ? calls : [];
    const callIds = callList.map((c: any) => c.id).filter(Boolean);

    let auditList: any[] = [];
    if (callIds.length > 0) {
      const { data: audits } = await db
        .from('sarv_call_audits')
        .select('sarv_call_id, audit_status, audit_score, feedback, audited_at')
        .in('sarv_call_id', callIds)
        .order('audited_at', { ascending: false });
      auditList = Array.isArray(audits) ? audits : [];
    }

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayStartISO = todayStart.toISOString();
    const followUpsDue = leadList.filter((l: any) => {
      if (!isPending(l)) return false;
      const reg = pickLeadDate(l);
      if (!reg) return false;
      return reg >= todayStartISO && !l.assigned_mechanic_id;
    }).length;

    const highPriorityPendingHoursMs = HIGH_PRIORITY_PENDING_HOURS * 60 * 60 * 1000;
    const nowMs = now.getTime();
    const highPriorityPending = leadList.filter((l: any) => {
      if (!isPending(l)) return false;
      const reg = pickLeadDate(l);
      if (!reg) return false;
      return nowMs - new Date(reg).getTime() >= highPriorityPendingHoursMs;
    }).length;

    const noRecording = callList.filter((c: any) => !String(c?.recording_url || '').trim()).length;
    const noSummary = callList.filter((c: any) => !String(c?.summary || '').trim()).length;
    const noDisposition = callList.filter((c: any) => !String(c?.disposition || '').trim()).length;

    const statusCounts: Record<string, number> = {};
    for (const lead of leadList) {
      const s = String(lead?.lead_status || lead?.complaint_status || 'unknown').toLowerCase();
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    }
    const registered = (statusCounts.registered || 0) + (statusCounts.pending || 0);
    const inProgress =
      (statusCounts.in_progress || 0) +
      (statusCounts.assigned || 0) +
      (statusCounts.assigned_to_manager || 0) +
      (statusCounts.assigned_to_mechanic || 0);
    const completed = (statusCounts.completed || 0) + (statusCounts.closed || 0);
    const totalFunnel = leadList.length;
    const funnel = {
      registered,
      inProgress,
      completed,
      dropOffPercent: totalFunnel ? Math.round((1 - completed / totalFunnel) * 100) : 0,
    };

    const talkDurations = callList
      .map((c: any) => (c.talkduration != null ? Number(c.talkduration) : null))
      .filter((n): n is number => n != null && Number.isFinite(n));
    const avgTalkTimeSeconds =
      talkDurations.length > 0
        ? Math.round(talkDurations.reduce((a, b) => a + b, 0) / talkDurations.length)
        : null;

    const slotCounts: Record<string, { count: number; completed: number }> = {};
    for (const slot of TALK_TIME_SLOTS) {
      slotCounts[slot.key] = { count: 0, completed: 0 };
    }
    for (const call of callList) {
      const t = new Date(call.custanswerstime || call.created_at);
      const istDate = new Date(t.getTime() + 330 * 60 * 1000);
      const istHour = istDate.getUTCHours();
      for (const slot of TALK_TIME_SLOTS) {
        let inSlot = false;
        if (slot.start < slot.end) {
          inSlot = istHour >= slot.start && istHour < slot.end;
        } else {
          inSlot = istHour >= slot.start || istHour < slot.end;
        }
        if (inSlot) {
          slotCounts[slot.key].count += 1;
          if (call.disposition && String(call.disposition).toLowerCase().includes('completed')) {
            slotCounts[slot.key].completed += 1;
          }
          break;
        }
      }
    }
    const bestWindow = Object.entries(slotCounts)
      .filter(([, v]) => v.count >= 3)
      .map(([key, v]) => {
        const slot = TALK_TIME_SLOTS.find((s) => s.key === key);
        return {
          key,
          label: slot?.label || key,
          count: v.count,
          completionRate: v.count ? Math.round((v.completed / v.count) * 100) : 0,
        };
      })
      .sort((a, b) => b.completionRate - a.completionRate)[0] || null;

    const latestAudits = auditList.slice(0, 5).map((a: any) => ({
      sarv_call_id: a.sarv_call_id,
      audit_score: a.audit_score,
      feedback: (a.feedback || '').slice(0, 200),
    }));
    const auditedScores = auditList
      .map((a) => (a.audit_score != null ? Number(a.audit_score) : null))
      .filter((n): n is number => n != null && Number.isFinite(n));
    const personalQuality = {
      auditedCount: auditList.length,
      avgScore:
        auditedScores.length > 0
          ? Math.round((auditedScores.reduce((a, b) => a + b, 0) / auditedScores.length) * 10) / 10
          : null,
      lastFeedbackHighlights: latestAudits,
    };

    const pendingLeads = leadList.filter(isPending);
    const needsAttention = pendingLeads
      .map((lead) => {
        const reg = pickLeadDate(lead);
        const ageMs = reg ? nowMs - new Date(reg).getTime() : 0;
        return { lead, ageMs };
      })
      .sort((a, b) => b.ageMs - a.ageMs)
      .slice(0, ACTIONABLE_NEEDS_ATTENTION_LIMIT)
      .map(({ lead }) => ({
        id: lead.id,
        customer_name: lead.customer_name,
        contact_number: lead.contact_number,
        lead_status: lead.lead_status || lead.complaint_status,
        lead_registered_at: pickLeadDate(lead),
      }));

    const callsWithoutDisposition = callList
      .filter((c: any) => !String(c?.disposition || '').trim())
      .slice(0, 5)
      .map((c: any) => ({
        id: c.id,
        cnumber: c.cnumber,
        created_at: c.created_at,
      }));

    const completedLeads = leadList.filter(
      (l: any) => ['completed', 'closed'].includes(String(l?.lead_status || l?.complaint_status || '').toLowerCase())
    );
    const totalQuotedAmount = completedLeads.reduce((sum: number, l: any) => {
      const v = l?.customer_quoted_amount;
      const n = typeof v === 'number' && Number.isFinite(v) ? v : Number(v);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);

    return NextResponse.json({
      callsReceived: callList.length,
      registeredCount: leadList.length,
      totalQuotedAmount,
      todayFollowUpsDue: followUpsDue,
      highPriorityPending,
      noRecording,
      noSummary,
      noDisposition,
      callTotal: callList.length,
      funnel,
      avgTalkTimeSeconds,
      bestWindow,
      personalQuality,
      needsAttention,
      callsWithoutDisposition,
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
