import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { notifyBookingConfirmedWhatsApp } from '@/lib/services/bookingConfirmedWhatsApp';
import { toServiceLeadType } from '@/lib/customer-service-leads';
import {
  buildTelecallerCrmQuote,
  resolveServiceTypeNames,
  serviceLabelFromQuote,
} from '@/lib/telecaller/crmQuote';

export const dynamic = 'force-dynamic';

/**
 * POST /api/telecaller/crm/book
 * Advanced telecaller booking: create service_lead + optional pricing snapshot + workshop + WhatsApp confirmation.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const profile = await resolveUserProfile(supabase, user);
    const roleCode = String((profile as any)?.roles?.role_code || '');
    if (roleCode !== 'TELECALLER' && roleCode !== 'SUPER_ADMIN' && roleCode !== 'LEAD_MANAGER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const customerName = String(body?.customer_name || '').trim();
    const customerPhone = String(body?.customer_phone || '').trim();
    if (!customerName || !customerPhone) {
      return NextResponse.json({ error: 'Customer name and phone required' }, { status: 400 });
    }

    const bookingType = String(body?.booking_type || 'CAR_SERVICE').toUpperCase();
    const serviceTypeIds: string[] = Array.isArray(body?.service_type_ids)
      ? body.service_type_ids.map(String)
      : [];
    const addonIds: string[] = Array.isArray(body?.addon_ids) ? body.addon_ids.map(String) : [];
    const workshopId = body?.workshop_id ? String(body.workshop_id) : null;
    const paymentMode = String(body?.payment_mode || 'CASH').toUpperCase();
    const couponCode = String(body?.coupon_code || '').trim().toUpperCase() || null;
    const quote = body?.quote || null;
    const pickupRequired = Boolean(body?.pickup_required);

    // service_leads.lead_type is NOT NULL — map CRM booking type → NORMAL | RSA | HOME_SERVICE
    const leadType = toServiceLeadType(
      String(body?.lead_type || (bookingType === 'RSA' ? 'RSA' : bookingType === 'HOME_SERVICE' ? 'HOME_SERVICE' : 'NORMAL')),
    );

    const leadNumber = `L-${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
    const now = new Date().toISOString();

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = (supabaseAdmin ?? supabase) as any;

    // Prefer client quote; otherwise build server-side so amount/package are never blank
    let resolvedQuote = quote;
    if (
      (!resolvedQuote || !Number(resolvedQuote.total || resolvedQuote.subtotal || 0)) &&
      (serviceTypeIds.length > 0 || addonIds.length > 0)
    ) {
      try {
        resolvedQuote = await buildTelecallerCrmQuote(db, {
          serviceTypeIds,
          addonIds,
          workshopId,
          cityId: body?.city_id || null,
          vehicleClass: body?.vehicle_class || body?.coupon_meta?.vehicle_class || null,
          couponCode,
        });
      } catch (e) {
        console.warn('[telecaller/crm/book] server quote failed', e);
      }
    }

    let serviceLabel = serviceLabelFromQuote(resolvedQuote);
    if (!serviceLabel && serviceTypeIds.length > 0) {
      serviceLabel = await resolveServiceTypeNames(db, serviceTypeIds);
    }
    if (!serviceLabel) {
      const meta = body?.coupon_meta || {};
      serviceLabel = String(
        meta.package_label || meta.membership_plan_name || meta.rsa_service || '',
      ).trim();
    }
    const genericType = new Set(['CAR_SERVICE', 'HOME_SERVICE', 'RSA', 'NORMAL', 'SERVICE', 'CAR SERVICE']);
    const bodyServiceType = String(body?.service_type || '').trim();
    const bodyIsGeneric = !bodyServiceType || genericType.has(bodyServiceType.toUpperCase());
    const labelIsGeneric = !serviceLabel || genericType.has(serviceLabel.toUpperCase());
    const finalServiceType = !labelIsGeneric
      ? serviceLabel
      : !bodyIsGeneric
        ? bodyServiceType
        : bookingType.replace(/_/g, ' ');

    const insert: any = {
      lead_number: leadNumber,
      lead_type: leadType,
      lead_source: String(body?.lead_source || 'TELECALLER').trim() || 'TELECALLER',
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_alternate_phone: body?.customer_alternate_phone || null,
      customer_email: body?.customer_email || null,
      customer_address: body?.customer_address || null,
      city_id: body?.city_id || null,
      city: body?.city || null,
      pincode: body?.pincode || null,
      vehicle_number: body?.vehicle_number || null,
      vehicle_make: body?.vehicle_make || null,
      model_id: body?.model_id || null,
      vehicle_model: body?.vehicle_model || null,
      vehicle_variant: body?.vehicle_variant || null,
      vehicle_year: body?.vehicle_year || null,
      vehicle_fuel_type: body?.vehicle_fuel_type || null,
      odometer_km: body?.odometer_km || null,
      service_type_ids: JSON.stringify(serviceTypeIds),
      subservice_ids: JSON.stringify(addonIds),
      service_type: finalServiceType,
      problem_description: body?.problem_description || null,
      description: body?.description || `Telecaller booking (${bookingType})`,
      pickup_required: pickupRequired,
      pickup_address: body?.pickup_address || null,
      preferred_slot_start: body?.preferred_slot_start || null,
      preferred_slot_end: body?.preferred_slot_end || null,
      payment_mode: paymentMode,
      coupon_code: couponCode,
      discount_amount: Number(resolvedQuote?.discount || 0) || 0,
      estimated_amount: Number(resolvedQuote?.total || resolvedQuote?.subtotal || 0) || 0,
      coupon_meta: {
        ...(typeof body?.coupon_meta === 'object' && body.coupon_meta ? body.coupon_meta : {}),
        booking_type: bookingType,
        package_label: finalServiceType,
        ...(couponCode ? { selected_codes: [couponCode], applied_code: couponCode } : {}),
      },
      workshop_id: workshopId,
      status: workshopId ? 'ASSIGNED' : 'NEW',
      lead_priority: body?.lead_priority || 'NORMAL',
      created_from: 'TELECALLER_CRM',
      created_by_id: profile?.id || null,
      assigned_telecaller_id: profile?.id || null,
      is_incomplete: false,
      created_at: now,
      updated_at: now,
    };

    const { data: lead, error } = await db
      .from('service_leads')
      .insert([insert])
      .select(
        'id, lead_number, status, customer_name, customer_phone, vehicle_number, vehicle_make, vehicle_model, service_type, preferred_slot_start, pickup_required, pickup_address, customer_address, city, pincode, estimated_amount, payment_mode, workshop_id',
      )
      .single();

    if (error || !lead) {
      return NextResponse.json({ error: error?.message || 'Failed to create booking' }, { status: 400 });
    }

    if (resolvedQuote?.line_items && Array.isArray(resolvedQuote.line_items) && resolvedQuote.line_items.length > 0) {
      try {
        const rows = resolvedQuote.line_items.map((item: any) => ({
          lead_id: lead.id,
          item_type: item.kind === 'addon' ? 'ADDON' : 'SERVICE',
          item_id: item.id,
          item_name: item.name,
          unit_price: Number(item.price || 0),
          quantity: 1,
          total_price: Number(item.price || 0),
          created_at: now,
        }));
        await db.from('lead_pricing_items').insert(rows);
      } catch (e) {
        console.warn('lead_pricing_items insert skipped', e);
      }
    }

    // Keep serviceLabel for WhatsApp (already resolved)
    serviceLabel = finalServiceType;

    let workshopName = String(body?.workshop_name || '').trim();
    if (!workshopName && workshopId) {
      try {
        const { data: ws } = await db.from('workshops').select('name').eq('id', workshopId).maybeSingle();
        workshopName = String(ws?.name || '').trim();
      } catch {
        // optional
      }
    }

    try {
      await db.from('telecaller_call_logs').insert([
        {
          lead_id: lead.id,
          telecaller_id: profile?.id,
          call_type: 'OUTBOUND',
          call_status: 'ANSWERED',
          outcome: 'LEAD_CREATED',
          notes: `Advanced CRM booking: ${bookingType}`,
          phone_number: customerPhone,
          created_at: now,
        },
      ]);
    } catch {
      // optional
    }

    try {
      await db.from('lead_events').insert([
        {
          lead_id: lead.id,
          event_type: 'CREATED',
          event_data: { source: 'TELECALLER_CRM', booking_type: bookingType, quote: resolvedQuote },
          created_by_id: profile?.id,
          created_at: now,
        },
      ]);
    } catch {
      // optional
    }

    let whatsapp: any = null;
    try {
      whatsapp = await notifyBookingConfirmedWhatsApp({
        lead: {
          ...lead,
          workshop_name: workshopName || null,
          pickup_required: pickupRequired,
          pickup_address: body?.pickup_address || lead.pickup_address,
          customer_address: body?.customer_address || lead.customer_address,
          city: body?.city || lead.city,
          pincode: body?.pincode || lead.pincode,
          flat_number: body?.flat_number || body?.coupon_meta?.flat_number || null,
          landmark: body?.landmark || body?.coupon_meta?.landmark || null,
          address_type: body?.address_type || body?.coupon_meta?.address_type || null,
          estimated_amount: Number(resolvedQuote?.total || lead.estimated_amount || 0) || 0,
          payment_mode: paymentMode,
        },
        serviceLabel: serviceLabel || null,
        amount: Number(resolvedQuote?.total || 0) || null,
        body: {
          ...body,
          quote: resolvedQuote,
          service_type_ids: serviceTypeIds,
        },
      });
      if (whatsapp?.skipped || !whatsapp?.sent) {
        console.log('[telecaller/crm/book] WhatsApp skipped:', whatsapp?.skipReason || whatsapp?.error);
      }
    } catch (whatsappErr: any) {
      console.error('[telecaller/crm/book] WhatsApp failed:', whatsappErr?.message || whatsappErr);
    }

    return NextResponse.json(
      {
        success: true,
        lead,
        whatsapp,
        message: 'Booking created successfully',
      },
      { status: 201 },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Book failed' }, { status: 500 });
  }
}
