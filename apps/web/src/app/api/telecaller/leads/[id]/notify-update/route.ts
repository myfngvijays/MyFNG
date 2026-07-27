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

async function loadLeadRow(db: any, leadId: string) {
  const selects = [
    `id, lead_number, customer_name, customer_phone, customer_id,
     vehicle_number, vehicle_make, vehicle_model, vehicle_variant, model_id,
     service_type, service_type_ids, subservice_ids, estimated_amount, coupon_code,
     preferred_slot_start, preferred_slot_end,
     pickup_required, pickup_address, customer_address, city, city_id, pincode,
     workshop_id, coupon_meta`,
    `id, lead_number, customer_name, customer_phone,
     vehicle_number, vehicle_make, vehicle_model, model_id,
     service_type, service_type_ids, subservice_ids, estimated_amount,
     preferred_slot_start, pickup_required, pickup_address, customer_address,
     city, city_id, pincode, workshop_id, coupon_meta`,
    `id, lead_number, customer_name, customer_phone, service_type, service_type_ids,
     estimated_amount, preferred_slot_start, pickup_required, pickup_address,
     city, pincode, workshop_id, coupon_meta`,
  ];

  for (const columns of selects) {
    const { data, error } = await db.from('service_leads').select(columns).eq('id', leadId).maybeSingle();
    if (!error && data) return data;
  }
  return null;
}

/**
 * Force-send WhatsApp after telecaller changes lead services/packages.
 * Use send_booking_confirmed=true only for Booking Confirmed status.
 * Default path never uses booking_confirmed template (update / text only).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const body = await request.json().catch(() => ({}));
    const previousServiceLabel =
      body?.previousServiceLabel != null ? String(body.previousServiceLabel) : null;
    const serviceLabelFromBody = body?.serviceLabel != null ? String(body.serviceLabel) : null;
    const previousServiceIds = Array.isArray(body?.previousServiceIds)
      ? body.previousServiceIds.map(String)
      : [];

    const { data: accessible } = await supabase
      .from('service_leads')
      .select('id')
      .eq('id', leadId)
      .maybeSingle();
    if (!accessible) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = supabaseAdmin ?? supabase;
    const row: any = (await loadLeadRow(db, leadId)) || (await loadLeadRow(supabase, leadId));
    if (!row?.id) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const serviceIds = parseServiceIdList(row.service_type_ids);
    const addonIds = parseServiceIdList(row.subservice_ids);
    const meta = row.coupon_meta && typeof row.coupon_meta === 'object' ? row.coupon_meta : {};

    let vehicleClass = String(meta.vehicle_class || '').trim() || null;
    if (!vehicleClass && row.model_id) {
      try {
        const { data: modelRow } = await db
          .from('car_models')
          .select('class')
          .eq('id', row.model_id)
          .maybeSingle();
        vehicleClass = String(modelRow?.class || '').trim() || null;
      } catch {
        // optional
      }
    }

    let quote: any = null;
    try {
      quote = await buildTelecallerCrmQuote(db, {
        serviceTypeIds: serviceIds,
        addonIds,
        workshopId: row.pickup_required ? null : row.workshop_id || null,
        cityId: row.city_id || null,
        vehicleClass,
        couponCode: row.coupon_code || meta.applied_code || null,
      });
    } catch (e) {
      console.warn('[notify-update] re-quote failed', e);
    }

    let nextLabel =
      serviceLabelFromBody ||
      serviceLabelFromQuote(quote) ||
      (await resolveServiceTypeNames(db, serviceIds)) ||
      String(row.service_type || 'Car Service').replace(/_/g, ' ');

    let prevLabel = previousServiceLabel || '';
    if (!prevLabel && previousServiceIds.length) {
      prevLabel = await resolveServiceTypeNames(db, previousServiceIds);
    }

    const freshAmount = Number(quote?.total ?? quote?.subtotal ?? row.estimated_amount ?? 0) || 0;
    // Sync DB amount if quote differs (so list + WA stay consistent)
    if (quote && Number(row.estimated_amount || 0) !== freshAmount) {
      try {
        await db
          .from('service_leads')
          .update({
            estimated_amount: freshAmount,
            discount_amount: Number(quote.discount || 0) || 0,
            service_type: nextLabel,
            coupon_meta: { ...meta, package_label: nextLabel, last_quote_total: freshAmount },
            updated_at: new Date().toISOString(),
          })
          .eq('id', leadId);
        row.estimated_amount = freshAmount;
        row.service_type = nextLabel;
      } catch (e) {
        console.warn('[notify-update] amount sync failed', e);
      }
    }

    let workshopName = '';
    if (row.workshop_id) {
      const { data: ws } = await db.from('workshops').select('name').eq('id', row.workshop_id).maybeSingle();
      workshopName = String(ws?.name || '').trim();
    }

    const leadForWa = {
      ...row,
      workshop_name: workshopName || null,
      flat_number: meta.flat_number || null,
      landmark: meta.landmark || null,
      address_type: meta.address_type || null,
      estimated_amount: freshAmount,
    };
    const waBody = { coupon_meta: meta, service_type_ids: serviceIds, quote };

    const whatsapp =
      body?.send_booking_confirmed === true
        ? await notifyBookingConfirmedWhatsApp({
            lead: leadForWa,
            customerId: row.customer_id || null,
            serviceLabel: nextLabel,
            amount: freshAmount,
            body: waBody,
          })
        : await notifyBookingUpdatedWhatsApp({
            lead: leadForWa,
            customerId: row.customer_id || null,
            serviceLabel: nextLabel,
            previousServiceLabel: prevLabel || null,
            amount: freshAmount,
            body: waBody,
          });

    return NextResponse.json({
      success: Boolean(whatsapp?.sent),
      estimated_amount: freshAmount,
      service_type: nextLabel,
      quote: quote
        ? { total: quote.total, subtotal: quote.subtotal, discount: quote.discount, line_items: quote.line_items }
        : null,
      whatsapp,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
