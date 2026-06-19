export type BookingSource = 'APP' | 'WEBSITE' | 'OTHER';

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
    createdFrom.includes('MOBILE') ||
    createdFrom === 'APP';
  const isWebsite = !isApp && (!rawSource || rawSource === 'Website' || rawSource === 'WEB');

  const couponCode = String(lead.coupon_code || lead.coupon_meta?.code || '').trim();
  const discountAmount = Number(lead.discount_amount || lead.coupon_meta?.discount_amount || 0);

  return {
    booking_source: isApp ? 'APP' : isWebsite ? 'WEBSITE' : 'OTHER',
    booking_source_label: isApp ? 'App Booking' : isWebsite ? 'Website' : rawSource || 'Other',
    has_coupon_applied: Boolean(couponCode || discountAmount > 0),
    coupon_display_code: couponCode || null,
    coupon_display_discount: discountAmount > 0 ? discountAmount : null,
  };
}

export function enrichBookingLead(lead: Record<string, any>) {
  return { ...lead, ...resolveBookingSource(lead) };
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
