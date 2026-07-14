export type BookingSource = 'APP' | 'WEBSITE' | 'MISA' | 'OTHER';

export function resolveBookingSource(lead: Record<string, any>): {
  booking_source: BookingSource;
  booking_source_label: string;
  has_coupon_applied: boolean;
  coupon_display_code: string | null;
  coupon_display_discount: number | null;
} {
  const rawSource = String(lead.lead_source || '').trim();
  const createdFrom = String(lead.created_from || '').trim().toUpperCase();
  const isApp =
    /^app booking/i.test(rawSource) ||
    /^app/i.test(rawSource) ||
    /^misa ai \(app\)/i.test(rawSource) ||
    createdFrom.includes('MOBILE') ||
    createdFrom === 'APP';
  const isWebsite =
    !isApp &&
    (!rawSource ||
      rawSource === 'Website' ||
      rawSource === 'WEB' ||
      rawSource === 'AI Chatbot' ||
      /^misa ai \(website\)/i.test(rawSource));
  const isMisa =
    !isApp &&
    !isWebsite &&
    (/whatsapp misa ai/i.test(rawSource) ||
      /^misa ai/i.test(rawSource) ||
      createdFrom === 'WHATSAPP');

  const couponCode = String(lead.coupon_code || lead.coupon_meta?.code || '').trim();
  const discountAmount = Number(lead.discount_amount || lead.coupon_meta?.discount_amount || 0);

  let booking_source_label = rawSource || 'Other';
  if (isApp) booking_source_label = 'MISA AI (App)';
  else if (isWebsite) {
    booking_source_label =
      rawSource === 'AI Chatbot' || /^misa ai \(website\)/i.test(rawSource)
        ? 'MISA AI (Website)'
        : 'Website';
  } else if (isMisa) {
    booking_source_label = /whatsapp misa ai/i.test(rawSource) ? 'WhatsApp MISA AI' : rawSource || 'MISA AI';
  }

  return {
    booking_source: isApp ? 'APP' : isWebsite ? 'WEBSITE' : isMisa ? 'MISA' : 'OTHER',
    booking_source_label,
    has_coupon_applied: Boolean(couponCode || discountAmount > 0),
    coupon_display_code: couponCode || null,
    coupon_display_discount: discountAmount > 0 ? discountAmount : null,
  };
}

export function enrichBookingLead(lead: Record<string, any>) {
  return { ...lead, ...resolveBookingSource(lead) };
}

export function prettifyServiceType(value?: string | null) {
  if (!value) return '';
  return String(value)
    .replace(/_/g, ' ')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function getLeadDisplayAmount(lead: Record<string, any>) {
  const display = lead.amount_display;
  const estimated = Number(lead.estimated_amount || lead.actual_amount || 0);
  const meta = lead.meta && typeof lead.meta === 'object' ? (lead.meta as Record<string, unknown>) : {};
  const subtotal = Number(meta.service_subtotal || 0);
  const wallet = meta.wallet_applied ? Number(meta.wallet_deduction || 0) : 0;

  if (display !== null && display !== undefined && display !== '') {
    const num = Number(display);
    if (Number.isFinite(num)) {
      if (wallet > 0 && subtotal > 0 && num >= subtotal - 0.01 && estimated > 0 && estimated < num) {
        return estimated;
      }
      return num;
    }
  }

  if (wallet > 0 && subtotal > 0) {
    return Math.max(0, subtotal - wallet);
  }

  const fallback = Number(lead.payment_amount ?? lead.estimated_amount ?? lead.actual_amount ?? 0);
  return Number.isFinite(fallback) ? fallback : 0;
}

export function getLeadServiceLabel(lead: Record<string, any>) {
  if (lead.service_display) return String(lead.service_display);
  if (lead.service_type) return prettifyServiceType(lead.service_type);
  return 'Service';
}

export function getLeadVehicleLabel(lead: Record<string, any>) {
  const makeModel = [lead.vehicle_make, lead.vehicle_model, lead.vehicle_variant]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .join(' ');
  if (makeModel) return makeModel;
  const model = String(lead.vehicle_model || '').trim();
  return model || null;
}

export function getLeadPricingBreakdown(
  lead: Record<string, any>,
  opts?: { walletTxAmount?: number; payableOverride?: number; walletTxPercent?: number },
) {
  const meta = lead.meta && typeof lead.meta === 'object' ? (lead.meta as Record<string, unknown>) : {};
  let walletUsed = Number(lead.wallet_deduction_display ?? 0);
  if (walletUsed <= 0 && meta.wallet_applied) {
    walletUsed = Number(meta.wallet_deduction || 0);
  }
  if (walletUsed <= 0 && Number(opts?.walletTxAmount || 0) > 0) {
    walletUsed = Number(opts?.walletTxAmount);
  }

  const couponDiscount = Number(
    lead.coupon_display_discount ?? lead.discount_amount ?? meta.coupon_discount ?? 0,
  );

  let original = Number(meta.service_subtotal || 0);
  if (original <= 0) {
    const estimated = Number(lead.estimated_amount || lead.actual_amount || 0);
    original = estimated + walletUsed + couponDiscount;
  }
  if (original <= 0) {
    original = Number(lead.estimated_amount || lead.actual_amount || 0);
  }

  let payable =
    opts?.payableOverride ??
    Number(lead.amount_display ?? lead.payment_amount ?? getLeadDisplayAmount(lead) ?? 0);

  if (walletUsed <= 0 && original > payable + couponDiscount + 0.01) {
    walletUsed = Math.round((original - payable - couponDiscount) * 100) / 100;
  }

  if (walletUsed > 0 && original > 0 && Math.abs(payable - original) < 0.02) {
    payable = Math.max(0, Math.round((original - walletUsed - couponDiscount) * 100) / 100);
  }

  const walletUsagePercent =
    Number(opts?.walletTxPercent || 0) > 0
      ? Number(opts?.walletTxPercent)
      : walletUsed > 0 && original > 0
        ? Math.round((walletUsed / original) * 1000) / 10
        : null;

  return {
    original: Number.isFinite(original) ? original : 0,
    walletUsed: Number.isFinite(walletUsed) ? walletUsed : 0,
    couponDiscount: Number.isFinite(couponDiscount) ? couponDiscount : 0,
    payable: Number.isFinite(payable) ? payable : 0,
    walletUsagePercent,
  };
}

export async function enrichLeadsServiceDisplay(supabaseAdmin: any, leads: Record<string, any>[]) {
  const allServiceTypeIds = new Set<string>();
  for (const lead of leads) {
    if (Array.isArray(lead.service_type_ids)) {
      lead.service_type_ids.forEach((id: string) => allServiceTypeIds.add(id));
    }
  }

  const serviceNameMap: Record<string, string> = {};
  if (allServiceTypeIds.size > 0) {
    const { data: stRows } = await supabaseAdmin
      .from('service_types')
      .select('id, name')
      .in('id', Array.from(allServiceTypeIds));
    for (const row of stRows || []) {
      serviceNameMap[String((row as { id: string }).id)] = String((row as { name: string }).name);
    }
  }

  for (const lead of leads) {
    if (Array.isArray(lead.service_type_ids) && lead.service_type_ids.length > 0) {
      const names = lead.service_type_ids.map((id: string) => serviceNameMap[id]).filter(Boolean);
      if (names.length > 0) {
        lead.service_display = names.join(', ');
      }
    }
  }

  return leads;
}

export function filterBookingLeads(
  leads: Record<string, any>[],
  filters: {
    source?: string;
    hasCoupon?: string;
    search?: string;
  },
) {
  const search = String(filters.search || '').trim().toLowerCase();
  const source = String(filters.source || 'ALL').toUpperCase();
  const hasCoupon = String(filters.hasCoupon || 'ALL').toUpperCase();

  return leads.filter((lead) => {
    const enriched = lead.booking_source ? lead : enrichBookingLead(lead);

    if (source !== 'ALL' && enriched.booking_source !== source) return false;

    if (hasCoupon === 'YES' && !enriched.has_coupon_applied) return false;
    if (hasCoupon === 'NO' && enriched.has_coupon_applied) return false;

    if (search) {
      const haystack = [
        enriched.lead_number,
        enriched.customer_name,
        enriched.customer_phone,
        enriched.vehicle_number,
        enriched.city,
        enriched.service_type,
        enriched.service_display,
        enriched.coupon_display_code,
        enriched.lead_source,
        enriched.booking_source_label,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}
