import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { validateCouponForCheckout, redeemCouponAtomic } from '@/lib/coupon-service';
import { LEAD_SOURCES, normalizeLeadSource } from '@/lib/enquiry/createLead';

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


async function resolveServiceNames(supabaseAdmin: any, serviceTypeIds: string[]): Promise<string[]> {
  if (!serviceTypeIds.length) return [];
  try {
    const { data } = await supabaseAdmin
      .from('service_types')
      .select('id, name')
      .in('id', serviceTypeIds);
    if (!data || !data.length) return [];
    const nameMap = new Map((data as any[]).map((r: any) => [r.id, r.name]));
    return serviceTypeIds.map((id) => nameMap.get(id) || id);
  } catch {
    return serviceTypeIds;
  }
}

async function pushLeadToExternalApi(leadRow: Record<string, any>, supabaseAdmin: any) {
  const phoneDigits = String(leadRow.customer_phone || '').replace(/\D/g, '').slice(-10);
  if (!phoneDigits) return;

  const serviceTypeIds = Array.isArray(leadRow.service_type_ids) ? leadRow.service_type_ids : [];
  const serviceNames = await resolveServiceNames(supabaseAdmin, serviceTypeIds);
  const payload = {
    fields: {
      Name: String(leadRow.customer_name || '').trim() || 'Website Lead',
      Phone: `+91${phoneDigits}`,
      LEADTAG: 'WEBSITE',
      LeadSource: 'delhi_service',
      LeadStatus: leadRow.status || 'NEW',
      LeadNumber: leadRow.lead_number || null,
      Status: leadRow.status || 'NEW',
      City: leadRow.city || null,
      ServiceType: serviceNames.length > 0 ? serviceNames.join(', ') : null,
      Services: serviceNames.length > 0 ? serviceNames.join(', ') : null,
      Vehicle: [leadRow.vehicle_make, leadRow.vehicle_model, leadRow.vehicle_variant].filter(Boolean).join(' ') || null,
      VehicleNumber: leadRow.vehicle_number || null,
      VehicleNo: leadRow.vehicle_number || null,
      VehicleModel: [leadRow.vehicle_make, leadRow.vehicle_model].filter(Boolean).join(' ') || null,
      EstimatedAmount: leadRow.estimated_amount != null ? String(leadRow.estimated_amount) : null,
      PickupRequired: typeof leadRow.pickup_required === 'boolean' ? String(leadRow.pickup_required) : null,
      PickupAddress: leadRow.pickup_address || null,
      PreferredSlot: leadRow.preferred_slot_start || null,
      PaymentMode: leadRow.payment_mode || null,
      PaymentStatus: leadRow.payment_status || null,
      CouponCode: leadRow.coupon_code || null,
      DiscountAmount: leadRow.discount_amount != null ? String(leadRow.discount_amount) : null,
      CreatedFrom: 'WEB',
      CreatedAt: new Date().toISOString(),
    },
    actions: [
      {
        type: 'SYSTEM_NOTE',
        text: 'Lead Source: WEBSITE',
      },
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
  const responseBody = await res.text().catch(() => '');

  if (!res.ok) {
    throw new Error(`External API failed: ${res.status} ${responseBody || ''}`.trim());
  }

  if (responseBody) {
    console.info('[bookings/create] TeleCRM sync response:', responseBody);
  }
}

// When a registered customer books, persist the booked vehicle into their
// profile garage (customer_vehicles) so it shows up as a saved vehicle later.
async function saveVehicleToProfile(supabaseAdmin: any, lead: Record<string, any>, customerPhone: string) {
  try {
    const vehicleNumber = String(lead?.vehicle_number || '').trim().toUpperCase();
    const make = String(lead?.vehicle_make || '').trim();
    const model = String(lead?.vehicle_model || '').trim();
    // Need at least a make/model; skip placeholder "NA" plates with no vehicle info.
    if (!make && !model) return;

    // Find the customer account by phone (last-10-digit match).
    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('id')
      .ilike('phone', `%${customerPhone}`)
      .maybeSingle();
    if (!customer?.id) return; // not a registered customer — nothing to save

    const plate = vehicleNumber && vehicleNumber !== 'NA' ? vehicleNumber : `${make}-${model}`.toUpperCase();

    const payload: Record<string, any> = {
      customer_id: customer.id,
      vehicle_number: plate,
      make: make || null,
      model: model || null,
      variant: lead?.vehicle_variant || null,
      fuel_type: lead?.fuel_type || null,
      updated_at: new Date().toISOString(),
    };

    await supabaseAdmin
      .from('customer_vehicles')
      .upsert(payload, { onConflict: 'customer_id,vehicle_number' });
  } catch (err) {
    console.error('[bookings/create] saveVehicleToProfile failed:', err);
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
    const isMobileClient = request.headers.get('x-mobile-client') === 'true';
    const leadSource = normalizeLeadSource(lead?.lead_source, { isMobileClient });
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
      const channel = String(body?.coupon?.lead_context?.channel || (request.headers.get('x-mobile-client') ? 'MOBILE' : 'WEB')).toUpperCase();
      const subtotal = Number(body?.coupon?.lead_context?.subtotal || lead?.estimated_amount || 0);
      const couponResult = await validateCouponForCheckout(
        supabaseAdmin,
        String(body.coupon.code || ''),
        {
          ...(body.coupon.lead_context || {}),
          subtotal,
          customer_phone: body?.coupon?.lead_context?.customer_phone || customerPhone,
          channel,
        },
        { serviceBooking: true },
      );

      if (!couponResult.valid) {
        return NextResponse.json({ error: couponResult.error }, { status: 400 });
      }

      couponCode = String(couponResult.coupon.code || '');
      discountAmount = couponResult.discountAmount;
      couponMeta = couponResult.couponMeta;
    }

    const serviceLeadPayload = {
      ...lead,
      lead_number: leadNumber,
      lead_type: serviceLeadType,
      lead_source: leadSource,
      created_from: lead?.created_from || (isMobileClient ? 'MOBILE_APP' : 'WEB'),
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
      const redeemed = await redeemCouponAtomic(supabaseAdmin, {
        couponId: String(couponMeta.coupon_id),
        customerPhone,
        discountAmount,
        appliedByRole: 'CUSTOMER',
        serviceLeadId: serviceLead?.id || null,
        idempotencyKey: serviceLead?.id ? `lead:${serviceLead.id}` : null,
        meta: {
          lead_source: leadSource,
          channel: body?.coupon?.lead_context?.channel || (request.headers.get('x-mobile-client') ? 'MOBILE' : 'WEB'),
          customer_name: customerName,
          lead_number: leadNumber,
        },
      });
      if (!redeemed.success) {
        console.error('[bookings/create] coupon redemption failed:', redeemed.error);
      }
    }

    // Persist booked vehicle to the customer's profile garage (if registered).
    await saveVehicleToProfile(supabaseAdmin, serviceLead as Record<string, any>, customerPhone);

    // Fire external lead sync after successful lead creation.
    try {
      await pushLeadToExternalApi(serviceLead as Record<string, any>, supabaseAdmin);
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
