import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { notifyTelecallerNewLeadAssignedSafe } from '@/lib/notifications';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function requireLeadManager(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('users_login')
    .select('id, full_name, roles!role_id(role_code)')
    .eq('id', user.id)
    .maybeSingle();

  const roleCode = String((profile as { roles?: { role_code?: string } } | null)?.roles?.role_code || '')
    .trim()
    .toUpperCase();

  if (!['LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return {
    ok: true as const,
    userId: String((profile as { id?: string } | null)?.id || user.id),
    fullName: String((profile as { full_name?: string } | null)?.full_name || 'Lead Manager'),
  };
}

/**
 * POST /api/lead-manager/bulk-assign-telecaller
 * Body: { lead_ids: string[], telecaller_id?: string, clear?: boolean, notes?: string }
 * Lead Manager / Super Admin only (not TELECALLER).
 */
export async function POST(request: NextRequest) {
  try {
    const gate = await requireLeadManager(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const body = await request.json().catch(() => ({}));
    const leadIds = Array.isArray(body?.lead_ids)
      ? body.lead_ids.map((x: unknown) => String(x || '').trim()).filter(Boolean)
      : [];
    const telecallerId = String(body?.telecaller_id || '').trim();
    const clear = Boolean(body?.clear);
    const notes = String(body?.notes || '').trim();

    if (!leadIds.length) {
      return NextResponse.json({ error: 'lead_ids required' }, { status: 400 });
    }
    if (leadIds.length > 200) {
      return NextResponse.json({ error: 'Max 200 leads per bulk assign' }, { status: 400 });
    }
    if (!clear && !telecallerId) {
      return NextResponse.json({ error: 'telecaller_id required' }, { status: 400 });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client unavailable' }, { status: 500 });
    }

    if (!clear) {
      const { data: telecaller } = await supabaseAdmin
        .from('users_login')
        .select('id, full_name, roles!role_id(role_code)')
        .eq('id', telecallerId)
        .maybeSingle();
      const tcRole = String(
        (telecaller as { roles?: { role_code?: string } } | null)?.roles?.role_code || '',
      ).toUpperCase();
      if (!telecaller || tcRole !== 'TELECALLER') {
        return NextResponse.json({ error: 'Target user is not a TELECALLER' }, { status: 400 });
      }
    }

    const { data: leads, error: leadErr } = await supabaseAdmin
      .from('service_leads')
      .select('id, lead_number, assigned_telecaller_id')
      .in('id', leadIds);

    if (leadErr) {
      return NextResponse.json({ error: leadErr.message }, { status: 500 });
    }

    const next = clear ? null : telecallerId;
    const found = Array.isArray(leads) ? leads : [];
    const foundIds = found.map((l) => String(l.id));

    if (!foundIds.length) {
      return NextResponse.json({ error: 'No matching leads' }, { status: 404 });
    }

    const { error: updErr } = await supabaseAdmin
      .from('service_leads')
      .update({
        assigned_telecaller_id: next,
        follow_up_required: next ? true : undefined,
        updated_at: new Date().toISOString(),
      })
      .in('id', foundIds);

    if (updErr) {
      return NextResponse.json({ error: updErr.message || 'Update failed' }, { status: 500 });
    }

    if (next) {
      for (const lead of found) {
        const previous = lead.assigned_telecaller_id ? String(lead.assigned_telecaller_id) : null;
        void notifyTelecallerNewLeadAssignedSafe({
          leadId: String(lead.id),
          leadNumber: String(lead.lead_number || lead.id),
          telecallerId: next,
          previousTelecallerId: previous,
          assignedByName: gate.fullName,
          isReassignment: Boolean(previous && previous !== next),
          notes: notes || `Bulk assigned by ${gate.fullName}`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      updated: foundIds.length,
      skipped: leadIds.length - foundIds.length,
      message: clear
        ? `Cleared assignee on ${foundIds.length} leads`
        : `Assigned ${foundIds.length} leads`,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
