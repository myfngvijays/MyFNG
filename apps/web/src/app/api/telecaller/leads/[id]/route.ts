import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { notifyBookingUpdatedWhatsApp } from '@/lib/services/bookingUpdatedWhatsApp';
import {
  buildTelecallerCrmQuote,
  parseServiceIdList,
  resolveServiceTypeNames,
  serviceLabelFromQuote,
} from '@/lib/telecaller/crmQuote';

const EDITABLE_STATUSES = new Set([
  'NEW',
  'CONTACTED',
  'INCOMPLETE',
  'ASSIGNED',
  'VALIDATED',
  'PENDING',
  'IN_PROGRESS',
]);

const LEAD_SELECT_FULL =
  'id, lead_number, status, customer_name, customer_phone, customer_id, vehicle_number, vehicle_make, vehicle_model, vehicle_variant, service_type, service_type_ids, subservice_ids, estimated_amount, discount_amount, coupon_code, preferred_slot_start, preferred_slot_end, pickup_required, pickup_address, customer_address, city, city_id, pincode, workshop_id, coupon_meta';

const LEAD_SELECT_SAFE =
  'id, lead_number, status, customer_name, customer_phone, vehicle_number, vehicle_make, vehicle_model, service_type, service_type_ids, subservice_ids, estimated_amount, preferred_slot_start, preferred_slot_end, pickup_required, pickup_address, customer_address, city, city_id, pincode, workshop_id, coupon_meta';

const LEAD_SELECT_MIN =
  'id, lead_number, status, customer_name, customer_phone, service_type, service_type_ids, subservice_ids, estimated_amount, preferred_slot_start, pickup_required, pickup_address, city, pincode, workshop_id, coupon_meta';

function normalizeIdList(value: unknown): string[] {
  return parseServiceIdList(value).sort();
}

function listsEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

async function loadLead(db: any, leadId: string) {
  for (const columns of [LEAD_SELECT_FULL, LEAD_SELECT_SAFE, LEAD_SELECT_MIN]) {
    const { data, error } = await db.from('service_leads').select(columns).eq('id', leadId).maybeSingle();
    if (!error && data) return data;
    if (error) {
      console.warn('[telecaller/leads PATCH] lead select failed:', error.message);
    }
  }
  return null;
}

async function replaceLeadPricingItems(db: any, leadId: string, quote: any, nowIso: string) {
  if (!quote?.line_items || !Array.isArray(quote.line_items) || quote.line_items.length === 0) return;
  try {
    await db.from('lead_pricing_items').delete().eq('lead_id', leadId);
    const rows = quote.line_items.map((item: any) => ({
      lead_id: leadId,
      item_type: item.kind === 'addon' ? 'ADDON' : 'SERVICE',
      item_id: item.id,
      item_name: item.name,
      unit_price: Number(item.price || 0),
      quantity: 1,
      total_price: Number(item.price || 0),
      created_at: nowIso,
    }));
    await db.from('lead_pricing_items').insert(rows);
  } catch (e) {
    console.warn('[telecaller/leads PATCH] lead_pricing_items refresh skipped', e);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userProfile = await resolveUserProfile(supabase, user);
    const roleCode = (userProfile?.roles as any)?.role_code || null;
    if (roleCode !== 'TELECALLER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const leadId = String(id || '').trim();
    if (!leadId) return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    const db = supabaseAdmin ?? supabase;
    if (!supabaseAdmin && adminError) {
      console.warn('Supabase admin client not configured:', adminError);
    }

    // Access check under RLS (user client)
    const { data: readableLead, error: accessErr } = await supabase
      .from('service_leads')
      .select('id, status')
      .eq('id', leadId)
      .maybeSingle();

    if (accessErr || !readableLead) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existingLead =
      (await loadLead(db, leadId)) ||
      (await loadLead(supabase, leadId)) ||
      readableLead;

    if (!existingLead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const status = String((existingLead as any).status || (readableLead as any).status || '');
    if (!EDITABLE_STATUSES.has(status)) {
      return NextResponse.json({ error: `Cannot edit lead with status: ${status}` }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const hasServiceTypes = Array.isArray(body?.service_types);
    const hasServiceAddons = Array.isArray(body?.service_addons);
    const serviceTypes = hasServiceTypes
      ? body.service_types.map(String)
      : normalizeIdList((existingLead as any).service_type_ids);
    const serviceAddons = hasServiceAddons
      ? body.service_addons.map(String)
      : normalizeIdList((existingLead as any).subservice_ids);

    const couponCodes = Array.isArray(body?.coupon_codes) ? body.coupon_codes.map(String) : null;
    const appliedCoupon = body?.applied_coupon != null ? String(body.applied_coupon) : null;

    const prevServiceIds = normalizeIdList((existingLead as any).service_type_ids);
    const prevAddonIds = normalizeIdList((existingLead as any).subservice_ids);
    const nextServiceIds = normalizeIdList(serviceTypes);
    const nextAddonIds = normalizeIdList(serviceAddons);
    const servicesChanged =
      (hasServiceTypes || hasServiceAddons) &&
      (!listsEqual(prevServiceIds, nextServiceIds) || !listsEqual(prevAddonIds, nextAddonIds));

    const nowIso = new Date().toISOString();

    const nextWorkshopId =
      body?.workshop_id !== undefined
        ? body.workshop_id || null
        : (existingLead as any).workshop_id || null;
    const nextCityId =
      body?.city_id !== undefined ? body.city_id || null : (existingLead as any).city_id || null;
    const nextMetaBase =
      body?.coupon_meta && typeof body.coupon_meta === 'object'
        ? {
            ...((existingLead as any).coupon_meta && typeof (existingLead as any).coupon_meta === 'object'
              ? (existingLead as any).coupon_meta
              : {}),
            ...body.coupon_meta,
          }
        : (existingLead as any).coupon_meta && typeof (existingLead as any).coupon_meta === 'object'
          ? (existingLead as any).coupon_meta
          : {};

    let nextCouponCode =
      appliedCoupon != null
        ? String(appliedCoupon || '').trim().toUpperCase()
        : String((existingLead as any).coupon_code || '').trim().toUpperCase() || null;
    if (couponCodes !== null) {
      const normalizedCodes = (couponCodes || [])
        .map((c) => String(c || '').trim().toUpperCase())
        .filter(Boolean);
      const applied = String(appliedCoupon || '').trim().toUpperCase();
      nextCouponCode = applied && normalizedCodes.includes(applied) ? applied : normalizedCodes[0] || null;
    }

    // Always re-quote on package change (never trust stale client amount)
    let resolvedQuote: any = null;
    let nextServiceLabel = '';
    let resolvedVehicleClass =
      body?.vehicle_class ||
      nextMetaBase?.vehicle_class ||
      (existingLead as any)?.coupon_meta?.vehicle_class ||
      null;
    const modelIdForClass = body?.model_id || (existingLead as any)?.model_id || null;
    if (!resolvedVehicleClass && modelIdForClass) {
      try {
        const { data: modelRow } = await db
          .from('car_models')
          .select('class')
          .eq('id', modelIdForClass)
          .maybeSingle();
        resolvedVehicleClass = String(modelRow?.class || '').trim() || null;
      } catch {
        // optional
      }
    }

    if (servicesChanged || body?.force_requote) {
      try {
        resolvedQuote = await buildTelecallerCrmQuote(db, {
          serviceTypeIds: nextServiceIds,
          addonIds: nextAddonIds,
          workshopId: Boolean(body?.pickup_required) ? null : nextWorkshopId,
          cityId: nextCityId,
          vehicleClass: resolvedVehicleClass,
          couponCode: nextCouponCode,
        });
      } catch (e) {
        console.warn('[telecaller/leads PATCH] re-quote failed', e);
      }
      nextServiceLabel =
        serviceLabelFromQuote(resolvedQuote) ||
        (await resolveServiceTypeNames(db, nextServiceIds)) ||
        '';
    } else if (body?.quote || body?.estimated_amount != null) {
      resolvedQuote = body?.quote || null;
      if (!resolvedQuote || !Number(resolvedQuote.total || resolvedQuote.subtotal || 0)) {
        try {
          resolvedQuote = await buildTelecallerCrmQuote(db, {
            serviceTypeIds: nextServiceIds,
            addonIds: nextAddonIds,
            workshopId: Boolean(body?.pickup_required) ? null : nextWorkshopId,
            cityId: nextCityId,
            vehicleClass: resolvedVehicleClass,
            couponCode: nextCouponCode,
          });
        } catch (e) {
          console.warn('[telecaller/leads PATCH] quote failed', e);
        }
      }
      nextServiceLabel =
        serviceLabelFromQuote(resolvedQuote) ||
        (body?.service_type &&
        !['CAR_SERVICE', 'HOME_SERVICE', 'RSA', 'NORMAL', 'SERVICE'].includes(
          String(body.service_type).toUpperCase(),
        )
          ? String(body.service_type)
          : '') ||
        '';
    }

    const update: Record<string, unknown> = {
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
      // Keep existing label unless services changed / client sent a real name
      service_type:
        nextServiceLabel ||
        (body?.service_type != null &&
        !['CAR_SERVICE', 'HOME_SERVICE', 'RSA', 'NORMAL', 'SERVICE'].includes(
          String(body.service_type).toUpperCase(),
        )
          ? body.service_type
          : (existingLead as any).service_type) ||
        null,
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

    if (servicesChanged || resolvedQuote) {
      const amountFromQuote = Number(resolvedQuote?.total ?? resolvedQuote?.subtotal ?? NaN);
      // On package change always overwrite amount from server quote (even if 0)
      if (servicesChanged && resolvedQuote) {
        update.estimated_amount = Number.isFinite(amountFromQuote) ? Math.max(0, amountFromQuote) : 0;
        update.discount_amount = Number(resolvedQuote.discount || 0) || 0;
      } else if (Number.isFinite(amountFromQuote) && amountFromQuote > 0) {
        update.estimated_amount = amountFromQuote;
        update.discount_amount = Number(resolvedQuote?.discount || 0) || 0;
      } else {
        const amountFromBody = Number(body?.estimated_amount);
        if (Number.isFinite(amountFromBody) && amountFromBody > 0) {
          update.estimated_amount = amountFromBody;
        }
      }
      if (nextServiceLabel) {
        update.service_type = nextServiceLabel;
        update.coupon_meta = {
          ...nextMetaBase,
          package_label: nextServiceLabel,
          ...(resolvedVehicleClass ? { vehicle_class: resolvedVehicleClass } : {}),
          ...(resolvedQuote
            ? {
                last_quote_total: Number(resolvedQuote.total || 0) || 0,
                last_quote_subtotal: Number(resolvedQuote.subtotal || 0) || 0,
              }
            : {}),
        };
      }
    }

    if (body?.workshop_id !== undefined) {
      update.workshop_id = body.workshop_id || null;
    }
    if (body?.preferred_slot_start !== undefined) {
      update.preferred_slot_start = body.preferred_slot_start || null;
    }
    if (body?.preferred_slot_end !== undefined) {
      update.preferred_slot_end = body.preferred_slot_end || null;
    }
    if (body?.coupon_meta !== undefined && body.coupon_meta != null && !update.coupon_meta) {
      update.coupon_meta = { ...nextMetaBase };
    }

    if (couponCodes !== null || appliedCoupon !== null) {
      const normalizedCodes = (couponCodes || [])
        .map((c) => String(c || '').trim().toUpperCase())
        .filter(Boolean);
      const applied = String(appliedCoupon || '').trim().toUpperCase();
      const nextApplied = applied && normalizedCodes.includes(applied) ? applied : normalizedCodes[0] || '';
      update.coupon_code = nextApplied || null;
      if (update.discount_amount == null) update.discount_amount = 0;
      update.coupon_meta =
        normalizedCodes.length > 0
          ? {
              ...((update.coupon_meta as object) || nextMetaBase || {}),
              selected_codes: normalizedCodes,
              applied_code: nextApplied || null,
            }
          : update.coupon_meta ?? null;
    }

    // Prefer admin update; fall back to user client if admin fails
    let updated: any = null;
    let updateErr: any = null;

    {
      const res = await db
        .from('service_leads')
        .update(update)
        .eq('id', leadId)
        .select(LEAD_SELECT_MIN)
        .maybeSingle();
      updated = res.data;
      updateErr = res.error;
    }

    if (updateErr || !updated) {
      // Retry without optional columns that may not exist in older DBs
      const slimUpdate = { ...update };
      delete slimUpdate.vehicle_variant;
      delete slimUpdate.customer_id;
      delete slimUpdate.is_incomplete;
      delete slimUpdate.lead_priority;
      delete slimUpdate.description;
      delete slimUpdate.model_id;

      const retryDb = updateErr ? supabase : db;
      const res = await retryDb
        .from('service_leads')
        .update(slimUpdate)
        .eq('id', leadId)
        .select(LEAD_SELECT_MIN)
        .maybeSingle();

      if (res.error || !res.data) {
        // Last resort: update without select, then re-read
        const bare = await (supabaseAdmin || supabase)
          .from('service_leads')
          .update(slimUpdate)
          .eq('id', leadId);
        if (bare.error) {
          return NextResponse.json(
            { error: bare.error.message || updateErr?.message || 'Failed to update lead' },
            { status: 400 },
          );
        }
        updated =
          (await loadLead(db, leadId)) ||
          (await loadLead(supabase, leadId)) ||
          { id: leadId, ...slimUpdate };
      } else {
        updated = res.data;
      }
    }

    if (servicesChanged && resolvedQuote) {
      await replaceLeadPricingItems(db, leadId, resolvedQuote, nowIso);
    }

    // Ensure in-memory row has the new amount/label for WhatsApp + response
    if (updated && typeof updated === 'object') {
      if (update.estimated_amount !== undefined) {
        updated.estimated_amount = update.estimated_amount;
      }
      if (update.service_type) {
        updated.service_type = update.service_type;
      }
      if (update.discount_amount !== undefined) {
        updated.discount_amount = update.discount_amount;
      }
    }

    let whatsapp: any = null;
    if (servicesChanged) {
      try {
        const prevLabel = await resolveServiceTypeNames(db, prevServiceIds);
        const nextLabel =
          nextServiceLabel ||
          String(updated?.service_type || '').trim() ||
          (await resolveServiceTypeNames(db, nextServiceIds));

        let workshopName = '';
        if (updated?.workshop_id) {
          try {
            const { data: ws } = await db
              .from('workshops')
              .select('name')
              .eq('id', updated.workshop_id)
              .maybeSingle();
            workshopName = String(ws?.name || '').trim();
          } catch {
            // optional
          }
        }

        const meta =
          (update.coupon_meta && typeof update.coupon_meta === 'object'
            ? (update.coupon_meta as Record<string, unknown>)
            : null) ||
          (updated?.coupon_meta && typeof updated.coupon_meta === 'object'
            ? (updated.coupon_meta as Record<string, unknown>)
            : {});

        const newAmount = Number(
          update.estimated_amount ?? resolvedQuote?.total ?? updated?.estimated_amount ?? 0,
        );

        whatsapp = await notifyBookingUpdatedWhatsApp({
          lead: {
            ...updated,
            workshop_name: workshopName || null,
            flat_number: meta.flat_number || null,
            landmark: meta.landmark || null,
            address_type: meta.address_type || null,
            estimated_amount: newAmount,
          },
          customerId: updated?.customer_id || null,
          serviceLabel: nextLabel || null,
          previousServiceLabel: prevLabel || null,
          amount: newAmount,
          body: {
            ...body,
            coupon_meta: meta,
            service_type_ids: nextServiceIds,
            quote: resolvedQuote,
          },
        });

        if (whatsapp?.skipped || !whatsapp?.sent) {
          console.log('[telecaller/leads PATCH] WhatsApp skipped:', whatsapp?.skipReason || whatsapp?.error);
        }
      } catch (waErr: any) {
        console.error('[telecaller/leads PATCH] WhatsApp failed:', waErr?.message || waErr);
        whatsapp = { sent: false, skipped: true, skipReason: waErr?.message || 'whatsapp_error' };
      }
    }

    return NextResponse.json({
      success: true,
      servicesChanged,
      estimated_amount: updated?.estimated_amount ?? update.estimated_amount ?? null,
      service_type: updated?.service_type ?? update.service_type ?? null,
      quote: resolvedQuote
        ? {
            total: resolvedQuote.total,
            subtotal: resolvedQuote.subtotal,
            discount: resolvedQuote.discount,
            line_items: resolvedQuote.line_items,
          }
        : null,
      whatsapp,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
