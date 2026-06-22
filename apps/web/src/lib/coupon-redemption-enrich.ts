import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePhone } from './coupon-rules';
import { resolveBookingSource } from './booking-lead-utils';

/** Safe select — no embedded joins that can break if FK/column missing */
export const COUPON_REDEMPTION_SELECT = `
  id, coupon_id, service_lead_id, invoice_id, applied_by_role, discount_amount_applied, meta, created_at,
  coupon:coupons(code)
`;

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatChannelLabel(raw: unknown) {
  const value = String(raw || '').trim();
  if (!value) return null;
  const upper = value.toUpperCase();
  if (upper === 'MOBILE' || upper === 'ANDROID' || upper === 'IOS' || upper === 'MOBILE_APP') {
    return 'Mobile App';
  }
  if (upper === 'WEB' || upper === 'WEBSITE') return 'Website';
  if (upper === 'MEMBERSHIP') return 'Membership';
  return value;
}

function parseIdList(input: unknown): string[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((v) => String(v || '').trim()).filter(Boolean);
  const raw = String(input || '').trim();
  if (!raw) return [];
  try {
    if (raw.startsWith('[') && raw.endsWith(']')) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v || '').trim()).filter(Boolean);
    }
  } catch {
    // ignore
  }
  return raw.split(',').map((v) => v.trim()).filter(Boolean);
}

function formatVehicleLine(lead: Record<string, any> | null | undefined, meta: Record<string, any> = {}) {
  const number = String(lead?.vehicle_number || meta?.vehicle_number || '').trim().toUpperCase();
  const make = String(lead?.vehicle_make || meta?.vehicle_make || meta?.make || '').trim();
  const model = String(lead?.vehicle_model || meta?.vehicle_model || meta?.model || '').trim();
  const year = lead?.vehicle_year || meta?.vehicle_year || meta?.year || null;
  const label = [make, model, year ? String(year) : ''].filter(Boolean).join(' ').trim();

  if (number && label) return `${number} · ${label}`;
  if (number) return number;
  if (label) return label;
  return null;
}

function resolveServiceLabel(
  lead: Record<string, any> | null | undefined,
  meta: Record<string, any>,
  serviceNameById: Map<string, string>,
) {
  if (String(meta?.type || '').toLowerCase() === 'membership') {
    const planName = String(meta?.plan_name || meta?.membership_plan || '').trim();
    return planName ? `${planName} Membership` : 'Membership Purchase';
  }

  const fromMeta = String(meta?.service_type || meta?.service_name || meta?.service || '').trim();
  if (fromMeta && !UUID_LIKE.test(fromMeta)) return fromMeta;

  const ids = [
    ...parseIdList(lead?.service_type_ids),
    ...parseIdList(lead?.subservice_ids),
  ].filter((id) => UUID_LIKE.test(id));

  const namesFromIds = ids
    .map((id) => serviceNameById.get(id))
    .filter(Boolean) as string[];
  if (namesFromIds.length) return namesFromIds.join(', ');

  const legacy = String(lead?.service_type || fromMeta || '').trim();
  if (legacy && UUID_LIKE.test(legacy)) {
    return serviceNameById.get(legacy) || legacy;
  }
  return legacy || null;
}

export type CouponRedemptionCustomerDisplay = {
  name: string | null;
  phone: string | null;
  email: string | null;
  lead_number: string | null;
  channel: string | null;
};

export type CouponRedemptionBookingDisplay = {
  service: string | null;
  vehicle_number: string | null;
  vehicle: string | null;
  city: string | null;
  lead_status: string | null;
};

export function getRedemptionBookingDisplay(row: any): CouponRedemptionBookingDisplay {
  if (row?.booking_display) return row.booking_display;

  const meta = row?.meta && typeof row.meta === 'object' ? row.meta : {};
  const lead = row?.service_lead || null;

  return {
    service: resolveServiceLabel(lead, meta, new Map()),
    vehicle_number: String(lead?.vehicle_number || meta?.vehicle_number || '').trim().toUpperCase() || null,
    vehicle: formatVehicleLine(lead, meta),
    city: String(lead?.city || meta?.city || '').trim() || null,
    lead_status: String(lead?.status || meta?.lead_status || '').trim() || null,
  };
}

export function getRedemptionCustomerDisplay(row: any): CouponRedemptionCustomerDisplay {
  if (row?.customer_display) return row.customer_display;

  const meta = row?.meta || {};
  const lead = row?.service_lead || null;

  return {
    name: lead?.customer_name || meta?.customer_name || null,
    phone: lead?.customer_phone || meta?.customer_phone || null,
    email: lead?.customer_email || meta?.customer_email || null,
    lead_number: lead?.lead_number || meta?.lead_number || null,
    channel: meta?.channel || meta?.type || null,
  };
}

export async function enrichCouponRedemptions(
  supabaseAdmin: SupabaseClient,
  rows: any[],
): Promise<any[]> {
  if (!rows?.length) return [];

  const leadIds = [...new Set(rows.map((r) => r.service_lead_id).filter(Boolean))];
  const leadById = new Map<string, Record<string, unknown>>();
  const leadNumbersToLookup = new Set<string>();

  for (const row of rows) {
    const meta = row.meta && typeof row.meta === 'object' ? row.meta : {};
    const leadNumber = String(meta.lead_number || '').trim();
    if (!row.service_lead_id && leadNumber) {
      leadNumbersToLookup.add(leadNumber);
    }
  }

  const selectLeadFields =
    'id, lead_number, customer_name, customer_phone, customer_email, service_type, service_type_ids, subservice_ids, vehicle_number, vehicle_make, vehicle_model, vehicle_year, city, status, lead_source, created_from';

  if (leadIds.length > 0) {
    let { data: leads, error } = await supabaseAdmin
      .from('service_leads')
      .select(selectLeadFields)
      .in('id', leadIds);

    if (error) {
      ({ data: leads } = await supabaseAdmin
        .from('service_leads')
        .select('id, lead_number, customer_name, customer_phone, customer_email, service_type, vehicle_number, vehicle_make, vehicle_model, city, status, lead_source')
        .in('id', leadIds));
    }

    for (const lead of leads || []) {
      leadById.set(String(lead.id), lead);
    }
  }

  const leadByNumber = new Map<string, Record<string, unknown>>();
  if (leadNumbersToLookup.size > 0) {
    const { data: leadsByNumber } = await supabaseAdmin
      .from('service_leads')
      .select(selectLeadFields)
      .in('lead_number', [...leadNumbersToLookup]);

    for (const lead of leadsByNumber || []) {
      leadByNumber.set(String(lead.lead_number), lead);
    }
  }

  const serviceTypeIds = new Set<string>();
  for (const lead of [...leadById.values(), ...leadByNumber.values()]) {
    for (const id of [...parseIdList(lead.service_type_ids), ...parseIdList(lead.subservice_ids)]) {
      if (UUID_LIKE.test(id)) serviceTypeIds.add(id);
    }
    const legacy = String(lead.service_type || '').trim();
    if (UUID_LIKE.test(legacy)) serviceTypeIds.add(legacy);
  }

  const serviceNameById = new Map<string, string>();
  if (serviceTypeIds.size > 0) {
    const { data: serviceTypes } = await supabaseAdmin
      .from('service_types')
      .select('id, name')
      .in('id', [...serviceTypeIds]);
    for (const row of serviceTypes || []) {
      serviceNameById.set(String(row.id), String(row.name || row.id));
    }
  }

  const rowsWithLeads = rows.map((row) => {
    const meta = row.meta && typeof row.meta === 'object' ? row.meta : {};
    let service_lead = row.service_lead_id ? leadById.get(String(row.service_lead_id)) || null : null;
    if (!service_lead) {
      const leadNumber = String(meta.lead_number || '').trim();
      if (leadNumber) service_lead = leadByNumber.get(leadNumber) || null;
    }
    return {
      ...row,
      service_lead,
    };
  });

  const phonesToLookup = new Set<string>();
  for (const row of rowsWithLeads) {
    const lead = row.service_lead;
    const meta = row.meta || {};
    const hasName = lead?.customer_name || meta?.customer_name;
    const phone = lead?.customer_phone || meta?.customer_phone;
    if (phone && !hasName) {
      const norm = normalizePhone(phone);
      if (norm) phonesToLookup.add(norm);
    }
  }

  const customerByPhone = new Map<string, { full_name?: string | null; phone?: string | null; email?: string | null }>();
  if (phonesToLookup.size > 0) {
    try {
      const phoneList = [...phonesToLookup];
      const orFilter = phoneList.map((p) => `phone.ilike.%${p}`).join(',');
      const { data: customers } = await supabaseAdmin
        .from('customers')
        .select('full_name, phone, email')
        .or(orFilter);

      for (const customer of customers || []) {
        const norm = normalizePhone(customer.phone);
        if (norm) customerByPhone.set(norm, customer);
      }
    } catch {
      // Customer lookup is best-effort; redemptions must still load.
    }
  }

  return rowsWithLeads.map((row) => {
    const meta = row.meta || {};
    const lead = row.service_lead || null;
    const phone = lead?.customer_phone || meta?.customer_phone || null;
    const phoneNorm = phone ? normalizePhone(phone) : null;
    const customer = phoneNorm ? customerByPhone.get(phoneNorm) : null;
    const bookingSource = lead ? resolveBookingSource(lead as Record<string, any>) : null;

    const customer_display: CouponRedemptionCustomerDisplay = {
      name: lead?.customer_name || meta?.customer_name || customer?.full_name || null,
      phone: phone || customer?.phone || null,
      email: lead?.customer_email || meta?.customer_email || customer?.email || null,
      lead_number: lead?.lead_number || meta?.lead_number || null,
      channel: formatChannelLabel(
        meta?.channel ||
          meta?.type ||
          bookingSource?.booking_source_label ||
          (String(meta?.type || '').toLowerCase() === 'membership' ? 'Membership' : null),
      ),
    };

    const booking_display: CouponRedemptionBookingDisplay = {
      service: resolveServiceLabel(lead, meta, serviceNameById),
      vehicle_number: String(lead?.vehicle_number || meta?.vehicle_number || '').trim().toUpperCase() || null,
      vehicle: formatVehicleLine(lead, meta),
      city: String(lead?.city || meta?.city || '').trim() || null,
      lead_status: String(lead?.status || meta?.lead_status || '').trim() || null,
    };

    return { ...row, customer_display, booking_display };
  });
}

export async function fetchCouponRedemptions(
  supabaseAdmin: SupabaseClient,
  options?: { couponId?: string | null; limit?: number },
): Promise<any[]> {
  const limit = Math.min(Number(options?.limit || 100), 500);

  let query = supabaseAdmin
    .from('coupon_redemptions')
    .select(COUPON_REDEMPTION_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (options?.couponId) query = query.eq('coupon_id', options.couponId);

  let { data, error } = await query;

  if (error) {
    let fallback = supabaseAdmin
      .from('coupon_redemptions')
      .select('id, coupon_id, service_lead_id, invoice_id, applied_by_role, discount_amount_applied, meta, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (options?.couponId) fallback = fallback.eq('coupon_id', options.couponId);
    ({ data, error } = await fallback);
  }
  if (error) throw error;

  let enriched = await enrichCouponRedemptions(supabaseAdmin, data || []);

  const missingCodeIds = [
    ...new Set(enriched.filter((r) => r.coupon_id && !r.coupon?.code).map((r) => r.coupon_id)),
  ];
  if (missingCodeIds.length > 0) {
    const { data: coupons } = await supabaseAdmin.from('coupons').select('id, code').in('id', missingCodeIds);
    const codeById = new Map((coupons || []).map((c: any) => [c.id, c.code]));
    enriched = enriched.map((row) => ({
      ...row,
      coupon: row.coupon?.code ? row.coupon : { code: codeById.get(row.coupon_id) || null },
    }));
  }

  return enriched;
}
