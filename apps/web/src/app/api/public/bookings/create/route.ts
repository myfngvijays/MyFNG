import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { LEAD_SOURCES, LEAD_TYPES } from '@/lib/enquiry/createLead';
import { pickTelecallerWeightedRoundRobin } from '@/lib/enquiry/assignment';

type BookingPayload = {
  lead?: Record<string, any>;
  coupon?: {
    code?: string;
    lead_context?: {
      subtotal?: number;
      service_type_ids?: string[];
      subservice_ids?: string[];
      custom_labels?: string[];
      service_items?: Array<{
        service_type_id?: string | null;
        subservice_id?: string | null;
        label?: string | null;
        price?: number | null;
      }>;
      customer_phone?: string | null;
    };
  };
};

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function normalizePhone(phone: string | null | undefined) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '').slice(-10);
  return digits || null;
}

function generateLeadNumber() {
  return `L-${Date.now().toString().slice(-8)}`;
}

function findFreeServicePrice(
  coupon: any,
  context: BookingPayload['coupon'] extends infer C
    ? C extends { lead_context?: infer L }
      ? L
      : any
    : any
) {
  const serviceTypeIds = new Set((context as any)?.service_type_ids || []);
  const subserviceIds = new Set((context as any)?.subservice_ids || []);
  const customLabels = new Set(
    ((context as any)?.custom_labels || []).map((l: string) => String(l).toLowerCase())
  );
  const items = (context as any)?.service_items || [];

  const targetServiceTypeId = coupon?.target_service_type_id || null;
  const targetSubserviceId = coupon?.target_subservice_id || null;
  const targetCustomLabel = coupon?.target_custom_label || null;

  let matched = false;
  let price = 0;
  let matchLabel: string | null = null;

  if (targetServiceTypeId && serviceTypeIds.has(targetServiceTypeId)) matched = true;
  if (targetSubserviceId && subserviceIds.has(targetSubserviceId)) matched = true;
  if (targetCustomLabel && customLabels.has(String(targetCustomLabel).toLowerCase())) {
    matched = true;
    matchLabel = targetCustomLabel;
  }

  if (!matched) {
    return { matched: false, price: 0, matchLabel };
  }

  for (const item of items) {
    if (targetServiceTypeId && item.service_type_id === targetServiceTypeId) {
      price = Number(item.price || 0);
      matchLabel = item.label || matchLabel;
      break;
    }
    if (targetSubserviceId && item.subservice_id === targetSubserviceId) {
      price = Number(item.price || 0);
      matchLabel = item.label || matchLabel;
      break;
    }
    if (targetCustomLabel && item.label && String(item.label).toLowerCase() === String(targetCustomLabel).toLowerCase()) {
      price = Number(item.price || 0);
      matchLabel = item.label || matchLabel;
      break;
    }
  }

  return { matched: true, price, matchLabel };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as BookingPayload;
    const lead = body?.lead || {};

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const leadType = String(lead?.lead_type || 'CAR_SERVICE').trim();
    const leadSource = String(lead?.lead_source || 'Website').trim();
    if (!LEAD_TYPES.includes(leadType as any)) {
      return NextResponse.json({ error: 'Invalid lead_type' }, { status: 400 });
    }
    if (!LEAD_SOURCES.includes(leadSource as any)) {
      return NextResponse.json({ error: 'Invalid lead_source' }, { status: 400 });
    }

    const customerPhone = normalizePhone(lead?.customer_phone || null);
    if (!customerPhone) {
      return NextResponse.json({ error: 'customer_phone is required' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const leadNumber = String(lead?.lead_number || generateLeadNumber());

    let couponCode: string | null = null;
    let discountAmount = 0;
    let couponMeta: any = null;

    if (body?.coupon?.code) {
      const code = normalizeCode(String(body.coupon.code || ''));
      const { data: coupon, error } = await supabaseAdmin
        .from('coupons')
        .select('*')
        .ilike('code', code)
        .eq('is_active', true)
        .maybeSingle();

      if (!coupon || error) {
        return NextResponse.json({ error: 'Invalid or inactive coupon.' }, { status: 400 });
      }

      if (coupon.start_at && String(coupon.start_at) > nowIso) {
        return NextResponse.json({ error: 'Coupon is not active yet.' }, { status: 400 });
      }
      if (coupon.end_at && String(coupon.end_at) < nowIso) {
        return NextResponse.json({ error: 'Coupon has expired.' }, { status: 400 });
      }

      const subtotal = Number(body?.coupon?.lead_context?.subtotal || lead?.estimated_amount || 0);
      if (coupon.min_order_value && subtotal < Number(coupon.min_order_value || 0)) {
        return NextResponse.json(
          { error: `Minimum order value is ₹${coupon.min_order_value}.` },
          { status: 400 }
        );
      }

      if (coupon.usage_limit_total) {
        const { count } = await supabaseAdmin
          .from('coupon_redemptions')
          .select('id', { count: 'exact', head: true })
          .eq('coupon_id', coupon.id);
        if ((count || 0) >= Number(coupon.usage_limit_total || 0)) {
          return NextResponse.json({ error: 'Coupon usage limit reached.' }, { status: 400 });
        }
      }

      if (coupon.usage_limit_per_customer) {
        const phone = normalizePhone(body?.coupon?.lead_context?.customer_phone || customerPhone);
        if (phone) {
          const { count } = await supabaseAdmin
            .from('coupon_redemptions')
            .select('id', { count: 'exact', head: true })
            .eq('coupon_id', coupon.id)
            .contains('meta', { customer_phone: phone });
          if ((count || 0) >= Number(coupon.usage_limit_per_customer || 0)) {
            return NextResponse.json({ error: 'Coupon already used by customer.' }, { status: 400 });
          }
        }
      }

      let freeServiceMeta: any = null;
      if (coupon.coupon_kind === 'TOTAL_DISCOUNT') {
        if (!coupon.discount_mode || !coupon.discount_value || subtotal <= 0) {
          return NextResponse.json({ error: 'Invalid discount configuration.' }, { status: 400 });
        }
        if (coupon.discount_mode === 'AMOUNT') {
          discountAmount = Math.min(Number(coupon.discount_value || 0), subtotal);
        } else if (coupon.discount_mode === 'PERCENT') {
          discountAmount = (subtotal * Number(coupon.discount_value || 0)) / 100;
        }
      } else if (coupon.coupon_kind === 'FREE_SERVICE') {
        const freeService = findFreeServicePrice(coupon, body?.coupon?.lead_context);
        if (!freeService.matched) {
          return NextResponse.json(
            { error: 'Coupon is not applicable to selected services.' },
            { status: 400 }
          );
        }
        discountAmount = Math.max(0, Number(freeService.price || 0));
        freeServiceMeta = {
          target_service_type_id: coupon.target_service_type_id || null,
          target_subservice_id: coupon.target_subservice_id || null,
          target_custom_label: coupon.target_custom_label || null,
          matched_label: freeService.matchLabel || null,
          original_price: freeService.price || 0,
        };
      }

      couponCode = coupon.code;
      couponMeta = {
        coupon_id: coupon.id,
        code: coupon.code,
        coupon_kind: coupon.coupon_kind,
        discount_mode: coupon.discount_mode,
        discount_value: coupon.discount_value,
        min_order_value: coupon.min_order_value,
        discount_amount: Number(discountAmount || 0),
        computed_on_subtotal: Number(body?.coupon?.lead_context?.subtotal || 0),
        free_service: freeServiceMeta,
        validated_at: nowIso,
      };
    }

    const { telecallerId, reason } = await pickTelecallerWeightedRoundRobin();
    const assignedAt = telecallerId ? nowIso : null;
    const leadStatus = telecallerId ? 'ASSIGNED' : 'NEW';

    const serviceLeadPayload = {
      ...lead,
      lead_number: leadNumber,
      lead_type: leadType,
      lead_source: leadSource,
      status: lead?.status || 'NEW',
      customer_phone: customerPhone,
      coupon_code: couponCode,
      discount_amount: discountAmount,
      coupon_meta: couponMeta,
      created_at: lead?.created_at || nowIso,
    };

    const { data: serviceLead, error: leadError } = await supabaseAdmin
      .from('service_leads')
      .insert([serviceLeadPayload])
      .select()
      .single();

    if (leadError) {
      return NextResponse.json({ error: leadError.message }, { status: 500 });
    }

    const history: any[] = [{ type: 'CREATED', at: nowIso, lead_type: leadType, lead_source: leadSource }];
    if (telecallerId) {
      history.push({ type: 'ASSIGNED', at: nowIso, mode: 'AUTO', telecaller_id: telecallerId });
    } else if (reason) {
      history.push({ type: 'ASSIGNMENT_SKIPPED', at: nowIso, reason });
    }

    const enquiryPayload = {
      kind: 'LEAD',
      lead_number: leadNumber,
      lead_type: leadType,
      lead_status: leadStatus,
      lead_priority: String(lead?.lead_priority || 'NORMAL').toUpperCase(),
      lead_source: leadSource,
      lead_source_other_note: lead?.lead_source_other_note || null,

      customer_name: lead?.customer_name || null,
      customer_phone: customerPhone,
      customer_alt_phone: lead?.customer_alt_phone || null,
      customer_email: lead?.customer_email || null,
      customer_address: lead?.customer_address || null,
      customer_city: lead?.customer_city || lead?.city || null,
      customer_pincode: lead?.customer_pincode || null,
      customer_lat: lead?.customer_lat || null,
      customer_lng: lead?.customer_lng || null,

      vehicle_number: lead?.vehicle_number || null,
      vehicle_make: lead?.vehicle_make || null,
      vehicle_model: lead?.vehicle_model || null,
      vehicle_variant: lead?.vehicle_variant || null,
      vehicle_fuel_type: lead?.vehicle_fuel_type || null,

      problem_description: lead?.problem_description || null,
      pickup_required: Boolean(lead?.pickup_required),
      preferred_slot_start: lead?.preferred_slot_start || null,
      preferred_slot_end: lead?.preferred_slot_end || null,

      assigned_telecaller_id: telecallerId,
      assigned_at: assignedAt,
      assignment_mode: 'AUTO',
      history,
      meta: {
        ...(reason ? { assignment_error: reason } : {}),
        service_lead_id: serviceLead?.id || null,
        coupon: couponMeta || null,
      },
      created_at: nowIso,
      updated_at: nowIso,
    };

    const { data: enquiryLead, error: enquiryError } = await supabaseAdmin
      .from('enquiry_hub')
      .insert(enquiryPayload)
      .select()
      .single();

    if (enquiryError) {
      return NextResponse.json({ error: enquiryError.message }, { status: 500 });
    }

    if (couponMeta?.coupon_id) {
      await supabaseAdmin.from('coupon_redemptions').insert({
        coupon_id: couponMeta.coupon_id,
        service_lead_id: serviceLead?.id || null,
        applied_by_role: 'CUSTOMER',
        applied_by_user_id: null,
        discount_amount_applied: discountAmount,
        meta: {
          customer_phone: customerPhone,
          lead_source: leadSource,
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        lead: serviceLead,
        enquiry: enquiryLead,
        coupon: couponMeta,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
