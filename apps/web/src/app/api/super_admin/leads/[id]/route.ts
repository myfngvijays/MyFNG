import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { LEAD_SOURCES, normalizeLeadSource } from '@/lib/enquiry/createLead';
import { PANEL_ACCESS_ROLES } from '@/lib/super-admin-auth';
import { notifyTelecallerAssignedToLead } from '@/lib/notifications';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function assertBookingsAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  let authUser = user;
  if (userError || !authUser) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    authUser = session?.user ?? null;
  }

  if (!authUser) {
    return { ok: false as const, status: 401, error: 'Unauthorized' };
  }

  const { supabaseAdmin } = getSupabaseAdmin();
  const db = supabaseAdmin || supabase;
  const profile = await resolveUserProfile(db as any, authUser);
  const roleCode = String((profile as any)?.roles?.role_code || '');

  if (!PANEL_ACCESS_ROLES.bookings.includes(roleCode as any)) {
    return { ok: false as const, status: 403, error: 'Forbidden - Not super admin' };
  }

  return { ok: true as const, userId: authUser.id, roleCode };
}

const EDITABLE_FIELDS = [
  'customer_name',
  'customer_phone',
  'vehicle_number',
  'city',
  'status',
  'lead_source',
  'created_from',
  'estimated_amount',
  'coupon_code',
  'discount_amount',
  'service_type',
  'customer_email',
  'customer_address',
] as const;

export async function PATCH(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await assertBookingsAdmin(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await paramsPromise;
    const body = await request.json().catch(() => ({}));

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    for (const field of EDITABLE_FIELDS) {
      if (body[field] !== undefined) {
        update[field] = body[field];
      }
    }

    if (body.lead_source !== undefined) {
      const normalized = normalizeLeadSource(String(body.lead_source || ''));
      if (!LEAD_SOURCES.includes(normalized as any)) {
        return NextResponse.json({ error: 'Invalid lead_source' }, { status: 400 });
      }
      update.lead_source = normalized;
    }

    if (body.estimated_amount !== undefined) {
      update.estimated_amount = body.estimated_amount === '' || body.estimated_amount == null
        ? null
        : Number(body.estimated_amount);
    }

    if (body.discount_amount !== undefined) {
      update.discount_amount = body.discount_amount === '' || body.discount_amount == null
        ? 0
        : Number(body.discount_amount);
    }

    let previousAssigneeId: string | null = null;
    let nextAssigneeId: string | null | undefined = undefined;
    if (body.assigned_telecaller_id !== undefined) {
      const raw = body.assigned_telecaller_id;
      nextAssigneeId =
        raw === null || raw === '' || raw === 'UNASSIGNED'
          ? null
          : String(raw).trim() || null;

      if (nextAssigneeId) {
        const { data: tc, error: tcErr } = await supabaseAdmin
          .from('users_login')
          .select('id, full_name, roles!inner(role_code)')
          .eq('id', nextAssigneeId)
          .eq('roles.role_code', 'TELECALLER')
          .maybeSingle();
        if (tcErr || !tc) {
          return NextResponse.json({ error: 'Invalid telecaller' }, { status: 400 });
        }
      }

      const { data: currentLead } = await supabaseAdmin
        .from('service_leads')
        .select('id, lead_number, assigned_telecaller_id')
        .eq('id', id)
        .maybeSingle();
      previousAssigneeId = currentLead?.assigned_telecaller_id
        ? String(currentLead.assigned_telecaller_id)
        : null;

      const nowIso = new Date().toISOString();
      update.assigned_telecaller_id = nextAssigneeId;
      update.assigned_at = nextAssigneeId ? nowIso : null;
      update.telecaller_assigned_at = nextAssigneeId ? nowIso : null;
    }

    if (Object.keys(update).length <= 1) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    let { data, error } = await supabaseAdmin
      .from('service_leads')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();

    // Older schemas may not have telecaller_assigned_at
    if (error && /telecaller_assigned_at/i.test(error.message || '')) {
      delete update.telecaller_assigned_at;
      ({ data, error } = await supabaseAdmin
        .from('service_leads')
        .update(update)
        .eq('id', id)
        .select('*')
        .single());
    }

    if (error) {
      return NextResponse.json({ error: error.message || 'Update failed' }, { status: 500 });
    }

    let assignedName: string | null = null;
    const assignedId = data?.assigned_telecaller_id
      ? String(data.assigned_telecaller_id)
      : null;
    if (assignedId) {
      const { data: tcRow } = await supabaseAdmin
        .from('users_login')
        .select('full_name, phone, email')
        .eq('id', assignedId)
        .maybeSingle();
      assignedName =
        String(tcRow?.full_name || tcRow?.phone || tcRow?.email || 'Telecaller').trim() ||
        'Telecaller';
    }

    if (
      nextAssigneeId !== undefined &&
      nextAssigneeId &&
      nextAssigneeId !== previousAssigneeId
    ) {
      try {
        const { data: actor } = await supabaseAdmin
          .from('users_login')
          .select('full_name')
          .eq('id', auth.userId)
          .maybeSingle();
        await notifyTelecallerAssignedToLead({
          leadId: id,
          leadNumber: String(data?.lead_number || id),
          telecallerId: nextAssigneeId,
          assignedByName: actor?.full_name || undefined,
          isReassignment: Boolean(previousAssigneeId),
        });
      } catch (notifyErr) {
        console.warn('[super_admin/leads] assign notify failed', notifyErr);
      }
    }

    return NextResponse.json({
      lead: {
        ...data,
        assigned_telecaller_name: assignedName,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await assertBookingsAdmin(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await paramsPromise;
    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const now = new Date().toISOString();

    // Soft-delete first (FK-safe). Hard-delete when nothing references the lead.
    const { data: softDeleted, error: softError } = await supabaseAdmin
      .from('service_leads')
      .update({ deleted_at: now, updated_at: now })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();

    if (softError) {
      // Column may not exist on older DBs — fall back to hard delete.
      const { error: hardError } = await supabaseAdmin.from('service_leads').delete().eq('id', id);
      if (hardError) {
        return NextResponse.json(
          { error: hardError.message || softError.message || 'Delete failed. Lead may be linked to jobs or invoices.' },
          { status: 500 },
        );
      }
      return NextResponse.json({ success: true, mode: 'hard' });
    }

    if (!softDeleted?.id) {
      // Already deleted, or missing — try hard delete once.
      const { error: hardError } = await supabaseAdmin.from('service_leads').delete().eq('id', id);
      if (hardError) {
        return NextResponse.json({ error: 'Lead not found or already deleted' }, { status: 404 });
      }
      return NextResponse.json({ success: true, mode: 'hard' });
    }

    // Best-effort hard delete so the row is gone when there are no FK blockers.
    const { error: hardError } = await supabaseAdmin.from('service_leads').delete().eq('id', id);
    if (!hardError) {
      return NextResponse.json({ success: true, mode: 'hard' });
    }

    // Soft-deleted; hide from lists even if hard delete is blocked by FKs.
    return NextResponse.json({ success: true, mode: 'soft' });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
