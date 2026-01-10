import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const leadId = params.id;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_ADMIN_KEY;

    // Prefer service role to make this endpoint truly public.
    const supabaseAdmin =
      supabaseUrl && serviceRoleKey
        ? createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : null;

    const reader = supabaseAdmin ?? supabase;
    const envBits = {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
      usingServiceRoleClient: Boolean(supabaseAdmin),
    };

    // Lead details (schema-tolerant: try richer fields, fallback if some columns missing)
    const selectV1 = `
        id,
        lead_number,
        status,
        created_at,
        workshop_id,
        customer_public_enabled,
        customer_public_enabled_at,
        customer_name,
        customer_phone,
        customer_address,
        address,
        city,
        pincode,
        vehicle_make,
        vehicle_model,
        vehicle_number,
        vehicle_variant,
        vehicle_year,
        vehicle_odometer,
        problem_description,
        service_type,
        service_type_ids,
        subservice_ids,
        pickup_required,
        pickup_address,
        assigned_supervisor_id,
        final_amount,
        workshop:workshops!workshop_id(name, address, city, phone)
      `;

    const selectV2 = `
        id,
        lead_number,
        status,
        created_at,
        workshop_id,
        customer_public_enabled,
        customer_public_enabled_at,
        customer_name,
        customer_address,
        address,
        city,
        pincode,
        vehicle_make,
        vehicle_model,
        vehicle_number,
        vehicle_variant,
        vehicle_year,
        vehicle_odometer,
        problem_description,
        service_type,
        service_type_ids,
        subservice_ids,
        pickup_required,
        pickup_address,
        assigned_supervisor_id,
        final_amount,
        workshop:workshops!workshop_id(name, address, city, phone)
      `;

    const selectV3 = `
        id,
        lead_number,
        status,
        created_at,
        workshop_id,
        customer_public_enabled,
        customer_public_enabled_at,
        vehicle_make,
        vehicle_model,
        vehicle_number,
        vehicle_variant,
        vehicle_year,
        problem_description,
        pickup_required,
        pickup_address,
        assigned_supervisor_id,
        final_amount,
        workshop:workshops!workshop_id(name, address, phone)
      `;

    const trySelects = [selectV1, selectV2, selectV3];

    let lead: any = null;
    let leadError: any = null;

    for (const sel of trySelects) {
      const attempt = await reader.from('service_leads').select(sel).eq('id', leadId).maybeSingle();
      lead = attempt.data as any;
      leadError = attempt.error as any;
      if (!leadError) break;
      const msg = String(leadError?.message || leadError);
      if (leadError?.code === '42703' || /does not exist/i.test(msg)) {
        continue; // try next selection
      }
      break; // non-schema error
    }

    if (leadError) {
      const msg = (leadError as any)?.message || String(leadError);
      const code = (leadError as any)?.code || null;
      const isRls =
        code === '42501' ||
        /row-level security|violates row level security|permission denied/i.test(msg);
      return NextResponse.json(
        {
          error: 'Failed to load public lead data',
          details: msg,
          code,
          env: envBits,
          hint: supabaseAdmin
            ? isRls
              ? 'RLS is blocking access even for service-role client (unexpected). Check Supabase policies.'
              : null
            : 'Server is missing Supabase service role key (SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_KEY). Without it, this public endpoint cannot read data if RLS blocks anon access.',
        },
        { status: isRls ? 403 : 500 }
      );
    }

    if (!lead) {
      return NextResponse.json({ error: 'Service request not found' }, { status: 404 });
    }

    // Gate: public page should not be active until advisor enables it
    // If column doesn't exist in older DBs, it will be missing => treat as disabled to be safe.
    if (!(lead as any)?.customer_public_enabled) {
      return NextResponse.json(
        {
          error: 'PUBLIC_LINK_DISABLED',
          message: 'This public link is not active yet. Please ask your service advisor to enable it.',
        },
        { status: 403 }
      );
    }

    // Assigned advisor (best-effort)
    try {
      if (lead.assigned_supervisor_id) {
        const { data } = await reader
          .from('users_login')
          .select('full_name, phone')
          .eq('id', lead.assigned_supervisor_id)
          .maybeSingle();
        if (data) lead.assigned_advisor = data;
      }
    } catch {
      // ignore
    }

    const isUuidLike = (v: any) =>
      typeof v === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim());

    const parseIdList = (v: any): string[] => {
      if (v == null) return [];
      if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
      if (typeof v === 'string') {
        const s = v.trim();
        if (!s) return [];
        try {
          const parsed = JSON.parse(s);
          if (Array.isArray(parsed)) return parsed.map((x) => String(x)).filter(Boolean);
        } catch {
          // ignore
        }
        // comma-separated fallback
        if (s.includes(',')) return s.split(',').map((x) => x.trim()).filter(Boolean);
        return [s];
      }
      return [String(v)];
    };

    const isNumericLike = (s: string) => /^-?\d+(\.\d+)?$/.test(String(s).trim());

    // Service + add-on selection (names + prices) - best effort
    let selectedServices: any[] = [];
    let selectedAddons: any[] = [];

    try {
      // If previous deployments stored UUID in name fields, treat as missing
      if (isUuidLike(lead.service_type_name)) lead.service_type_name = null;

      const serviceIds = (() => {
        const fromArray = parseIdList(lead.service_type_ids);
        if (fromArray.length) return fromArray;
        const single = (lead.service_type || '').toString().trim();
        return single ? [single] : [];
      })();

      // If service_type is already a human-readable name, keep it.
      const serviceTypeRaw = (lead.service_type || '').toString().trim();

      if (serviceIds.length) {
        const inVals: any[] = serviceIds.every(isNumericLike) ? serviceIds.map((x) => Number(x)) : serviceIds;
        // service_types schema differs across deployments (base_price may not exist)
        const attempt = await reader.from('service_types').select('id, name, base_price').in('id', inVals as any);
        if (attempt.error && (attempt.error as any)?.code === '42703') {
          const fallback = await reader.from('service_types').select('id, name').in('id', inVals as any);
          selectedServices = (fallback.data || []).map((r: any) => ({ ...r, base_price: 0 }));
        } else {
          selectedServices = (attempt.data || []).map((r: any) => ({ ...r, base_price: Number(r?.base_price ?? 0) }));
        }
      }

      // If base_price is missing/0, try workshop_service_pricing (or get_service_price function)
      if (lead.workshop_id && Array.isArray(selectedServices) && selectedServices.length) {
        for (const s of selectedServices) {
          if (Number(s?.base_price ?? 0) > 0) continue;
          const serviceTypeId = s?.id;
          if (!serviceTypeId) continue;
          let price = 0;
          try {
            const { data } = await reader.rpc('get_service_price', {
              p_workshop_id: lead.workshop_id,
              p_service_type_id: serviceTypeId,
              p_vehicle_class: null,
              p_zone_id: null,
            } as any);
            price = Number(data ?? 0);
          } catch {
            // ignore
          }
          if (!price) {
            // Pricing table may include zone_id/city_id/class specificity; pick best available row.
            try {
              const attempt = await reader
                .from('workshop_service_pricing')
                .select('custom_price, city_id, zone_id, class, created_at')
                .eq('workshop_id', lead.workshop_id)
                .eq('service_type_id', serviceTypeId)
                .eq('is_active', true)
                // Prefer most specific row: city > zone > class > default
                .order('city_id', { ascending: false, nullsFirst: false } as any)
                .order('zone_id', { ascending: false, nullsFirst: false } as any)
                .order('class', { ascending: false, nullsFirst: false } as any)
                .order('created_at', { ascending: false } as any)
                .limit(1);

              if (attempt.error && (attempt.error as any)?.code === '42703') {
                const fallback = await reader
                  .from('workshop_service_pricing')
                  .select('custom_price')
                  .eq('workshop_id', lead.workshop_id)
                  .eq('service_type_id', serviceTypeId)
                  .limit(1);
                price = Number((fallback.data?.[0] as any)?.custom_price ?? 0);
              } else {
                price = Number((attempt.data?.[0] as any)?.custom_price ?? 0);
              }
            } catch {
              // ignore
            }
          }
          s.base_price = Number.isFinite(price) ? price : 0;
        }
      }

      if (!lead.service_type_name) {
        if (selectedServices.length) lead.service_type_name = selectedServices.map((s) => s.name).filter(Boolean).join(', ');
        else if (serviceTypeRaw && !isUuidLike(serviceTypeRaw) && serviceTypeRaw.length > 2) lead.service_type_name = serviceTypeRaw;
      }
    } catch {
      // ignore
    }

    try {
      // "subservice_ids" is used as add-on ids in this codebase; actual table is service_addons
      if (isUuidLike(lead.subservice_names)) lead.subservice_names = null;

      const addonIds = parseIdList(lead.subservice_ids);
      if (addonIds.length) {
        const inVals: any[] = addonIds.every(isNumericLike) ? addonIds.map((x) => Number(x)) : addonIds;
        // service_addons schema: price column
        const attempt = await reader.from('service_addons').select('id, name, price').in('id', inVals as any);
        if (attempt.error && (attempt.error as any)?.code === '42703') {
          const fallback = await reader.from('service_addons').select('id, name').in('id', inVals as any);
          selectedAddons = (fallback.data || []).map((r: any) => ({ ...r, base_price: 0 }));
        } else {
          selectedAddons = (attempt.data || []).map((r: any) => ({ id: r.id, name: r.name, base_price: Number(r?.price ?? 0) }));
        }
      }

      if (!lead.subservice_names && selectedAddons.length) {
        lead.subservice_names = selectedAddons.map((a) => a.name).filter(Boolean).join(', ');
      }
    } catch {
      // ignore
    }

    // Helper function based fallback (if available) for service/subservice names
    try {
      if (!lead.service_type_name && lead.service_type_ids != null) {
        const idsText =
          typeof lead.service_type_ids === 'string' ? lead.service_type_ids : JSON.stringify(lead.service_type_ids);
        const { data } = await reader.rpc('get_service_type_names', { service_ids: idsText });
        if (typeof data === 'string' && data.trim()) lead.service_type_name = data.trim();
      }
      if (!lead.subservice_names && lead.subservice_ids != null) {
        const idsText = typeof lead.subservice_ids === 'string' ? lead.subservice_ids : JSON.stringify(lead.subservice_ids);
        const { data } = await reader.rpc('get_subservice_names', { subservice_ids: idsText });
        if (typeof data === 'string' && data.trim()) lead.subservice_names = data.trim();
      }
    } catch {
      // ignore
    }

    lead.selected_services = selectedServices || [];
    lead.selected_addons = selectedAddons || [];

    // Pricing breakdown (service + addons)
    let pricingItems: any[] = [];
    try {
      const { data } = await reader
        .from('lead_pricing_items')
        .select('id, item_name, is_addon, base_price, final_price, qty, status')
        .eq('lead_id', leadId)
        .eq('status', 'ACTIVE')
        .order('is_addon', { ascending: true })
        .order('created_at', { ascending: true });
      pricingItems = data || [];
    } catch {
      pricingItems = [];
    }

    const { data: events } = await reader
      .from('lead_events')
      .select('id, lead_id, event_description, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    const { data: media } = await reader
      .from('lead_media')
      .select('id, lead_id, media_url, media_category, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    // Extra work requests (customer approval section)
    let extraWork: any[] = [];
    try {
      const { data } = await reader
        .from('lead_extra_charges')
        .select(
          'id, lead_id, description, reason, amount, status, created_at, is_urgent, oem_price, oes_price, labour_price, part_price_type, customer_approved, customer_approved_at, rejection_reason'
        )
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      extraWork = data || [];
    } catch {
      // If some columns don't exist in this deployment, fall back to core fields
      const { data } = await reader
        .from('lead_extra_charges')
        .select('id, lead_id, description, reason, amount, status, created_at, is_urgent, rejection_reason')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      extraWork = data || [];
    }

    // Odometer fallback:
    // Some installs store it in `odometer_km` or only in pickup_tracking.
    try {
      const currentOdo = Number((lead as any)?.vehicle_odometer || 0) || 0;
      if (currentOdo <= 0) {
        // 1) Try odometer_km on service_leads (legacy)
        try {
          const { data } = await reader
            .from('service_leads')
            .select('odometer_km')
            .eq('id', leadId)
            .maybeSingle();
          const legacy = Number((data as any)?.odometer_km || 0) || 0;
          if (legacy > 0) (lead as any).vehicle_odometer = legacy;
        } catch {
          // ignore
        }

        // 2) Try pickup_tracking pickup_odometer_reading
        if (!(Number((lead as any)?.vehicle_odometer || 0) > 0)) {
          const { data: tracking } = await reader
            .from('pickup_tracking')
            .select('pickup_odometer_reading')
            .eq('lead_id', leadId)
            .maybeSingle();
          const picked = Number((tracking as any)?.pickup_odometer_reading || 0) || 0;
          if (picked > 0) (lead as any).vehicle_odometer = picked;
        }
      }
    } catch {
      // ignore
    }

    return NextResponse.json(
      {
        lead,
        events: events || [],
        media: media || [],
        extra_work: extraWork || [],
        pricing_items: pricingItems || [],
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: e?.message || String(e) },
      { status: 500 }
    );
  }
}

