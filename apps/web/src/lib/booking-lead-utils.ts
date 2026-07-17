import { extractUtmFromUnknown, UTM_KEYS, type UtmParams } from '@/lib/utm';

export type BookingSource = 'APP' | 'WEBSITE' | 'MISA' | 'OTHER';

function isMisaLeadSource(value: string) {
  return /^misa ai/i.test(value) || value === 'AI Chatbot' || /whatsapp misa ai/i.test(value);
}

function isAppBookingLeadSource(value: string) {
  return /^app booking/i.test(value);
}

export function getLeadUtmParams(lead: Record<string, any>): UtmParams {
  return extractUtmFromUnknown(lead);
}

export function hasLeadUtmTracking(lead: Record<string, any>): boolean {
  const utm = getLeadUtmParams(lead);
  return UTM_KEYS.some((key) => Boolean(utm[key]));
}

export function resolveBookingSource(lead: Record<string, any>): {
  booking_source: BookingSource;
  booking_source_label: string;
  has_coupon_applied: boolean;
  coupon_display_code: string | null;
  coupon_display_discount: number | null;
} {
  const rawSource = String(lead.lead_source || '').trim();
  const createdFrom = String(lead.created_from || '').trim().toUpperCase();

  const couponCode = String(lead.coupon_code || lead.coupon_meta?.code || '').trim();
  const discountAmount = Number(lead.discount_amount || lead.coupon_meta?.discount_amount || 0);

  let booking_source: BookingSource;
  let booking_source_label: string;

  if (isMisaLeadSource(rawSource)) {
    booking_source = 'MISA';
    if (/whatsapp misa ai/i.test(rawSource)) booking_source_label = 'WhatsApp MISA AI';
    else if (/misa ai \(app\)/i.test(rawSource)) booking_source_label = 'MISA AI (App)';
    else if (/misa ai \(website\)/i.test(rawSource) || rawSource === 'AI Chatbot') {
      booking_source_label = 'MISA AI (Website)';
    } else {
      booking_source_label = rawSource || 'MISA AI';
    }
  } else if (
    isAppBookingLeadSource(rawSource) ||
    createdFrom === 'MOBILE_APP' ||
    createdFrom === 'MOBILE_PUBLIC' ||
    (createdFrom.includes('MOBILE') && !isMisaLeadSource(rawSource))
  ) {
    booking_source = 'APP';
    booking_source_label = isAppBookingLeadSource(rawSource) ? rawSource : 'App Booking';
  } else if (
    !rawSource ||
    rawSource === 'Website' ||
    rawSource === 'WEB' ||
    rawSource === 'delhi_service'
  ) {
    booking_source = 'WEBSITE';
    booking_source_label = 'Website';
  } else if (
    rawSource === 'Google Ads' ||
    rawSource === 'Instagram Ads' ||
    rawSource === 'WhatsApp' ||
    rawSource === 'Partner' ||
    rawSource === 'Reference' ||
    rawSource === 'Banner/Offline'
  ) {
    booking_source = 'WEBSITE';
    booking_source_label = rawSource;
  } else {
    booking_source = 'OTHER';
    booking_source_label = rawSource || 'Other';
  }

  return {
    booking_source,
    booking_source_label,
    has_coupon_applied: Boolean(couponCode || discountAmount > 0),
    coupon_display_code: couponCode || null,
    coupon_display_discount: discountAmount > 0 ? discountAmount : null,
  };
}

export function enrichBookingLead(lead: Record<string, any>) {
  const utm = getLeadUtmParams(lead);
  return {
    ...lead,
    ...utm,
    has_utm_tracking: UTM_KEYS.some((key) => Boolean(utm[key])),
    ...resolveBookingSource(lead),
    ...resolveLeadSourceBadgeTheme(lead),
  };
}

export type LeadSourceBadgeKind =
  | 'google'
  | 'meta'
  | 'instagram'
  | 'whatsapp'
  | 'app'
  | 'website'
  | 'misa'
  | 'other';

export function resolveLeadSourceBadgeTheme(lead: Record<string, any>): {
  source_badge_kind: LeadSourceBadgeKind;
  source_badge_label: string;
  source_badge_class: string;
} {
  const utm = getLeadUtmParams(lead);
  const leadSource = String(lead.lead_source || '').trim();
  const bookingLabel = String(lead.booking_source_label || '').trim();
  const createdFrom = String(lead.created_from || '').trim().toUpperCase();
  const haystack = [
    leadSource,
    bookingLabel,
    utm.utm_source,
    utm.utm_medium,
    utm.utm_campaign,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const bookingSource = String(lead.booking_source || '').toUpperCase();

  if (
    leadSource === 'Google Ads' ||
    haystack.includes('google') ||
    haystack.includes('adwords') ||
    haystack.includes('gads') ||
    (haystack.includes('cpc') && !haystack.includes('facebook') && !haystack.includes('meta'))
  ) {
    return {
      source_badge_kind: 'google',
      source_badge_label: leadSource || 'Google Ads',
      source_badge_class: 'bg-[#E8F0FE] text-[#185ABC] ring-1 ring-[#4285F4]/35',
    };
  }

  if (
    leadSource === 'Instagram Ads' ||
    haystack.includes('instagram') ||
    haystack.includes('insta')
  ) {
    return {
      source_badge_kind: 'instagram',
      source_badge_label: leadSource || 'Instagram Ads',
      source_badge_class:
        'bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#F77737] text-white shadow-sm',
    };
  }

  if (
    haystack.includes('facebook') ||
    haystack.includes('meta') ||
    haystack.includes('fb ')
  ) {
    return {
      source_badge_kind: 'meta',
      source_badge_label: leadSource || 'Meta Ads',
      source_badge_class: 'bg-[#1877F2] text-white shadow-sm',
    };
  }

  if (leadSource === 'WhatsApp' || haystack.includes('whatsapp')) {
    return {
      source_badge_kind: 'whatsapp',
      source_badge_label: leadSource || 'WhatsApp',
      source_badge_class: 'bg-[#DCFCE7] text-[#128C7E] ring-1 ring-[#25D366]/30',
    };
  }

  if (bookingSource === 'MISA' || /misa ai/i.test(leadSource) || /misa ai/i.test(bookingLabel)) {
    return {
      source_badge_kind: 'misa',
      source_badge_label: bookingLabel || leadSource || 'MISA AI',
      source_badge_class: 'bg-violet-100 text-violet-800',
    };
  }

  if (
    bookingSource === 'APP' ||
    isAppBookingLeadSource(leadSource) ||
    createdFrom === 'MOBILE_APP' ||
    createdFrom === 'MOBILE_PUBLIC'
  ) {
    return {
      source_badge_kind: 'app',
      source_badge_label: isAppBookingLeadSource(leadSource) ? leadSource : bookingLabel || 'App Booking',
      source_badge_class: 'bg-emerald-100 text-emerald-800',
    };
  }

  if (
    bookingSource === 'WEBSITE' ||
    leadSource === 'Website' ||
    leadSource === 'WEB' ||
    bookingLabel === 'Website'
  ) {
    return {
      source_badge_kind: 'website',
      source_badge_label: bookingLabel || leadSource || 'Website',
      source_badge_class: 'bg-blue-100 text-blue-800',
    };
  }

  return {
    source_badge_kind: 'other',
    source_badge_label: leadSource || bookingLabel || 'Other',
    source_badge_class: 'bg-gray-100 text-gray-700',
  };
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

export type ServiceLeadOverview = {
  total: number;
  app: number;
  website: number;
  misa: number;
  googleAds: number;
  metaAds: number;
  withCoupon: number;
  newLeads: number;
};

export type ChatbotBookingOverview = {
  total: number;
  pending: number;
  completed: number;
  withQuote: number;
};

export function computeServiceLeadOverview(leads: Record<string, any>[]): ServiceLeadOverview {
  const stats: ServiceLeadOverview = {
    total: leads.length,
    app: 0,
    website: 0,
    misa: 0,
    googleAds: 0,
    metaAds: 0,
    withCoupon: 0,
    newLeads: 0,
  };

  for (const row of leads) {
    const lead = row.source_badge_kind ? row : enrichBookingLead(row);
    if (lead.has_coupon_applied) stats.withCoupon++;
    if (String(lead.status || 'NEW').toUpperCase() === 'NEW') stats.newLeads++;

    const kind = lead.source_badge_kind;
    if (kind === 'google') stats.googleAds++;
    else if (kind === 'meta' || kind === 'instagram') stats.metaAds++;
    else if (lead.booking_source === 'MISA') stats.misa++;
    else if (lead.booking_source === 'APP') stats.app++;
    else if (lead.booking_source === 'WEBSITE') stats.website++;
  }

  return stats;
}

export function computeChatbotBookingOverview(bookings: Record<string, any>[]): ChatbotBookingOverview {
  const stats: ChatbotBookingOverview = {
    total: bookings.length,
    pending: 0,
    completed: 0,
    withQuote: 0,
  };

  for (const booking of bookings) {
    const status = String(booking.status || '').toLowerCase();
    if (status === 'pending' || status === 'new') stats.pending++;
    if (status === 'completed' || status === 'confirmed') stats.completed++;
    if (Number(booking.quoted_price || 0) > 0) stats.withQuote++;
  }

  return stats;
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
