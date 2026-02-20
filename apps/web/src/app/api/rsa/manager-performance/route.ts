import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import {
  SLA_MECHANIC_ASSIGNMENT_MS,
  PENDING_AGING_BUCKETS,
  REPEAT_CONTACT_WINDOW_MINUTES,
  DELAY_REASON_LABELS,
  AUDIT_LOW_SCORE_THRESHOLD,
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
    if (!['RSA_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }
    const db = supabaseAdmin as any;

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const from = searchParams.get('from') || defaultFrom.toISOString();
    const to = searchParams.get('to') || now.toISOString();

    const managerId = profile.id;

    const { data: leads, error: leadErr } = await db
      .from('rsa_leads')
      .select(
        'id, lead_registered_at, requested_at, assigned_to_manager_at, mechanic_assigned_datetime, lead_status, complaint_status, customer_name, contact_number'
      )
      .eq('assigned_manager_id', managerId)
      .gte('lead_registered_at', from)
      .lte('lead_registered_at', to)
      .eq('delete_status', false);

    if (leadErr) {
      return NextResponse.json({ error: 'Failed to load leads', details: leadErr.message }, { status: 500 });
    }

    const leadList = Array.isArray(leads) ? leads : [];
    const leadIds = leadList.map((l: any) => l.id).filter(Boolean);
    if (leadIds.length === 0) {
      return NextResponse.json({
        avgFirstActionMinutes: null,
        pendingAgingBuckets: PENDING_AGING_BUCKETS.map((b) => ({ ...b, count: 0 })),
        mechanicAssignmentWithinSlaPercent: null,
        repeatContactCount: 0,
        topDelayReasons: [],
        auditSnapshot: { auditedCount: 0, avgScore: null, lowScoreCalls: [] },
        needsAttention: [],
      });
    }

    const { data: links } = await db
      .from('sarv_call_rsa_links')
      .select('rsa_lead_id, sarv_call_id')
      .in('rsa_lead_id', leadIds);

    const linkList = Array.isArray(links) ? links : [];
    const sarvCallIds = [...new Set(linkList.map((l: any) => l.sarv_call_id).filter(Boolean))];
    const leadToFirstCallMs = new Map<string, number>();

    let callList: any[] = [];
    if (sarvCallIds.length > 0) {
      const { data: calls } = await db
        .from('sarv_calls')
        .select('id, created_at, custanswerstime, disposition, disposition_category, cnumber')
        .in('id', sarvCallIds);
      callList = Array.isArray(calls) ? calls : [];
      for (const link of linkList) {
        const leadId = link.rsa_lead_id;
        const call = callList.find((c: any) => c.id === link.sarv_call_id);
        if (!call) continue;
        const callTs = new Date(call.custanswerstime || call.created_at).getTime();
        const existing = leadToFirstCallMs.get(leadId);
        if (existing == null || callTs < existing) leadToFirstCallMs.set(leadId, callTs);
      }
    }

    let auditList: any[] = [];
    if (sarvCallIds.length > 0) {
      const { data: audits } = await db
        .from('sarv_call_audits')
        .select('sarv_call_id, audit_status, audit_score, feedback, audited_at')
        .in('sarv_call_id', sarvCallIds);
      auditList = Array.isArray(audits) ? audits : [];
    }

    const firstActionDeltas: number[] = [];
    for (const lead of leadList) {
      const regTs = new Date(pickLeadDate(lead)).getTime();
      if (!Number.isFinite(regTs)) continue;
      const toManager = lead.assigned_to_manager_at ? new Date(lead.assigned_to_manager_at).getTime() : null;
      const firstCallMs = leadToFirstCallMs.get(lead.id);
      let firstTouch: number | null = null;
      if (toManager != null && Number.isFinite(toManager)) firstTouch = toManager;
      if (firstCallMs != null && Number.isFinite(firstCallMs)) {
        if (firstTouch == null || firstCallMs < firstTouch) firstTouch = firstCallMs;
      }
      if (firstTouch != null && firstTouch >= regTs) {
        firstActionDeltas.push((firstTouch - regTs) / (60 * 1000));
      }
    }
    const avgFirstActionMinutes =
      firstActionDeltas.length > 0
        ? Math.round((firstActionDeltas.reduce((a, b) => a + b, 0) / firstActionDeltas.length) * 10) / 10
        : null;

    const pendingLeads = leadList.filter(isPending);
    const nowMs = now.getTime();
    const pendingAgingBuckets = PENDING_AGING_BUCKETS.map((bucket) => {
      const count = pendingLeads.filter((lead) => {
        const reg = pickLeadDate(lead);
        if (!reg) return false;
        const hours = (nowMs - new Date(reg).getTime()) / (60 * 60 * 1000);
        return hours >= bucket.minHours && hours < (bucket.maxHours === Infinity ? 1e6 : bucket.maxHours);
      }).length;
      return { ...bucket, count };
    });

    let mechanicAssignedWithinSla = 0;
    let mechanicAssignedTotal = 0;
    for (const lead of leadList) {
      const assignedAt = lead.mechanic_assigned_datetime;
      if (!assignedAt) continue;
      mechanicAssignedTotal += 1;
      const regTs = new Date(pickLeadDate(lead)).getTime();
      const assignTs = new Date(assignedAt).getTime();
      if (Number.isFinite(regTs) && Number.isFinite(assignTs) && assignTs - regTs <= SLA_MECHANIC_ASSIGNMENT_MS) {
        mechanicAssignedWithinSla += 1;
      }
    }
    const mechanicAssignmentWithinSlaPercent =
      mechanicAssignedTotal > 0
        ? Math.round((mechanicAssignedWithinSla / mechanicAssignedTotal) * 100)
        : null;

    const windowMs = REPEAT_CONTACT_WINDOW_MINUTES * 60 * 1000;
    const cnumberToTimes = new Map<string, number[]>();
    for (const call of callList) {
      const cn = String(call?.cnumber || '').trim();
      if (!cn) continue;
      const ts = new Date(call.custanswerstime || call.created_at).getTime();
      if (!cnumberToTimes.has(cn)) cnumberToTimes.set(cn, []);
      cnumberToTimes.get(cn)!.push(ts);
    }
    let repeatContactCount = 0;
    for (const [, times] of cnumberToTimes) {
      const sorted = [...times].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] - sorted[i - 1] <= windowMs) {
          repeatContactCount += 1;
          break;
        }
      }
    }

    const dispositionCounts: Record<string, number> = {};
    for (const call of callList) {
      const d = String(call?.disposition || call?.disposition_category || 'Other').trim() || 'Other';
      const label = DELAY_REASON_LABELS[d] || 'Other';
      dispositionCounts[label] = (dispositionCounts[label] || 0) + 1;
    }
    const topDelayReasons = Object.entries(dispositionCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const callIdToAudit = new Map<string, any>();
    for (const a of auditList) {
      const id = a.sarv_call_id;
      const existing = callIdToAudit.get(id);
      if (!existing || (a.audited_at && (!existing.audited_at || a.audited_at > existing.audited_at))) {
        callIdToAudit.set(id, a);
      }
    }
    const auditedScores = auditList
      .map((a) => (a.audit_score != null ? Number(a.audit_score) : null))
      .filter((n): n is number => n != null && Number.isFinite(n));
    const lowScoreCalls = auditList
      .filter((a) => a.audit_score != null && Number(a.audit_score) <= AUDIT_LOW_SCORE_THRESHOLD)
      .slice(0, 10)
      .map((a) => ({
        sarv_call_id: a.sarv_call_id,
        audit_score: a.audit_score,
        feedback: a.feedback || null,
      }));

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

    return NextResponse.json({
      avgFirstActionMinutes,
      pendingAgingBuckets,
      mechanicAssignmentWithinSlaPercent,
      mechanicAssignedTotal,
      repeatContactCount,
      topDelayReasons,
      auditSnapshot: {
        auditedCount: callIdToAudit.size,
        avgScore: auditedScores.length ? Math.round((auditedScores.reduce((a, b) => a + b, 0) / auditedScores.length) * 10) / 10 : null,
        lowScoreCalls,
      },
      needsAttention,
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
