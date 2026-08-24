import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { loadSalesPlaybook } from '@/lib/telecaller/loadSalesPlaybook';
import { analyzeLeadIqFree, analyzeLeadIqWithOpenAI, type LeadIqBrief } from '@/lib/telecaller/leadIq';
import { leadDisplayStatus } from '@/lib/telecaller/leadDisplayStatus';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

async function assertCrm(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { ok: false as const, status: 401, error: 'Unauthorized', db: null as any, roleCode: '', userId: '' };
  }
  const profile = await resolveUserProfile(supabase, user);
  const roleCode = String((profile?.roles as any)?.role_code || '')
    .trim()
    .toUpperCase();
  if (!['SUPER_ADMIN', 'SUB_ADMIN', 'LEAD_MANAGER', 'TELECALLER'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden', db: null as any, roleCode, userId: '' };
  }
  const { supabaseAdmin } = getSupabaseAdmin();
  return {
    ok: true as const,
    status: 200,
    error: null,
    db: supabaseAdmin ?? supabase,
    roleCode,
    userId: String((profile as any)?.id || user.id),
  };
}

function mapBriefRow(r: any): LeadIqBrief {
  return {
    lead_id: r.lead_id,
    verdict: r.verdict,
    intent_level: r.intent_level,
    buyer_type: r.buyer_type,
    decision_stage: r.decision_stage,
    hidden_risk: r.hidden_risk,
    next_move: r.next_move,
    whatsapp_script: r.whatsapp_script,
    call_script: r.call_script,
    facts: Array.isArray(r.facts) ? r.facts : r.brief?.facts || [],
    temperature: r.brief?.temperature || null,
    engine: r.engine,
    generated_at: r.generated_at,
  };
}

async function persistBrief(db: any, brief: LeadIqBrief) {
  const payload = {
    lead_id: brief.lead_id,
    verdict: brief.verdict,
    intent_level: brief.intent_level,
    buyer_type: brief.buyer_type,
    decision_stage: brief.decision_stage,
    hidden_risk: brief.hidden_risk,
    next_move: brief.next_move,
    whatsapp_script: brief.whatsapp_script,
    call_script: brief.call_script,
    facts: brief.facts,
    brief: {
      temperature: brief.temperature,
      engine: brief.engine,
    },
    engine: brief.engine,
    generated_at: brief.generated_at,
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from('telecaller_lead_iq').upsert(payload, { onConflict: 'lead_id' });
  if (error && /does not exist|schema cache|PGRST205|42P01/i.test(error.message || '')) {
    return { persisted: false, warning: 'Run database/348_ai_suite_call_lead_iq.sql' };
  }
  if (error) return { persisted: false, warning: error.message };
  return { persisted: true };
}

export async function GET(request: NextRequest) {
  const auth = await assertCrm(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { db } = auth;
  const sp = request.nextUrl.searchParams;
  const leadId = String(sp.get('lead_id') || '').trim();

  if (leadId) {
    const { data, error } = await db.from('telecaller_lead_iq').select('*').eq('lead_id', leadId).maybeSingle();
    if (error && /does not exist|schema cache|PGRST205|42P01/i.test(error.message || '')) {
      return NextResponse.json({ success: true, brief: null, warning: 'Run database/348_ai_suite_call_lead_iq.sql' });
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, brief: data ? mapBriefRow(data) : null });
  }

  const limit = Math.min(80, Math.max(10, Number(sp.get('limit') || 40) || 40));
  const list = sp.get('list') === '1' || sp.has('q') || sp.has('status');
  if (list) {
    const q = String(sp.get('q') || '')
      .trim()
      .replace(/[%_,]/g, '')
      .slice(0, 48);
    const statusName = String(sp.get('status') || '').trim();
    const SELECT = `
      id, lead_number, customer_name, customer_phone, status, city,
      last_call_at, total_calls, assigned_telecaller_id, coupon_meta, is_incomplete, updated_at,
      assigned_telecaller:users_login!assigned_telecaller_id(full_name)
    `;
    const applyScope = (query: any) => {
      const fetchLimit = statusName ? Math.min(120, Math.max(limit, 80)) : limit;
      let next = query.is('deleted_at', null).order('updated_at', { ascending: false }).limit(fetchLimit);
      if (auth.roleCode === 'TELECALLER') next = next.eq('assigned_telecaller_id', auth.userId);
      if (q) {
        next = next.or(
          `customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%,lead_number.ilike.%${q}%`,
        );
      }
      return next;
    };

    let { data: leads, error: leadErr } = await applyScope(db.from('service_leads').select(SELECT));
    if (leadErr && /assigned_telecaller|users_login/i.test(leadErr.message || '')) {
      const fallbackSelect =
        'id, lead_number, customer_name, customer_phone, status, city, last_call_at, total_calls, assigned_telecaller_id, coupon_meta, is_incomplete, updated_at';
      const again = await applyScope(db.from('service_leads').select(fallbackSelect));
      leads = again.data;
      leadErr = again.error;
    }
    if (leadErr && /deleted_at/i.test(leadErr.message || '')) {
      const retry = db.from('service_leads').select(SELECT).order('updated_at', { ascending: false }).limit(limit);
      const scoped =
        auth.roleCode === 'TELECALLER' ? retry.eq('assigned_telecaller_id', auth.userId) : retry;
      const again = await (q
        ? scoped.or(`customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%,lead_number.ilike.%${q}%`)
        : scoped);
      leads = again.data;
      leadErr = again.error;
    }
    if (leadErr) return NextResponse.json({ error: leadErr.message }, { status: 500 });

    const wanted = statusName && !/^all$/i.test(statusName) ? statusName.toLowerCase() : '';
    const filtered = (leads || []).filter((l: any) => {
      if (!wanted) return true;
      return leadDisplayStatus(l).toLowerCase() === wanted;
    });

    const ids = filtered.map((l: any) => l.id);
    let briefByLead: Record<string, any> = {};
    if (ids.length) {
      const { data: briefRows } = await db.from('telecaller_lead_iq').select('*').in('lead_id', ids);
      for (const r of briefRows || []) briefByLead[r.lead_id] = mapBriefRow(r);
    }

    return NextResponse.json({
      success: true,
      leads: filtered.map((l: any) => {
        const brief = briefByLead[l.id] || null;
        return {
          id: l.id,
          lead_number: l.lead_number,
          customer_name: l.customer_name,
          phone: l.customer_phone,
          city: l.city,
          status: leadDisplayStatus(l),
          agent: l.assigned_telecaller?.full_name || null,
          total_calls: l.total_calls || 0,
          last_call_at: l.last_call_at,
          brief,
        };
      }),
    });
  }

  const { data, error } = await db
    .from('telecaller_lead_iq')
    .select(
      `
      *,
      lead:service_leads!lead_id(id, lead_number, customer_name, customer_phone, status, city)
    `,
    )
    .order('generated_at', { ascending: false })
    .limit(limit);
  if (error && /does not exist|schema cache|PGRST205|42P01/i.test(error.message || '')) {
    return NextResponse.json({ success: true, briefs: [], warning: 'Run database/348_ai_suite_call_lead_iq.sql' });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    success: true,
    briefs: (data || []).map((r: any) => ({
      ...mapBriefRow(r),
      customer_name: r.lead?.customer_name || null,
      lead_number: r.lead?.lead_number || null,
      phone: r.lead?.customer_phone || null,
      status: r.lead?.status || null,
      city: r.lead?.city || null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await assertCrm(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { db } = auth;
  const body = await request.json().catch(() => ({}));
  const leadId = String(body.lead_id || '').trim();
  const deep = Boolean(body.deep);
  if (!leadId) return NextResponse.json({ error: 'lead_id required' }, { status: 400 });

  const LEAD_SELECT =
    `id, lead_number, customer_name, status, city, vehicle_make, vehicle_model, vehicle_number,
     service_type, problem_description, lead_source, estimated_amount,
     next_follow_up_at, last_call_at, total_calls, coupon_meta, created_at, assigned_telecaller_id, is_incomplete`;
  let { data: lead, error: leadErr } = await db
    .from('service_leads')
    .select(LEAD_SELECT)
    .eq('id', leadId)
    .maybeSingle();
  if (leadErr && /is_incomplete/i.test(leadErr.message || '')) {
    const retry = await db
      .from('service_leads')
      .select(
        `id, lead_number, customer_name, status, city, vehicle_make, vehicle_model, vehicle_number,
         service_type, problem_description, lead_source, estimated_amount,
         next_follow_up_at, last_call_at, total_calls, coupon_meta, created_at, assigned_telecaller_id`,
      )
      .eq('id', leadId)
      .maybeSingle();
    lead = retry.data;
    leadErr = retry.error;
  }
  if (leadErr) return NextResponse.json({ error: leadErr.message }, { status: 500 });
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  if (auth.roleCode === 'TELECALLER' && String(lead.assigned_telecaller_id || '') !== auth.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: calls } = await db
    .from('telecaller_call_logs')
    .select(
      `
      id, created_at, call_status, call_duration, notes, outcome,
      analysis:telecaller_call_analyses!call_log_id(sop_audit)
    `,
    )
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(12);

  const playbook = await loadSalesPlaybook(db);
  const input = {
    lead_id: lead.id,
    customer_name: lead.customer_name,
    lead_number: lead.lead_number,
    status: leadDisplayStatus(lead),
    city: lead.city,
    vehicle_make: lead.vehicle_make,
    vehicle_model: lead.vehicle_model,
    vehicle_number: lead.vehicle_number,
    service_type: lead.service_type,
    problem_description: lead.problem_description,
    lead_source: auth.roleCode === 'TELECALLER' ? null : lead.lead_source,
    estimated_amount: lead.estimated_amount,
    telecaller_remarks:
      (lead as any).coupon_meta?.telecaller_remarks ||
      (lead as any).coupon_meta?.last_call_notes ||
      null,
    next_follow_up_at: lead.next_follow_up_at,
    last_call_at: lead.last_call_at,
    total_calls: lead.total_calls,
    coupon_meta: lead.coupon_meta,
    created_at: lead.created_at,
    recent_calls: (Array.isArray(calls) ? calls : []).map((c: any) => ({
      created_at: c.created_at,
      call_status: c.call_status,
      call_duration: c.call_duration,
      notes: c.notes,
      outcome: c.outcome,
      sop_audit: Array.isArray(c.analysis) ? c.analysis[0]?.sop_audit : c.analysis?.sop_audit,
    })),
  };

  const result = deep
    ? await analyzeLeadIqWithOpenAI(input, playbook)
    : { brief: analyzeLeadIqFree(input), used_openai: false as const };
  const persist = await persistBrief(db, result.brief);

  return NextResponse.json({
    success: true,
    brief: result.brief,
    used_openai: 'used_openai' in result ? result.used_openai : false,
    warning: ('warning' in result ? result.warning : null) || persist.warning || null,
    persisted: persist.persisted,
    lead: {
      id: lead.id,
      lead_number: lead.lead_number,
      customer_name: lead.customer_name,
      status: lead.status,
    },
  });
}
