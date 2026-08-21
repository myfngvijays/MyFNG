import { extractUtmFromUnknown, UTM_KEYS, type UtmParams } from '@/lib/utm';
import { FAMILIES, normalizeFamilyKey } from '@/lib/refer-and-rise';

export type LeadReferralRewardInfo = {
  claim_id: string | null;
  discount_amount: number;
  family_name: string | null;
  reward_text: string | null;
  display_label: string;
};

export function parseLeadReferralReward(meta: Record<string, unknown>): LeadReferralRewardInfo | null {
  const raw = meta.referral_reward;
  if (!raw || typeof raw !== 'object') return null;

  const rr = raw as Record<string, unknown>;
  const discount = Number(rr.discount_amount || 0);
  const claimId = String(rr.claim_id || '').trim() || null;
  const familyKey = normalizeFamilyKey(String(rr.chosen_family || ''));
  const familyName = familyKey ? FAMILIES[familyKey]?.name || null : null;
  const rewardText = String(rr.reward_text || '').trim() || null;

  if (!claimId && discount <= 0 && !rewardText) return null;

  const displayLabel = familyName
    ? rewardText
      ? `${familyName} · ${rewardText}`
      : familyName
    : rewardText || 'Refer & Rise Reward';

  return {
    claim_id: claimId,
    discount_amount: discount > 0 ? discount : 0,
    family_name: familyName,
    reward_text: rewardText,
    display_label: displayLabel,
  };
}

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
  referral_reward_applied: boolean;
  referral_reward_discount: number | null;
  referral_reward_label: string | null;
  referral_reward_family: string | null;
  referral_reward_text: string | null;
  coupon_only_discount: number | null;
} {
  const rawSource = String(lead.lead_source || '').trim();
  const createdFrom = String(lead.created_from || '').trim().toUpperCase();
  const meta = lead.meta && typeof lead.meta === 'object' ? (lead.meta as Record<string, unknown>) : {};

  const couponCode = String(lead.coupon_code || lead.coupon_meta?.code || '').trim();
  const totalDiscount = Number(lead.discount_amount || lead.coupon_meta?.discount_amount || 0);
  const referralReward = parseLeadReferralReward(meta);
  const referralDiscount = referralReward?.discount_amount || 0;
  const couponOnlyDiscount =
    couponCode && totalDiscount > 0
      ? Math.max(0, totalDiscount - referralDiscount)
      : referralDiscount > 0
        ? 0
        : totalDiscount > 0
          ? totalDiscount
          : 0;

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
    /^WhatsApp \(\d{10}\)$/.test(rawSource) ||
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
    has_coupon_applied: Boolean(couponCode || totalDiscount > 0 || referralReward),
    coupon_display_code: couponCode || null,
    coupon_display_discount: totalDiscount > 0 ? totalDiscount : null,
    referral_reward_applied: Boolean(referralReward),
    referral_reward_discount: referralDiscount > 0 ? referralDiscount : null,
    referral_reward_label: referralReward?.display_label || null,
    referral_reward_family: referralReward?.family_name || null,
    referral_reward_text: referralReward?.reward_text || null,
    coupon_only_discount: couponOnlyDiscount > 0 ? couponOnlyDiscount : null,
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
  /** Full detail for hover (e.g. WhatsApp business number) — keep badge label short. */
  source_badge_title?: string;
  /** Inline colors when Tailwind alone is not enough (e.g. WA line split by inbox). */
  source_badge_style?: { backgroundColor: string; color: string; boxShadow?: string };
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
      // Standard Tailwind only — arbitrary hex classes were getting purged (white-on-white).
      source_badge_class: 'bg-blue-100 text-blue-800 ring-1 ring-blue-300',
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
      source_badge_class: 'bg-pink-100 text-pink-800 ring-1 ring-pink-300',
    };
  }

  if (
    createdFrom === 'WHATSAPP_META' ||
    haystack.includes('facebook') ||
    haystack.includes('meta') ||
    haystack.includes('fb ')
  ) {
    return {
      source_badge_kind: 'meta',
      source_badge_label: leadSource || 'Meta Ads',
      source_badge_class: 'bg-sky-100 text-sky-900 ring-1 ring-sky-400',
    };
  }

  if (
    leadSource === 'WhatsApp' ||
    /^WhatsApp \(\d{10}\)$/.test(leadSource) ||
    createdFrom === 'WHATSAPP' ||
    haystack.includes('whatsapp')
  ) {
    const meta =
      lead?.coupon_meta && typeof lead.coupon_meta === 'object'
        ? (lead.coupon_meta as Record<string, unknown>)
        : {};
    const fromLabel = leadSource.match(/^WhatsApp \((\d{10})\)$/)?.[1] || '';
    const waBiz =
      fromLabel ||
      String(meta.wa_business_phone || meta.wa_inbox || '')
        .replace(/\D/g, '')
        .slice(-10);

    // Compact: last 4 digits identify the inbox (9696 vs 6161) without a full 10-digit chip.
    const shortTail = waBiz ? waBiz.slice(-4) : '';
    // Distinct colors per inbox so 9696 vs 6161 are obvious at a glance.
    const waTheme =
      waBiz === '9594996161'
        ? {
            source_badge_class: 'bg-sky-100 text-sky-900 ring-1 ring-sky-400',
            source_badge_style: {
              backgroundColor: '#E0F2FE',
              color: '#0C4A6E',
              boxShadow: 'inset 0 0 0 1px #38BDF8',
            },
          }
        : waBiz === '9167779696'
          ? {
              source_badge_class: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-400',
              source_badge_style: {
                backgroundColor: '#D1FAE5',
                color: '#065F46',
                boxShadow: 'inset 0 0 0 1px #34D399',
              },
            }
          : {
              source_badge_class: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-400',
              source_badge_style: {
                backgroundColor: '#D1FAE5',
                color: '#065F46',
                boxShadow: 'inset 0 0 0 1px #34D399',
              },
            };

    return {
      source_badge_kind: 'whatsapp',
      source_badge_label: shortTail ? `WA · ${shortTail}` : 'WhatsApp',
      source_badge_title: waBiz ? `WhatsApp (${waBiz})` : 'WhatsApp',
      ...waTheme,
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

export const getMisaServicesFromLead = (
  lead: Record<string, any>,
): Array<{ name: string; price: number }> => {
  const meta = lead?.meta && typeof lead.meta === 'object' ? (lead.meta as Record<string, unknown>) : {};
  const misaServices = Array.isArray(meta.misa_services) ? meta.misa_services : [];
  return misaServices
    .map((service: any) => ({
      name: String(service?.name || '').trim(),
      price: Number(service?.price || 0),
    }))
    .filter((service) => service.name);
};

export function getLeadServiceLabel(lead: Record<string, any>) {
  if (lead.service_display) return String(lead.service_display);

  const misaServices = getMisaServicesFromLead(lead);
  if (misaServices.length > 0) {
    return misaServices.map((service) => service.name).join(', ');
  }

  const rawType = String(lead.service_type || '').trim();
  const generic = new Set(['CAR_SERVICE', 'HOME_SERVICE', 'RSA', 'NORMAL', 'SERVICE', 'CAR SERVICE']);
  if (rawType && !generic.has(rawType.toUpperCase())) {
    return prettifyServiceType(rawType);
  }

  if (rawType) return prettifyServiceType(rawType);
  return 'Service';
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
    lead.coupon_only_discount ??
      (lead.referral_reward_applied
        ? 0
        : lead.coupon_display_discount ?? lead.discount_amount ?? meta.coupon_discount ?? 0),
  );
  const referralDiscount = Number(
    lead.referral_reward_discount ??
      parseLeadReferralReward(meta)?.discount_amount ??
      0,
  );
  const totalDiscount = couponDiscount + referralDiscount;

  let original = Number(meta.service_subtotal || 0);
  if (original <= 0) {
    const estimated = Number(lead.estimated_amount || lead.actual_amount || 0);
    original = estimated + walletUsed + totalDiscount;
  }
  if (original <= 0) {
    original = Number(lead.estimated_amount || lead.actual_amount || 0);
  }

  let payable =
    opts?.payableOverride ??
    Number(lead.amount_display ?? lead.payment_amount ?? getLeadDisplayAmount(lead) ?? 0);

  if (walletUsed <= 0 && original > payable + totalDiscount + 0.01) {
    walletUsed = Math.round((original - payable - totalDiscount) * 100) / 100;
  }

  if (walletUsed > 0 && original > 0 && Math.abs(payable - original) < 0.02) {
    payable = Math.max(0, Math.round((original - walletUsed - totalDiscount) * 100) / 100);
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
    referralDiscount: Number.isFinite(referralDiscount) ? referralDiscount : 0,
    totalDiscount: Number.isFinite(totalDiscount) ? totalDiscount : 0,
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
  withPromoCoupon: number;
  withReferralReward: number;
  newLeads: number;
};

export type ChatbotBookingOverview = {
  total: number;
  pending: number;
  completed: number;
  withQuote: number;
};

export function leadHasPromoCoupon(lead: Record<string, any>): boolean {
  const enriched = lead.booking_source ? lead : enrichBookingLead(lead);
  const code = String(enriched.coupon_display_code || enriched.coupon_code || '').trim();
  const promoDiscount = Number(enriched.coupon_only_discount || 0);
  return Boolean(code) || promoDiscount > 0;
}

export function computeServiceLeadOverview(leads: Record<string, any>[]): ServiceLeadOverview {
  const stats: ServiceLeadOverview = {
    total: leads.length,
    app: 0,
    website: 0,
    misa: 0,
    googleAds: 0,
    metaAds: 0,
    withCoupon: 0,
    withPromoCoupon: 0,
    withReferralReward: 0,
    newLeads: 0,
  };

  for (const row of leads) {
    const lead = row.source_badge_kind ? row : enrichBookingLead(row);
    if (lead.has_coupon_applied) stats.withCoupon++;
    if (lead.referral_reward_applied) stats.withReferralReward++;
    if (leadHasPromoCoupon(lead)) stats.withPromoCoupon++;
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
  const parseIds = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.map((v) => String(v || '').trim()).filter(Boolean);
    if (typeof value === 'string') {
      const raw = value.trim();
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map((v) => String(v || '').trim()).filter(Boolean);
      } catch {
        return raw.split(',').map((v) => v.trim()).filter(Boolean);
      }
    }
    return [];
  };

  const allServiceTypeIds = new Set<string>();
  for (const lead of leads) {
    for (const id of parseIds(lead.service_type_ids)) {
      allServiceTypeIds.add(id);
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
    const meta = lead.meta && typeof lead.meta === 'object' ? (lead.meta as Record<string, unknown>) : {};
    const misaServices = Array.isArray(meta.misa_services) ? meta.misa_services : [];
    if (misaServices.length > 0) {
      lead.service_display = misaServices
        .map((service: any) => String(service?.name || '').trim())
        .filter(Boolean)
        .join(', ');
      continue;
    }

    const ids = parseIds(lead.service_type_ids);
    if (ids.length > 0) {
      const names = ids.map((id: string) => serviceNameMap[id]).filter(Boolean);
      if (names.length > 0) {
        lead.service_display = names.join(', ');
        continue;
      }
    }

    const rawType = String(lead.service_type || '').trim();
    const generic = new Set(['CAR_SERVICE', 'HOME_SERVICE', 'RSA', 'NORMAL', 'SERVICE', 'CAR SERVICE']);
    if (rawType && !generic.has(rawType.toUpperCase())) {
      lead.service_display = rawType;
    }
  }

  return leads;
}

/** Granular source filter used by bookings UI + export API. */
export function matchesBookingSourceFilter(lead: Record<string, any>, sourceFilter: string): boolean {
  const source = String(sourceFilter || 'ALL').trim().toUpperCase();
  if (!source || source === 'ALL') return true;

  const enriched = lead.source_badge_kind || lead.booking_source ? lead : enrichBookingLead(lead);
  const kind = String(enriched.source_badge_kind || '').toLowerCase();
  const bookingSource = String(enriched.booking_source || '').toUpperCase();
  const leadSource = String(enriched.lead_source || '').trim();
  const leadSourceLower = leadSource.toLowerCase();

  switch (source) {
    case 'APP':
      return bookingSource === 'APP' || kind === 'app';
    case 'WEBSITE':
      return (
        kind === 'website' ||
        leadSource === 'Website' ||
        leadSource === 'WEB' ||
        leadSource === 'delhi_service'
      );
    case 'MISA':
      return bookingSource === 'MISA' || kind === 'misa' || /misa ai/i.test(leadSource);
    case 'WHATSAPP':
      return (
        kind === 'whatsapp' ||
        leadSource === 'WhatsApp' ||
        /^WhatsApp \(\d{10}\)$/.test(leadSource)
      );
    case 'GOOGLE':
      return kind === 'google' || leadSource === 'Google Ads';
    case 'META':
      return kind === 'meta' || kind === 'instagram' || leadSource === 'Instagram Ads';
    case 'PARTNER':
      return leadSource === 'Partner';
    case 'REFERENCE':
      return leadSource === 'Reference';
    case 'BANNER':
      return leadSource === 'Banner/Offline' || leadSourceLower.includes('banner');
    case 'OTHER':
      return bookingSource === 'OTHER' || kind === 'other' || leadSource === 'Other';
    default:
      return bookingSource === source;
  }
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

    if (!matchesBookingSourceFilter(enriched, source)) return false;

    if (hasCoupon === 'YES' && !enriched.has_coupon_applied) return false;
    if (hasCoupon === 'NO' && enriched.has_coupon_applied) return false;
    if (hasCoupon === 'REFERRAL' && !enriched.referral_reward_applied) return false;
    if (hasCoupon === 'PROMO' && !leadHasPromoCoupon(enriched)) return false;

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
        enriched.referral_reward_label,
        enriched.referral_reward_family,
        enriched.lead_source,
        enriched.booking_source_label,
        enriched.assigned_telecaller_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}

function isInvalidStoredMessage(value: unknown): boolean {
  const t = String(value ?? '').trim().toLowerCase();
  return !t || t === 'undefined' || t === 'null';
}

/** Original enquiry text for list — not latest chat reply. */
export function getLeadInboundWhatsAppMessage(lead: Record<string, any>): string | null {
  const meta =
    lead?.coupon_meta && typeof lead.coupon_meta === 'object'
      ? (lead.coupon_meta as Record<string, unknown>)
      : {};
  for (const value of [
    lead.problem_description,
    meta.first_message,
    meta.original_message,
    meta.enquiry_message,
    meta.inbound_message,
  ]) {
    if (!isInvalidStoredMessage(value)) return String(value).trim();
  }
  return null;
}

/** Incomplete WhatsApp chat lead — not a confirmed app/website booking. */
export function isWhatsAppEnquiryLead(lead: Record<string, any>): boolean {
  const meta =
    lead?.coupon_meta && typeof lead.coupon_meta === 'object'
      ? (lead.coupon_meta as Record<string, unknown>)
      : {};
  return Boolean(meta.whatsapp_enquiry || meta.telecrm_whatsapp) && lead.is_incomplete === true;
}
