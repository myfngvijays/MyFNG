import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SELECT =
  'id, lead_number, customer_name, customer_phone, status, city, lead_priority, workshop_id, vehicle_model, vehicle_number, sla_state, escalation, escalated_at, reopen_count, updated_at, notes_internal, workshop:workshops(name)';
const SELECT_FALLBACK =
  'id, lead_number, customer_name, customer_phone, status, city, lead_priority, workshop_id, vehicle_model, vehicle_number, escalation, updated_at';

async function requireManager(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('users_login')
    .select('id, roles!role_id(role_code)')
    .eq('id', user.id)
    .maybeSingle();

  const roleCode = String((profile as { roles?: { role_code?: string } } | null)?.roles?.role_code || '')
    .trim()
    .toUpperCase();

  if (!['LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }
  return { ok: true as const };
}

function isActiveEscalation(value: unknown) {
  return value === true || value === 'true' || value === 'ESCALATED' || value === 1;
}

function applyFilter(query: any, filter: string) {
  if (filter === 'resolved') {
    return query.eq('escalation', false).not('escalated_at', 'is', null);
  }
  if (filter === 'all') {
    return query.or('escalation.eq.true,escalated_at.not.is.null');
  }
  return query.eq('escalation', true).not('status', 'in', '(COMPLETED,CANCELLED,CLOSED)');
}

function applyFilterSimple(query: any, filter: string) {
  if (filter === 'resolved') {
    return query.eq('escalation', false);
  }
  return query.eq('escalation', true);
}

function mapLead(row: any) {
  const active = isActiveEscalation(row?.escalation);
  return {
    ...row,
    escalation: active ? 'ESCALATED' : 'RESOLVED',
    workshop: row?.workshop || null,
  };
}

/**
 * GET /api/lead-manager/escalations?filter=active|resolved|all
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await requireManager(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: 'Admin unavailable' }, { status: 500 });

    const filter = String(request.nextUrl.searchParams.get('filter') || 'active').toLowerCase();
    const safeFilter = ['active', 'resolved', 'all'].includes(filter) ? filter : 'active';

    let result = await applyFilter(
      supabaseAdmin.from('service_leads').select(SELECT).order('updated_at', { ascending: false }).limit(200),
      safeFilter,
    );

    if (result.error) {
      result = await applyFilterSimple(
        supabaseAdmin.from('service_leads').select(SELECT_FALLBACK).order('updated_at', { ascending: false }).limit(200),
        safeFilter,
      );
    }

    if (result.error) {
      return NextResponse.json({ success: true, escalations: [] });
    }

    return NextResponse.json({
      success: true,
      escalations: (result.data || []).map(mapLead),
    });
  } catch {
    return NextResponse.json({ success: true, escalations: [] });
  }
}

/**
 * PATCH /api/lead-manager/escalations
 * Body: { lead_id } — marks the lead escalation as resolved.
 */
export async function PATCH(request: NextRequest) {
  try {
    const gate = await requireManager(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: 'Admin unavailable' }, { status: 500 });

    const body = await request.json().catch(() => ({}));
    const leadId = String(body?.lead_id || '').trim();
    if (!leadId) return NextResponse.json({ error: 'lead_id is required' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('service_leads')
      .update({
        escalation: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId);

    if (error) return NextResponse.json({ error: error.message || 'Failed to resolve' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to resolve' }, { status: 500 });
  }
}
