import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { LEAD_SOURCES } from '@/lib/enquiry/createLead';

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

const EXTERNAL_AUTOUPDATE_URL =
  'https://022os10kr2.execute-api.ap-south-1.amazonaws.com/enterprise/66f6bc6faf29b5a6f29c9bbf/autoupdatelead';
const EXTERNAL_AUTOUPDATE_BEARER =
  '398fc0c7-ee90-4992-b214-4063f9f7ad031727771960659:e9580bb4-cb6f-47ff-81fb-847e5a98a5a2';

async function pushLeadToExternalApi(leadRow: Record<string, any>) {
  const phoneDigits = String(leadRow.customer_phone || '').replace(/\D/g, '').slice(-10);
  const serviceTypeIds = Array.isArray(leadRow.service_type_ids) ? leadRow.service_type_ids : [];
  const meta = (leadRow?.meta && typeof leadRow.meta === 'object') ? leadRow.meta : {};
  const utm = {
    source: typeof meta?.utm_source === 'string' ? meta.utm_source.trim() : '',
    medium: typeof meta?.utm_medium === 'string' ? meta.utm_medium.trim() : '',
    campaign: typeof meta?.utm_campaign === 'string' ? meta.utm_campaign.trim() : '',
    term: typeof meta?.utm_term === 'string' ? meta.utm_term.trim() : '',
    content: typeof meta?.utm_content === 'string' ? meta.utm_content.trim() : '',
  };
  const utmNoteLines = [
    utm.source ? `utm_source: ${utm.source}` : null,
    utm.medium ? `utm_medium: ${utm.medium}` : null,
    utm.campaign ? `utm_campaign: ${utm.campaign}` : null,
    utm.term ? `utm_term: ${utm.term}` : null,
    utm.content ? `utm_content: ${utm.content}` : null,
  ].filter(Boolean) as string[];
  const utmSystemNote = utmNoteLines.length > 0 ? `UTM Details\n${utmNoteLines.join('\n')}` : null;

  const payload = {
    fields: {
      // Core contact
      Name: String(leadRow.customer_name || '').trim() || 'Website Lead',
      Phone: phoneDigits ? `+91${phoneDigits}` : null,
      Email: leadRow.customer_email || null,

      // Lead identifiers
      LEADTAG: 'Website',
      LeadSource: leadRow.lead_source || 'Website',
      LeadNumber: leadRow.lead_number || null,
      LeadType: leadRow.lead_type || null,
      LeadStatus: leadRow.status || null,

      // Vehicle/service
      carModel: String(leadRow.vehicle_model || '').trim() || null,
      VehicleMake: leadRow.vehicle_make || null,
      VehicleModel: leadRow.vehicle_model || null,
      VehicleVariant: leadRow.vehicle_variant || null,
      VehicleNumber: leadRow.vehicle_number || null,
      ServiceType: leadRow.service_type || null,
      ServiceTypeIds: serviceTypeIds,

      // Location/schedule
      City: leadRow.city || null,
      State: leadRow.state || null,
      Pincode: leadRow.pincode || null,
      Address: leadRow.address || leadRow.customer_address || null,
      PickupRequired: typeof leadRow.pickup_required === 'boolean' ? leadRow.pickup_required : null,
      PickupAddress: leadRow.pickup_address || null,
      PreferredSlotStart: leadRow.preferred_slot_start || null,

      // Commercial
      EstimatedAmount: leadRow.estimated_amount ?? null,
      PaymentMode: leadRow.payment_mode || null,
      PaymentStatus: leadRow.payment_status || null,
      CouponCode: leadRow.coupon_code || null,
      DiscountAmount: leadRow.discount_amount ?? null,

      // Metadata
      CreatedFrom: leadRow.created_from || 'WEB',
      CreatedAt: leadRow.created_at || null,
      utm_source: utm.source || null,
      utm_medium: utm.medium || null,
      utm_campaign: utm.campaign || null,
      utm_term: utm.term || null,
      utm_content: utm.content || null,
    },
    actions: [
      {
        type: 'SYSTEM_NOTE',
        text: 'Lead Source: delhi_service',
      },
      ...(utmSystemNote
        ? [
            {
              type: 'SYSTEM_NOTE',
              text: utmSystemNote,
            },
          ]
        : []),
    ],
  };

  const res = await fetch(EXTERNAL_AUTOUPDATE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${EXTERNAL_AUTOUPDATE_BEARER}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`External API failed: ${res.status} ${body || ''}`.trim());
  }
}

function toServiceLeadType(input: string) {
  const raw = String(input || '').trim().toUpperCase();
  if (raw === 'CAR_SERVICE') return 'NORMAL';
  if (raw === 'HOME_CAR_SERVICE') return 'HOME_SERVICE';
  if (raw === 'RSA') return 'RSA';
  if (raw === 'NORMAL') return 'NORMAL';
  if (raw === 'HOME_SERVICE') return 'HOME_SERVICE';
  return null;
}

function toEnquiryLeadType(input: string) {
  const raw = String(input || '').trim().toUpperCase();
  if (raw === 'CAR_SERVICE') return 'CAR_SERVICE';
  if (raw === 'HOME_CAR_SERVICE') return 'HOME_CAR_SERVICE';
  if (raw === 'RSA') return 'RSA';
  if (raw === 'NORMAL') return 'CAR_SERVICE';
  if (raw === 'HOME_SERVICE') return 'HOME_CAR_SERVICE';
  return null;
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

    const serviceLeadType = toServiceLeadType(String(lead?.lead_type || 'NORMAL'));
    const enquiryLeadType = toEnquiryLeadType(String(lead?.lead_type || 'NORMAL'));
    const leadSource = String(lead?.lead_source || 'Website').trim();
    if (!serviceLeadType || !enquiryLeadType) {
      return NextResponse.json({ error: 'Invalid lead_type' }, { status: 400 });
    }
    if (!LEAD_SOURCES.includes(leadSource as any)) {
      return NextResponse.json({ error: 'Invalid lead_source' }, { status: 400 });
    }

    const customerPhone = normalizePhone(lead?.customer_phone || null);
    if (!customerPhone) {
      return NextResponse.json({ error: 'customer_phone is required' }, { status: 400 });
    }
    const customerName = String(lead?.customer_name || '').trim() || `Customer_${customerPhone.slice(-4)}`;
    const vehicleNumber = String(lead?.vehicle_number || '').trim().toUpperCase() || 'NA';
    const serviceType =
      String(
        lead?.service_type ||
          (Array.isArray(lead?.service_type_ids) && lead.service_type_ids.length > 0 ? 'CAR_SERVICE' : '') ||
          lead?.problem_description ||
          'CAR_SERVICE'
      )
        .trim()
        .slice(0, 100) || 'CAR_SERVICE';

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

    const serviceLeadPayload = {
      ...lead,
      lead_number: leadNumber,
      lead_type: serviceLeadType,
      lead_source: leadSource,
      status: lead?.status || 'NEW',
      customer_name: customerName,
      customer_phone: customerPhone,
      vehicle_number: vehicleNumber,
      service_type: serviceType,
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

    // Fire external lead sync after successful lead creation.
    try {
      await pushLeadToExternalApi(serviceLead as Record<string, any>);
    } catch (err) {
      console.error('[bookings/create] external sync failed:', err);
    }

    return NextResponse.json(
      {
        success: true,
        lead: serviceLead,
        coupon: couponMeta,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
