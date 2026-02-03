import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

const EDITABLE_STATUSES = new Set(['NEW', 'CONTACTED', 'INCOMPLETE']);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userProfile = await resolveUserProfile(supabase, user);
    const roleCode = (userProfile?.roles as any)?.role_code || null;
    if (roleCode !== 'TELECALLER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const leadId = String(id || '').trim();
    if (!leadId) return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });

    // Ensure telecaller can read this lead under RLS (same as UI access).
    const { data: readableLead, error: readErr } = await supabase
      .from('service_leads')
      .select('id, status')
      .eq('id', leadId)
      .maybeSingle();

    if (readErr || !readableLead) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!EDITABLE_STATUSES.has(String((readableLead as any).status || ''))) {
      return NextResponse.json(
        { error: `Cannot edit lead with status: ${(readableLead as any).status}` },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const serviceTypes = Array.isArray(body?.service_types) ? body.service_types.map(String) : [];
    const serviceAddons = Array.isArray(body?.service_addons) ? body.service_addons.map(String) : [];

    const couponCodes = Array.isArray(body?.coupon_codes) ? body.coupon_codes.map(String) : null;
    const appliedCoupon = body?.applied_coupon != null ? String(body.applied_coupon) : null;

    const nowIso = new Date().toISOString();

    const update: any = {
      customer_name: body?.customer_name ?? null,
      customer_phone: body?.customer_phone ?? null,
      customer_alternate_phone: body?.customer_alternate_phone ?? null,
      customer_email: body?.customer_email ?? null,
      customer_address: body?.customer_address ?? null,
      city_id: body?.city_id ?? null,
      city: body?.city ?? null,
      pincode: body?.pincode ?? null,

      vehicle_number: body?.vehicle_number ?? null,
      vehicle_make: body?.vehicle_make ?? null,
      model_id: body?.model_id ?? null,
      vehicle_model: body?.vehicle_model ?? null,
      vehicle_variant: body?.vehicle_variant ?? null,
      vehicle_year: body?.vehicle_year ?? null,
      vehicle_fuel_type: body?.vehicle_fuel_type ?? null,
      odometer_km: body?.odometer_km ?? null,

      service_type_ids: JSON.stringify(serviceTypes),
      subservice_ids: JSON.stringify(serviceAddons),
      service_type: body?.service_type ?? null,
      problem_description: body?.problem_description ?? null,
      description: body?.description ?? null,

      pickup_required: Boolean(body?.pickup_required),
      pickup_address: body?.pickup_address ?? null,

      notes: body?.notes ?? null,
      lead_priority: body?.lead_priority ?? null,

      is_incomplete: false,
      updated_by_id: userProfile?.id || null,
      updated_at: nowIso,
    };

    // Coupon update (optional) - only update when any coupon payload is provided.
    if (couponCodes !== null || appliedCoupon !== null) {
      const normalizedCodes = (couponCodes || [])
        .map((c) => String(c || '').trim().toUpperCase())
        .filter(Boolean);
      const applied = String(appliedCoupon || '').trim().toUpperCase();
      const nextApplied = applied && normalizedCodes.includes(applied) ? applied : (normalizedCodes[0] || '');
      update.coupon_code = nextApplied || null;
      update.discount_amount = 0;
      update.coupon_meta =
        normalizedCodes.length > 0
          ? { selected_codes: normalizedCodes, applied_code: nextApplied || null }
          : null;
    }

    // Prefer service-role client for update to avoid RLS issues
    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    const db = supabaseAdmin ?? supabase;
    if (!supabaseAdmin && adminError) {
      // not fatal; we'll attempt with user client, but may affect 0 rows due to RLS
      console.warn('Supabase admin client not configured:', adminError);
    }

    const { data: updated, error: updateErr } = await db
      .from('service_leads')
      .update(update)
      .eq('id', leadId)
      .select('id')
      .maybeSingle();

    if (updateErr) return NextResponse.json({ error: updateErr.message || 'Failed to update lead' }, { status: 400 });
    if (!updated) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

