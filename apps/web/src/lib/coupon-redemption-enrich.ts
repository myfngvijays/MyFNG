import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePhone } from './coupon-rules';

/** Safe select — no embedded joins that can break if FK/column missing */
export const COUPON_REDEMPTION_SELECT = `
  id, coupon_id, service_lead_id, invoice_id, applied_by_role, discount_amount_applied, meta, created_at,
  coupon:coupons(code)
`;

export type CouponRedemptionCustomerDisplay = {
  name: string | null;
  phone: string | null;
  email: string | null;
  lead_number: string | null;
  channel: string | null;
};

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

  if (leadIds.length > 0) {
    const { data: leads } = await supabaseAdmin
      .from('service_leads')
      .select('id, lead_number, customer_name, customer_phone, customer_email')
      .in('id', leadIds);

    for (const lead of leads || []) {
      leadById.set(String(lead.id), lead);
    }
  }

  const rowsWithLeads = rows.map((row) => ({
    ...row,
    service_lead: row.service_lead_id ? leadById.get(String(row.service_lead_id)) || null : null,
  }));

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

    const customer_display: CouponRedemptionCustomerDisplay = {
      name: lead?.customer_name || meta?.customer_name || customer?.full_name || null,
      phone: phone || customer?.phone || null,
      email: lead?.customer_email || meta?.customer_email || customer?.email || null,
      lead_number: lead?.lead_number || meta?.lead_number || null,
      channel: meta?.channel || meta?.type || null,
    };

    return { ...row, customer_display };
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
