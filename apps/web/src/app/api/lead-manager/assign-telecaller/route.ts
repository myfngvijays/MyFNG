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
 * POST /api/lead-manager/assign-telecaller
 * Assign / reassign a service lead to a telecaller (Lead Manager oversight).
 */
export async function POST(request: NextRequest) {
  try {
    const gate = await requireLeadManager(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const body = await request.json().catch(() => ({}));
    const leadId = String(body?.lead_id || '').trim();
    const telecallerId = String(body?.telecaller_id || '').trim();
    const clear = Boolean(body?.clear);
    const notes = String(body?.notes || '').trim();

    if (!leadId) {
      return NextResponse.json({ error: 'lead_id required' }, { status: 400 });
    }
    if (!clear && !telecallerId) {
      return NextResponse.json({ error: 'telecaller_id required' }, { status: 400 });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client unavailable' }, { status: 500 });
    }

    const { data: lead, error: leadErr } = await supabaseAdmin
      .from('service_leads')
      .select('id, lead_number, assigned_telecaller_id, status')
      .eq('id', leadId)
      .maybeSingle();

    if (leadErr || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
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

    const previous = lead.assigned_telecaller_id ? String(lead.assigned_telecaller_id) : null;
    const next = clear ? null : telecallerId;

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('service_leads')
      .update({
        assigned_telecaller_id: next,
        follow_up_required: next ? true : undefined,
        updated_at: new Date().toISOString(),
        ...(notes
          ? {
              notes: `${String((lead as { notes?: string }).notes || '')}\n[LM] ${notes}`.trim(),
            }
          : {}),
      })
      .eq('id', leadId)
      .select('id, lead_number, assigned_telecaller_id')
      .single();

    if (updErr) {
      return NextResponse.json({ error: updErr.message || 'Update failed' }, { status: 500 });
    }

    if (next) {
      void notifyTelecallerNewLeadAssignedSafe({
        leadId,
        leadNumber: String(lead.lead_number || leadId),
        telecallerId: next,
        previousTelecallerId: previous,
        assignedByName: gate.fullName,
        isReassignment: Boolean(previous && previous !== next),
        notes: notes || 'Assigned by Lead Manager',
      });
    }

    return NextResponse.json({
      success: true,
      lead: updated,
      previous_telecaller_id: previous,
      message: clear ? 'Telecaller cleared' : 'Telecaller assigned',
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
