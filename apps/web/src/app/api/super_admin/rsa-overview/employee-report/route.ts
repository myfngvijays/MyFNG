import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function assertSuperAdmin(supabase: any) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized', user: null };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();
  if (roleError || !userData) {
    return { ok: false, status: 403, error: 'Forbidden - Role check failed', user };
  }
  const roleCode = (userData as any).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden - Not super admin', user };
  }
  return { ok: true, status: 200, error: null, user };
}

function normalizeKey(value: any) {
  const raw = String(value || '').trim();
  return raw || null;
}

function isResolved(lead: any) {
  const leadStatus = String(lead?.lead_status || '').toLowerCase();
  const complaintStatus = String(lead?.complaint_status || '').toLowerCase();
  return ['completed', 'closed'].includes(leadStatus) || ['completed', 'closed'].includes(complaintStatus);
}

function matchesStatusFilter(lead: any, statusFilter: string) {
  const normalized = String(statusFilter || '').trim().toLowerCase();
  if (!normalized || normalized === 'all') return true;
  const leadStatus = String(lead?.lead_status || '').trim().toLowerCase();
  const complaintStatus = String(lead?.complaint_status || '').trim().toLowerCase();
  if (normalized === 'unknown') {
    return (!leadStatus && !complaintStatus) || leadStatus === 'unknown' || complaintStatus === 'unknown';
  }
  if (normalized === 'resolved') return isResolved(lead);
  if (normalized === 'pending') return !isResolved(lead);
  return leadStatus === normalized || complaintStatus === normalized;
}

function toNumber(value: any) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function parseAmount(value: any) {
  if (value === null || value === undefined) return 0;
  const raw = String(value).trim();
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d.]/g, '');
  if (!cleaned) return 0;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function deriveCallRating(summary?: string | null) {
  const text = String(summary || '').trim();
  if (!text) return null;
  const m =
    text.match(/Call Rating\s*\(1-5\)\s*[:\-–]?\s*([1-5])/i) || text.match(/\bRating\b\s*[:\-–]?\s*([1-5])/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 5 ? n : null;
}

function avg(nums: number[]) {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await assertSuperAdmin(supabase);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

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
    const statusFilter = String(searchParams.get('status') || '').trim().toLowerCase();

    // Leads
    const dateFilter = `and(lead_registered_at.gte.${from},lead_registered_at.lte.${to}),and(requested_at.gte.${from},requested_at.lte.${to})`;
    const { data: leads, error: leadErr } = await db
      .from('rsa_leads')
      .select(
        'id, lead_status, complaint_status, assigned_manager_id, registered_by_id, customer_quoted_amount, payment_to_mechanic, advance_payment'
      )
      .eq('delete_status', false)
      .or(dateFilter);
    if (leadErr) {
      return NextResponse.json({ error: 'Failed to load RSA leads' }, { status: 500 });
    }

    // Calls
    const { data: calls, error: callErr } = await db
      .from('sarv_calls')
      .select('id, assigned_user_id, assigned_role, custanswerstime, custanswerduration, summary')
      .gte('created_at', from)
      .lte('created_at', to);
    if (callErr) {
      return NextResponse.json({ error: 'Failed to load SARV calls' }, { status: 500 });
    }

    const leadRows = (Array.isArray(leads) ? leads : []).filter((lead: any) => matchesStatusFilter(lead, statusFilter));
    const callRows = Array.isArray(calls) ? calls : [];

    const emp = new Map<
      string,
      {
        user_id: string;
        registered_complaints: number;
        registered_resolved_complaints: number;
        completed_complaints: number;
        total_quoted: number;
        registered_advance_amount: number;
        registered_profit: number;
        self_completed_mechanic_payment: number;
        self_completed_profit: number;
        completed_only_mechanic_payment: number;
        completed_only_profit: number;
        total_answer_calls: number;
        call_ratings: number[];
        audit_scores: number[];
        role_hint: string | null;
      }
    >();

    const touch = (userId: string) => {
      const e =
        emp.get(userId) ||
        ({
          user_id: userId,
          registered_complaints: 0,
          registered_resolved_complaints: 0,
          completed_complaints: 0,
          total_quoted: 0,
          registered_advance_amount: 0,
          registered_profit: 0,
          self_completed_mechanic_payment: 0,
          self_completed_profit: 0,
          completed_only_mechanic_payment: 0,
          completed_only_profit: 0,
          total_answer_calls: 0,
          call_ratings: [],
          audit_scores: [],
          role_hint: null,
        } as any);
      emp.set(userId, e);
      return e;
    };

    for (const l of leadRows) {
      // Credit "registered" to registered_by_id
      const regId = normalizeKey((l as any).registered_by_id);
      if (regId) {
        const e = touch(regId);
        e.registered_complaints += 1;
        const quoted = toNumber((l as any).customer_quoted_amount);
        e.total_quoted += quoted;
        const advance = parseAmount((l as any).advance_payment);
        e.registered_advance_amount += advance;
        const mechanicPayment = toNumber((l as any).payment_to_mechanic);
        e.registered_profit += quoted - mechanicPayment;
      }

      // Credit "completed" to assigned_manager_id (fallback registered_by_id)
      if (isResolved(l)) {
        // For registrant: count "their registered complaints that got resolved (by anyone)"
        if (regId) {
          const eReg = touch(regId);
          eReg.registered_resolved_complaints += 1;
        }

        const compId = normalizeKey((l as any).assigned_manager_id) || regId;
        if (compId) {
          const e = touch(compId);
          e.completed_complaints += 1;

          const quoted = toNumber((l as any).customer_quoted_amount);
          const mechanicPayment = toNumber((l as any).payment_to_mechanic);
          const profit = quoted - mechanicPayment;

          if (regId && compId === regId) {
            // self: registered + completed by same employee
            e.self_completed_mechanic_payment += mechanicPayment;
            e.self_completed_profit += profit;
          } else {
            // completed-only: completed by this employee but registered by someone else (or unknown)
            e.completed_only_mechanic_payment += mechanicPayment;
            e.completed_only_profit += profit;
          }
        }
      }
    }

    const callIds: string[] = [];
    for (const c of callRows) {
      const userId = normalizeKey((c as any).assigned_user_id);
      if (!userId) continue;
      const e = touch(userId);
      e.role_hint = e.role_hint || normalizeKey((c as any).assigned_role);
      const answered =
        (c as any).custanswerstime != null ||
        (typeof (c as any).custanswerduration === 'number' ? (c as any).custanswerduration > 0 : false);
      if (answered) e.total_answer_calls += 1;
      const r = deriveCallRating((c as any).summary);
      if (r != null) e.call_ratings.push(r);
      if ((c as any).id) callIds.push(String((c as any).id));
    }

    // Audits: fetch all audits for these calls, keep latest per call, then aggregate per employee.
    if (callIds.length) {
      const { data: audits } = await db
        .from('sarv_call_audits')
        .select('sarv_call_id, audit_score, audited_at, created_at')
        .in('sarv_call_id', Array.from(new Set(callIds)));

      const latestByCall = new Map<string, { score: number; ts: number }>();
      for (const a of audits || []) {
        const callId = String((a as any).sarv_call_id || '').trim();
        const score = (a as any).audit_score;
        if (!callId || !Number.isFinite(score)) continue;
        const tsRaw = (a as any).audited_at || (a as any).created_at;
        const ts = tsRaw ? new Date(tsRaw).getTime() : 0;
        const prev = latestByCall.get(callId);
        if (!prev || ts > prev.ts) latestByCall.set(callId, { score: Number(score), ts });
      }

      const callToEmp = new Map<string, string>();
      for (const c of callRows) {
        const callId = String((c as any).id || '').trim();
        const userId = normalizeKey((c as any).assigned_user_id);
        if (callId && userId) callToEmp.set(callId, userId);
      }

      for (const [callId, v] of latestByCall.entries()) {
        const userId = callToEmp.get(callId);
        if (!userId) continue;
        const e = touch(userId);
        e.audit_scores.push(v.score);
      }
    }

    const userIds = Array.from(emp.keys());
    const userMap = new Map<string, { full_name: string | null; role_code: string | null }>();
    if (userIds.length) {
      const { data: users } = await db
        .from('users_login')
        .select('id, full_name, roles(role_code)')
        .in('id', userIds);
      for (const u of users || []) {
        userMap.set(String((u as any).id), {
          full_name: (u as any).full_name || null,
          role_code: (u as any)?.roles?.role_code || null,
        });
      }
    }

    const rows = userIds
      .map((id) => {
        const e = emp.get(id)!;
        const u = userMap.get(id) || { full_name: null, role_code: null };
        return {
          user_id: id,
          name: u.full_name || id,
          role: u.role_code || e.role_hint || '—',
          registered_complaints: e.registered_complaints,
          registered_resolved_complaints: e.registered_resolved_complaints,
          completed_complaints: e.completed_complaints,
          total_quoted: e.total_quoted,
          registered_advance_amount: e.registered_advance_amount,
          registered_profit: e.registered_profit,
          self_completed_mechanic_payment: e.self_completed_mechanic_payment,
          self_completed_profit: e.self_completed_profit,
          completed_only_mechanic_payment: e.completed_only_mechanic_payment,
          completed_only_profit: e.completed_only_profit,
          total_answer_calls: e.total_answer_calls,
          avg_call_rating: avg(e.call_ratings),
          avg_audit_rating: avg(e.audit_scores),
        };
      })
      .sort((a, b) => (b.registered_complaints || 0) - (a.registered_complaints || 0));

    return NextResponse.json({
      range: { from, to },
      rows,
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

