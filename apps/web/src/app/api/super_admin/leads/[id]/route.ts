import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { LEAD_SOURCES, normalizeLeadSource } from '@/lib/enquiry/createLead';
import { PANEL_ACCESS_ROLES } from '@/lib/super-admin-auth';
import { notifyTelecallerNewLeadAssignedSafe } from '@/lib/notifications';
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
  'customer_email',
  'customer_address',
  'address',
  'pickup_address',
  'pickup_required',
  'vehicle_number',
  'vehicle_make',
  'vehicle_model',
  'vehicle_variant',
  'vehicle_year',
  'fuel_type',
  'vehicle_fuel_type',
  'city',
  'city_id',
  'pincode',
  'model_id',
  'odometer_reading',
  'status',
  'lead_source',
  'created_from',
  'lead_type',
  'lead_priority',
  'priority',
  'service_type',
  'preferred_date',
  'preferred_time_slot',
  'preferred_service_slot',
  'preferred_slot_start',
  'problem_description',
  'description',
  'notes',
  'estimated_amount',
  'actual_amount',
  'discount_amount',
  'coupon_code',
  'payment_mode',
  'payment_status',
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

    if (body.actual_amount !== undefined) {
      update.actual_amount =
        body.actual_amount === '' || body.actual_amount == null
          ? null
          : Number(body.actual_amount);
    }

    if (body.vehicle_year !== undefined) {
      update.vehicle_year =
        body.vehicle_year === '' || body.vehicle_year == null
          ? null
          : Number(body.vehicle_year);
    }

    if (body.odometer_reading !== undefined) {
      update.odometer_reading =
        body.odometer_reading === '' || body.odometer_reading == null
          ? null
          : Number(body.odometer_reading);
    }

    if (body.pickup_required !== undefined) {
      const raw = body.pickup_required;
      update.pickup_required =
        raw === true || raw === 'true' || raw === 'Yes' || raw === '1' || raw === 1;
    }

    if (body.discount_amount !== undefined) {
      update.discount_amount = body.discount_amount === '' || body.discount_amount == null
        ? 0
        : Number(body.discount_amount);
    }

    // Keep fuel_type / vehicle_fuel_type in sync (schemas differ by install)
    if (body.fuel_type !== undefined || body.vehicle_fuel_type !== undefined) {
      const fuel = String(body.vehicle_fuel_type ?? body.fuel_type ?? '')
        .trim()
        .toUpperCase();
      if (fuel) {
        update.fuel_type = fuel;
        update.vehicle_fuel_type = fuel;
      }
    }

    // Segregated address → compose customer_address + merge meta
    if (body.address_parts && typeof body.address_parts === 'object') {
      const parts = body.address_parts as Record<string, unknown>;
      const flat = String(parts.flat_number || '').trim();
      const area = String(parts.area || '').trim();
      const landmark = String(parts.landmark || '').trim();
      const cityName = String(parts.city || body.city || '').trim();
      const pin = String(parts.pincode || body.pincode || '')
        .replace(/\D/g, '')
        .slice(0, 6);
      const composed = [
        flat,
        area,
        landmark ? `Near ${landmark}` : '',
        [cityName, pin].filter(Boolean).join(' '),
      ]
        .filter(Boolean)
        .join(', ');
      if (composed) update.customer_address = composed;
      if (pin) update.pincode = pin;
      if (cityName) update.city = cityName;
      if (parts.city_id) update.city_id = String(parts.city_id);

      const { data: current } = await supabaseAdmin
        .from('service_leads')
        .select('meta')
        .eq('id', id)
        .maybeSingle();
      const prevMeta =
        current?.meta && typeof current.meta === 'object' && !Array.isArray(current.meta)
          ? { ...(current.meta as Record<string, unknown>) }
          : {};
      update.meta = {
        ...prevMeta,
        flat_number: flat || null,
        area: area || null,
        landmark: landmark || null,
      };
    }

    // Preferred date + time → preferred_slot_start when both available
    if (body.preferred_date !== undefined || body.preferred_time_slot !== undefined) {
      const { data: current } = await supabaseAdmin
        .from('service_leads')
        .select('preferred_date, preferred_time_slot, preferred_slot_start')
        .eq('id', id)
        .maybeSingle();
      const dateStr = String(
        body.preferred_date !== undefined ? body.preferred_date : current?.preferred_date || '',
      ).slice(0, 10);
      const timeStr = String(
        body.preferred_time_slot !== undefined
          ? body.preferred_time_slot
          : current?.preferred_time_slot || '',
      ).slice(0, 5);
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr) && /^\d{2}:\d{2}/.test(timeStr)) {
        update.preferred_slot_start = `${dateStr}T${timeStr}:00+05:30`;
      }
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
        void notifyTelecallerNewLeadAssignedSafe({
          leadId: id,
          leadNumber: String(data?.lead_number || id),
          telecallerId: nextAssigneeId,
          previousTelecallerId: previousAssigneeId,
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
