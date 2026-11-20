import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { notifyBookingConfirmedWhatsApp } from '@/lib/services/bookingConfirmedWhatsApp';
import { notifyBookingUpdatedWhatsApp } from '@/lib/services/bookingUpdatedWhatsApp';
import {
  buildTelecallerCrmQuote,
  parseServiceIdList,
  resolveServiceTypeNames,
  serviceLabelFromQuote,
} from '@/lib/telecaller/crmQuote';
import { extractInboundCustomerMessage } from '@/lib/telecaller/redactLeadSource';
import { serviceLeadVehicleNumber } from '@/lib/telecaller/serviceLeadVehicleNumber';
import { closeLeadFollowUps, crmLeadClosedForFollowUp } from '@/lib/telecaller/crmFollowUpClose';
import { appendBookingConfirmedToSheet } from '@/lib/telecaller/bookingWonSheet';
import { titleCasePersonName } from '@/lib/telecaller/personName';

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

function clipVal(value: unknown) {
  return String(value ?? '').trim();
}

function pushFieldChange(lines: string[], label: string, before: unknown, after: unknown) {
  const prev = clipVal(before);
  const next = clipVal(after);
  if (prev === next) return;
  lines.push(`${label}: ${prev || '—'} → ${next || '—'}`);
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
    if (roleCode !== 'TELECALLER' && roleCode !== 'LEAD_MANAGER' && roleCode !== 'SUPER_ADMIN' && roleCode !== 'SUB_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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

    const body = await request.json().catch(() => ({}));
    if (body?.disposition_only === true) {
      const prevMeta =
        (existingLead as any)?.coupon_meta && typeof (existingLead as any).coupon_meta === 'object'
          ? (existingLead as any).coupon_meta
          : {};
      const incoming =
        body?.coupon_meta && typeof body.coupon_meta === 'object' ? body.coupon_meta : {};
      const nextMeta = { ...prevMeta, ...incoming };
      const nowIso = new Date().toISOString();
      const patch: Record<string, unknown> = {
        coupon_meta: nextMeta,
        updated_at: nowIso,
        is_incomplete: false,
        updated_by_id: userProfile?.id || null,
      };
      if (body.status) patch.status = String(body.status);
      if (body.pickup_required != null) patch.pickup_required = Boolean(body.pickup_required);
      const { data: updated, error: statusErr } = await db
        .from('service_leads')
        .update(patch)
        .eq('id', leadId)
        .select(LEAD_SELECT_SAFE)
        .maybeSingle();
      if (statusErr) {
        return NextResponse.json({ error: statusErr.message || 'Could not save status' }, { status: 400 });
      }
      let whatsapp: { sent?: boolean; skipped?: boolean; skipReason?: string } | null = null;
      const nextCall = String(nextMeta.last_call_result || '').toUpperCase();
      if (body.send_booking_confirmed_whatsapp === true && nextCall === 'BOOKING_CONFIRMED') {
        try {
          whatsapp = await notifyBookingConfirmedWhatsApp({
            lead: { ...existingLead, ...updated, ...patch, id: leadId, coupon_meta: nextMeta },
            customerId: (updated as any)?.customer_id || (existingLead as any)?.customer_id || null,
            serviceLabel: String((updated as any)?.service_type || (existingLead as any)?.service_type || ''),
          });
        } catch (waErr: any) {
          whatsapp = { sent: false, skipped: true, skipReason: waErr?.message || 'whatsapp_error' };
        }
      }
      if (crmLeadClosedForFollowUp({ status: String(patch.status || (updated as any)?.status || ''), coupon_meta: nextMeta })) {
        try {
          await closeLeadFollowUps(db, leadId, {
            completedBy: userProfile?.id || null,
            note: 'Auto-closed — lead moved to In Service / Service Done / Lost',
          });
        } catch {
          /* optional */
        }
      }
      return NextResponse.json({ success: true, lead: updated, whatsapp });
    }
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

    // Selected package ids win over the old service_type text still sitting on the form.
    if (nextServiceIds.length) {
      const fromIds = await resolveServiceTypeNames(db, nextServiceIds);
      if (fromIds) nextServiceLabel = fromIds;
    }

    const confirmingBooking =
      body?.send_booking_confirmed_whatsapp === true ||
      String(body?.status || '').trim().toUpperCase() === 'VALIDATED';
    const storedServiceLabel = String((existingLead as any).service_type || '').trim();
    if (
      !resolvedQuote &&
      nextServiceIds.length &&
      (confirmingBooking || (nextServiceLabel && nextServiceLabel !== storedServiceLabel))
    ) {
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
        console.warn('[telecaller/leads PATCH] confirm re-quote failed', e);
      }
    }

    const update: Record<string, unknown> = {
      customer_name:
        body?.customer_name == null ? null : titleCasePersonName(String(body.customer_name)),
      customer_phone: body?.customer_phone ?? null,
      customer_alternate_phone: body?.customer_alternate_phone ?? null,
      customer_email: body?.customer_email ?? null,
      customer_address: body?.customer_address ?? null,
      city_id: body?.city_id ?? null,
      city: body?.city ?? null,
      pincode: body?.pincode ?? null,

      vehicle_number: serviceLeadVehicleNumber(body?.vehicle_number, (existingLead as any).vehicle_number),
      vehicle_make: body?.vehicle_make ?? null,
      model_id: body?.model_id ?? null,
      vehicle_model: body?.vehicle_model ?? null,
      vehicle_variant: body?.vehicle_variant ?? null,
      vehicle_year: body?.vehicle_year ?? null,
      vehicle_fuel_type: body?.vehicle_fuel_type ?? null,
      odometer_km: body?.odometer_km ?? null,

      service_type_ids: JSON.stringify(serviceTypes),
      subservice_ids: JSON.stringify(serviceAddons),
      // Package name comes from the selected service ids, not a stale form string.
      service_type:
        nextServiceLabel ||
        (nextServiceIds.length
          ? (existingLead as any).service_type
          : body?.service_type != null &&
              !['CAR_SERVICE', 'HOME_SERVICE', 'RSA', 'NORMAL', 'SERVICE'].includes(
                String(body.service_type).toUpperCase(),
              )
            ? body.service_type
            : (existingLead as any).service_type) ||
        null,
      // Persist customer text only — strip WhatsApp / Trigger wrappers if present
      problem_description:
        body?.problem_description != null
          ? extractInboundCustomerMessage(body.problem_description) ||
            String(body.problem_description || '').trim() ||
            null
          : null,
      description:
        body?.description != null
          ? extractInboundCustomerMessage(body.description) ||
            String(body.description || '').trim() ||
            null
          : null,

      pickup_required: Boolean(body?.pickup_required),
      pickup_address: body?.pickup_address ?? null,

      ...(Object.prototype.hasOwnProperty.call(body || {}, 'notes')
        ? { notes: body?.notes == null || String(body.notes).trim() === '' ? null : String(body.notes).trim() }
        : {}),
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

    // Allow telecaller to advance lead disposition (e.g. Booking confirmed → VALIDATED)
    if (body?.follow_up_required === false || body?.next_follow_up_at === null) {
      update.follow_up_required = false;
      update.next_follow_up_at = null;
    } else if (body?.next_follow_up_at) {
      update.follow_up_required = true;
      update.next_follow_up_at = body.next_follow_up_at;
    }

    if (body?.status != null && String(body.status).trim()) {
      const nextStatus = String(body.status).trim().toUpperCase();
      const ALLOWED_STATUS_SET = new Set([
        'NEW',
        'CONTACTED',
        'INCOMPLETE',
        'PENDING',
        'VALIDATED',
        'ASSIGNED',
        'IN_PROGRESS',
        'COMPLETED',
        'REJECTED',
      ]);
      if (ALLOWED_STATUS_SET.has(nextStatus)) {
        update.status = nextStatus;
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

    const prevMeta =
      (existingLead as any)?.coupon_meta && typeof (existingLead as any).coupon_meta === 'object'
        ? (existingLead as any).coupon_meta
        : {};
    let extraRow: Record<string, unknown> = {};
    {
      const extra = await db
        .from('service_leads')
        .select(
          'customer_alternate_phone, customer_email, notes, lead_priority, vehicle_year, vehicle_fuel_type, odometer_km',
        )
        .eq('id', leadId)
        .maybeSingle();
      if (!extra.error && extra.data) extraRow = extra.data as Record<string, unknown>;
    }
    const beforeRow = { ...(existingLead as any), ...extraRow };
    // A list-row open used to save blanks over pincode, year, fuel, notes and visit slot.
    // Only a form that loaded the full lead may clear those fields.
    if (body?.form_hydrated !== true) {
      const keepFilled = (key: string) => {
        const incoming = update[key];
        const existing = beforeRow[key];
        const incomingEmpty = incoming == null || String(incoming).trim() === '';
        const existingFilled = existing != null && String(existing).trim() !== '';
        if (incomingEmpty && existingFilled) {
          update[key] = existing;
          if (body && typeof body === 'object') (body as Record<string, unknown>)[key] = existing;
        }
      };
      for (const key of [
        'pincode',
        'vehicle_year',
        'vehicle_fuel_type',
        'odometer_km',
        'notes',
        'customer_address',
        'pickup_address',
        'preferred_slot_start',
        'preferred_slot_end',
      ]) {
        keepFilled(key);
      }
    }
    const nextMeta =
      update.coupon_meta && typeof update.coupon_meta === 'object'
        ? (update.coupon_meta as Record<string, any>)
        : (nextMetaBase as Record<string, any>);
    const fieldLines: string[] = [];
    const watch = (key: string, label: string) => {
      if (body?.[key] === undefined) return;
      pushFieldChange(fieldLines, label, beforeRow[key], body[key]);
    };
    watch('customer_name', 'Name');
    watch('customer_phone', 'Phone');
    watch('customer_alternate_phone', 'Alternate phone');
    watch('customer_email', 'Email');
    watch('pincode', 'Pincode');
    watch('city', 'City');
    watch('customer_address', 'Address');
    watch('notes', 'Notes');
    watch('lead_priority', 'Priority');
    if (body?.pickup_required !== undefined && Boolean(beforeRow.pickup_required) !== Boolean(body.pickup_required)) {
      fieldLines.push(`Pickup: ${beforeRow.pickup_required ? 'Yes' : 'No'} → ${body.pickup_required ? 'Yes' : 'No'}`);
    }
    if (body?.workshop_id !== undefined && clipVal(beforeRow.workshop_id) !== clipVal(body.workshop_id)) {
      fieldLines.push('Workshop updated');
    }
    const prevReg = clipVal(beforeRow.vehicle_number).toUpperCase();
    const nextReg = body?.vehicle_number !== undefined ? clipVal(body.vehicle_number).toUpperCase() : prevReg;
    if (body?.vehicle_number !== undefined && prevReg !== nextReg && !(prevReg === 'PENDING' && !nextReg)) {
      fieldLines.push(`Car number: ${prevReg || '—'} → ${nextReg || '—'}`);
    }
    if (
      body?.vehicle_make !== undefined &&
      (clipVal(beforeRow.vehicle_make) !== clipVal(body.vehicle_make) ||
        clipVal(beforeRow.vehicle_model) !== clipVal(body.vehicle_model))
    ) {
      const fromCar = [beforeRow.vehicle_make, beforeRow.vehicle_model].map(clipVal).filter(Boolean).join(' ') || '—';
      const toCar = [body.vehicle_make, body.vehicle_model].map(clipVal).filter(Boolean).join(' ') || '—';
      if (fromCar !== toCar) fieldLines.push(`Car: ${fromCar} → ${toCar}`);
    }
    watch('vehicle_year', 'Year');
    watch('vehicle_fuel_type', 'Fuel');
    watch('odometer_km', 'Odometer');
    pushFieldChange(fieldLines, 'Flat', prevMeta.flat_number, nextMeta.flat_number);
    pushFieldChange(fieldLines, 'Area', prevMeta.area, nextMeta.area);
    pushFieldChange(fieldLines, 'Landmark', prevMeta.landmark, nextMeta.landmark);
    const prevStatus = clipVal(prevMeta.last_call_label || prevMeta.last_call_result);
    const nextStatus = clipVal(nextMeta.last_call_label || nextMeta.last_call_result);
    if (prevStatus !== nextStatus && nextStatus) {
      fieldLines.unshift(`Status: ${prevStatus || '—'} → ${nextStatus}`);
    }

    if (fieldLines.length) {
      const prevHistory = Array.isArray(prevMeta.profile_history) ? prevMeta.profile_history : [];
      const historyEntry = {
        at: nowIso,
        summary: fieldLines.join('\n'),
        event: 'FIELDS',
        previous_label: prevStatus || null,
        status: nextStatus || null,
      };
      update.coupon_meta = {
        ...nextMeta,
        profile_history: [historyEntry, ...prevHistory].slice(0, 50),
      };
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

    // WhatsApp rules:
    // - booking_confirmed ONLY when telecaller sets Booking Confirmed (explicit flag / new VALIDATED)
    // - booking_updated ONLY for already-confirmed leads when services change (never booking_confirmed)
    // - Interested / Lost / etc. → save only, no booking WhatsApp
    const bookingNextStatus = String(update.status || updated?.status || existingLead.status || '')
      .trim()
      .toUpperCase();
    const bookingPrevStatus = String(existingLead.status || '').trim().toUpperCase();
    const sendBookingConfirmedWa =
      body?.send_booking_confirmed_whatsapp === true ||
      (bookingNextStatus === 'VALIDATED' && bookingPrevStatus !== 'VALIDATED');
    const sendBookingUpdatedWa =
      !sendBookingConfirmedWa &&
      servicesChanged &&
      (bookingPrevStatus === 'VALIDATED' || bookingNextStatus === 'VALIDATED') &&
      body?.send_booking_updated_whatsapp !== false;

    let whatsapp: any = null;
    if (sendBookingConfirmedWa || sendBookingUpdatedWa) {
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

        const leadForWa = {
          // Post-save select omits the car columns. Keep the saved vehicle.
          ...existingLead,
          ...updated,
          vehicle_number: updated?.vehicle_number || (existingLead as any)?.vehicle_number || null,
          vehicle_make: updated?.vehicle_make || (existingLead as any)?.vehicle_make || null,
          vehicle_model: updated?.vehicle_model || (existingLead as any)?.vehicle_model || null,
          vehicle_variant: updated?.vehicle_variant || (existingLead as any)?.vehicle_variant || null,
          workshop_name: workshopName || null,
          flat_number: meta.flat_number || null,
          landmark: meta.landmark || null,
          address_type: meta.address_type || null,
          estimated_amount: newAmount,
        };
        const waBody = {
          ...body,
          coupon_meta: meta,
          service_type_ids: nextServiceIds,
          quote: resolvedQuote,
        };

        if (sendBookingConfirmedWa) {
          whatsapp = await notifyBookingConfirmedWhatsApp({
            lead: leadForWa,
            customerId: updated?.customer_id || null,
            serviceLabel: nextLabel || null,
            amount: newAmount,
            body: waBody,
          });
        } else {
          whatsapp = await notifyBookingUpdatedWhatsApp({
            lead: leadForWa,
            customerId: updated?.customer_id || null,
            serviceLabel: nextLabel || null,
            previousServiceLabel: prevLabel || null,
            amount: newAmount,
            body: waBody,
          });
        }

        if (whatsapp?.skipped || !whatsapp?.sent) {
          console.log('[telecaller/leads PATCH] WhatsApp skipped:', whatsapp?.skipReason || whatsapp?.error);
        }
      } catch (waErr: any) {
        console.error('[telecaller/leads PATCH] WhatsApp failed:', waErr?.message || waErr);
        whatsapp = { sent: false, skipped: true, skipReason: waErr?.message || 'whatsapp_error' };
      }
    }

    const closedLead = {
      status: String(update.status || updated?.status || existingLead.status || ''),
      coupon_meta:
        (update.coupon_meta as { last_call_result?: string } | undefined) ||
        (updated?.coupon_meta as { last_call_result?: string } | undefined) ||
        ((existingLead as any).coupon_meta as { last_call_result?: string } | undefined),
    };
    const prevCall = String((existingLead as any).coupon_meta?.last_call_result || '').toUpperCase();
    const nextMetaForSheet =
      (update.coupon_meta && typeof update.coupon_meta === 'object'
        ? (update.coupon_meta as Record<string, unknown>)
        : {}) || {};
    const nextCall = String(nextMetaForSheet.last_call_result || '').toUpperCase();
    const alreadyOnSheet = Boolean((existingLead as any).coupon_meta?.won_sheet_at);
    if (nextCall === 'BOOKING_CONFIRMED' && prevCall !== 'BOOKING_CONFIRMED' && !alreadyOnSheet) {
      try {
        let workshopName = '';
        const workshopId = update.workshop_id || updated?.workshop_id || null;
        if (workshopId) {
          const { data: ws } = await db.from('workshops').select('name').eq('id', workshopId).maybeSingle();
          workshopName = String(ws?.name || '').trim();
        }
        const savedAddress = String(update.customer_address || updated?.customer_address || '').trim();
        const addressBits = savedAddress
          ? [savedAddress]
          : [
              nextMetaForSheet.flat_number,
              nextMetaForSheet.area,
              nextMetaForSheet.landmark,
              update.city || updated?.city,
              update.pincode || updated?.pincode,
            ]
              .map((v) => String(v || '').trim())
              .filter(Boolean);
        const sheet = await appendBookingConfirmedToSheet({
          name: String(update.customer_name || updated?.customer_name || ''),
          phone: String(update.customer_phone || updated?.customer_phone || ''),
          address: addressBits.join(', '),
          carNo: String(update.vehicle_number || updated?.vehicle_number || ''),
          make: String(update.vehicle_make || updated?.vehicle_make || ''),
          carModel: String(update.vehicle_model || updated?.vehicle_model || ''),
          packageName: String(nextServiceLabel || update.service_type || updated?.service_type || ''),
          packageAmount: update.estimated_amount ?? updated?.estimated_amount ?? '',
          workshop: workshopName,
          agent: String(userProfile?.full_name || '').trim(),
          remark: String(nextMetaForSheet.telecaller_remarks || '').trim(),
          customerRemark: String(update.notes || '').trim(),
        });
        if (sheet.ok) {
          await db
            .from('service_leads')
            .update({
              coupon_meta: { ...nextMetaForSheet, won_sheet_at: new Date().toISOString() },
            })
            .eq('id', leadId);
        } else {
          console.warn('[telecaller/leads PATCH] won sheet skipped:', sheet.error);
        }
      } catch (sheetErr: any) {
        console.warn('[telecaller/leads PATCH] won sheet failed:', sheetErr?.message || sheetErr);
      }
    }

    if (crmLeadClosedForFollowUp(closedLead)) {
      try {
        await closeLeadFollowUps(db, leadId, {
          completedBy: userProfile?.id || null,
          note: 'Auto-closed — lead moved to In Service / Service Done / Lost',
        });
      } catch (fuErr) {
        console.warn('[telecaller/leads PATCH] close follow-ups skipped', fuErr);
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
