import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { canSeeCrmMlDl, isTelecallerCrmRole, normalizeRoleCode } from '@/lib/telecaller/crmRoles';
import { refreshLeadBrain } from '@/lib/telecaller/crmMlDlSweep';
import { findSimilarBookedLeads } from '@/lib/telecaller/leadDlVoice';
import { mapDlRow, mapScoreRow, type LeadBrainPayload } from '@/lib/telecaller/leadMlTypes';

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
  const roleCode = normalizeRoleCode((profile as { roles?: { role_code?: string } })?.roles?.role_code);
  if (!isTelecallerCrmRole(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden', db: null as any, roleCode, userId: '' };
  }
  const { supabaseAdmin } = getSupabaseAdmin();
  return {
    ok: true as const,
    status: 200,
    error: null,
    db: supabaseAdmin ?? supabase,
    roleCode,
    userId: String((profile as { id?: string })?.id || user.id),
  };
}

async function assertLeadAccess(db: any, leadId: string, roleCode: string, userId: string) {
  if (roleCode !== 'TELECALLER') return true;
  const { data } = await db
    .from('service_leads')
    .select('id, assigned_telecaller_id, created_by_id')
    .eq('id', leadId)
    .maybeSingle();
  if (!data) return false;
  return data.assigned_telecaller_id === userId || data.created_by_id === userId;
}

const MIGRATION_RE = /does not exist|schema cache|PGRST205|42P01/i;

export async function GET(request: NextRequest) {
  const auth = await assertCrm(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!canSeeCrmMlDl(auth.roleCode)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { db } = auth;
  const sp = request.nextUrl.searchParams;
  const leadId = String(sp.get('lead_id') || '').trim();
  const idsRaw = String(sp.get('lead_ids') || '').trim();

  if (idsRaw) {
    const ids = idsRaw
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 120);
    if (!ids.length) return NextResponse.json({ success: true, scores: {} });
    const { data, error } = await db
      .from('telecaller_lead_scores')
      .select('lead_id, conversion_score, temperature, ghost_risk, best_call_hour, best_call_label')
      .in('lead_id', ids);
    if (error && MIGRATION_RE.test(error.message || '')) {
      return NextResponse.json({
        success: true,
        scores: {},
        warning: 'Run database/354_crm_ml_dl_insights.sql',
      });
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const scores: Record<string, any> = {};
    for (const row of data || []) {
      scores[String(row.lead_id)] = {
        conversion_score: Number(row.conversion_score) || 0,
        temperature: row.temperature,
        ghost_risk: Number(row.ghost_risk) || 0,
        best_call_hour: row.best_call_hour,
        best_call_label: row.best_call_label,
      };
    }
    return NextResponse.json({ success: true, scores });
  }

  if (!leadId) return NextResponse.json({ error: 'lead_id required' }, { status: 400 });
  const allowed = await assertLeadAccess(db, leadId, auth.roleCode, auth.userId);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: scoreRow, error: scoreErr } = await db
    .from('telecaller_lead_scores')
    .select('*')
    .eq('lead_id', leadId)
    .maybeSingle();
  if (scoreErr && MIGRATION_RE.test(scoreErr.message || '')) {
    return NextResponse.json({
      success: true,
      score: null,
      voice: null,
      similar: [],
      warning: 'Run database/354_crm_ml_dl_insights.sql',
    } satisfies LeadBrainPayload & { success: true; warning: string });
  }

  const { data: voiceRow } = await db
    .from('telecaller_call_dl')
    .select('*')
    .eq('lead_id', leadId)
    .order('processed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let score = scoreRow ? mapScoreRow(scoreRow) : null;
  if (!score) {
    const fresh = await refreshLeadBrain(leadId);
    score = fresh.score;
  }

  const similar = await findSimilarBookedLeads(leadId, 4);

  return NextResponse.json({
    success: true,
    score,
    voice: voiceRow ? mapDlRow(voiceRow) : null,
    similar: similar.similar,
    warning: similar.warning,
  });
}

export async function POST(request: NextRequest) {
  const auth = await assertCrm(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!canSeeCrmMlDl(auth.roleCode)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { db } = auth;
  const body = await request.json().catch(() => ({}));
  const leadId = String(body.lead_id || '').trim();
  if (!leadId) return NextResponse.json({ error: 'lead_id required' }, { status: 400 });
  const allowed = await assertLeadAccess(db, leadId, auth.roleCode, auth.userId);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const processDl = body.process_dl !== false;
  const refreshed = await refreshLeadBrain(leadId, { processDl });
  const similar = await findSimilarBookedLeads(leadId, 4);
  const { data: voiceRow } = await db
    .from('telecaller_call_dl')
    .select('*')
    .eq('lead_id', leadId)
    .order('processed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    success: Boolean(refreshed.score),
    score: refreshed.score,
    voice: voiceRow ? mapDlRow(voiceRow) : null,
    similar: similar.similar,
    warning: refreshed.warning || refreshed.voiceWarning || similar.warning,
  });
}
