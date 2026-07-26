import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { LEAD_SOURCES, normalizeLeadSource } from '@/lib/enquiry/createLead';
import { PANEL_ACCESS_ROLES } from '@/lib/super-admin-auth';
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

    if (Object.keys(update).length <= 1) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('service_leads')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || 'Update failed' }, { status: 500 });
    }

    return NextResponse.json({ lead: data });
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
