import {
  calculateBundleDiscountWithConfig,
  DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG,
  type PostBookingMembershipConfig,
} from '@/lib/post-booking-membership-config';

export const POST_BOOKING_MEMBERSHIP_OFFER_MINUTES = DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG.offer_window_minutes;
export const POST_BOOKING_MEMBERSHIP_OFFER_HOURS = Math.floor(
  DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG.offer_window_minutes / 60,
);

export type PostBookingMembershipOffer = {
  expires_at: string;
  offered_at: string;
  service_subtotal: number;
  bundle_discount: number;
};

export type PostBookingMembershipOfferStatus = PostBookingMembershipOffer & {
  active: boolean;
  expired: boolean;
  consumed: boolean;
};

function parseMetaObject(meta: unknown): Record<string, unknown> {
  if (!meta || typeof meta !== 'object') return {};
  return meta as Record<string, unknown>;
}

function bundleDiscountForSubtotal(
  serviceSubtotal: number,
  config: PostBookingMembershipConfig = DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG,
): number {
  return calculateBundleDiscountWithConfig(serviceSubtotal, config);
}

export function buildPostBookingMembershipOffer(
  serviceSubtotal: number,
  config: PostBookingMembershipConfig = DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG,
): PostBookingMembershipOffer {
  const now = new Date();
  const expires = new Date(now.getTime() + config.offer_window_minutes * 60 * 1000);
  const bundleDiscount = bundleDiscountForSubtotal(serviceSubtotal, config);
  return {
    offered_at: now.toISOString(),
    expires_at: expires.toISOString(),
    service_subtotal: serviceSubtotal,
    bundle_discount: bundleDiscount,
  };
}

export function parsePostBookingMembershipOffer(
  meta: unknown,
  config: PostBookingMembershipConfig = DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG,
): PostBookingMembershipOffer | null {
  const root = parseMetaObject(meta);
  const raw = root.post_booking_membership_offer;
  if (!raw || typeof raw !== 'object') return null;
  const offer = raw as Record<string, unknown>;
  const expiresAt = String(offer.expires_at || '').trim();
  if (!expiresAt) return null;
  const serviceSubtotal = Number(offer.service_subtotal || 0);
  const bundleDiscount = Number(
    offer.bundle_discount || bundleDiscountForSubtotal(serviceSubtotal, config),
  );
  return {
    expires_at: expiresAt,
    offered_at: String(offer.offered_at || expiresAt),
    service_subtotal: serviceSubtotal,
    bundle_discount: bundleDiscount,
  };
}

export function isPostBookingMembershipOfferActive(offer: PostBookingMembershipOffer | null): boolean {
  if (!offer?.expires_at) return false;
  return new Date(offer.expires_at).getTime() > Date.now();
}

export function resolvePostBookingBundleDiscount(
  serviceSubtotal: number,
  offer: PostBookingMembershipOffer | null,
  config: PostBookingMembershipConfig = DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG,
): number {
  if (!offer) return bundleDiscountForSubtotal(serviceSubtotal, config);
  if (isPostBookingMembershipOfferActive(offer)) {
    return offer.bundle_discount > 0
      ? offer.bundle_discount
      : bundleDiscountForSubtotal(serviceSubtotal, config);
  }
  return 0;
}

function deriveServiceSubtotalFromLead(lead: Record<string, unknown>): number {
  const estimated = Number(lead.estimated_amount || 0);
  const discount = Number(lead.discount_amount || 0);
  const meta = parseMetaObject(lead.meta);
  const walletDeduction = Number(meta.wallet_deduction || 0);
  const fromAmounts = Math.max(0, estimated + discount + walletDeduction);
  if (fromAmounts > 0) return fromAmounts;

  const offer = parsePostBookingMembershipOffer(meta);
  if (offer?.service_subtotal && offer.service_subtotal > 0) return offer.service_subtotal;

  return Math.max(0, estimated);
}

function isMembershipBundleExpired(meta: Record<string, unknown>): boolean {
  const bundleMeta = meta.booking_membership_bundle;
  if (bundleMeta && typeof bundleMeta === 'object' && (bundleMeta as Record<string, unknown>).expired_at) {
    return true;
  }
  const rawOffer = meta.post_booking_membership_offer;
  if (rawOffer && typeof rawOffer === 'object' && (rawOffer as Record<string, unknown>).expired_at) {
    return true;
  }
  return false;
}

function wasRevokedByAdmin(meta: Record<string, unknown>): boolean {
  if (meta.revoked_by_admin_at) return true;
  const bundleMeta = meta.booking_membership_bundle;
  if (bundleMeta && typeof bundleMeta === 'object' && (bundleMeta as Record<string, unknown>).revoked_by_admin_at) {
    return true;
  }
  const rawOffer = meta.post_booking_membership_offer;
  if (rawOffer && typeof rawOffer === 'object' && (rawOffer as Record<string, unknown>).revoked_by_admin_at) {
    return true;
  }
  return false;
}

/** Membership bundle discount still valid on the service booking (paid or within offer window). */
export function resolveActiveMembershipBundleDiscount(
  lead: Record<string, unknown>,
  config: PostBookingMembershipConfig = DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG,
): number {
  const meta = parseMetaObject(lead.meta);
  const bundle = meta.booking_membership_bundle as Record<string, unknown> | undefined;
  const rawDiscount = Number(bundle?.discount_amount || 0);
  if (rawDiscount <= 0) return 0;

  if (bundle?.applied_at || bundle?.membership_id) return rawDiscount;
  if (isMembershipBundleExpired(meta) || wasRevokedByAdmin(meta)) return 0;

  const offerStatus = resolvePostBookingMembershipOfferStatus(lead, config);
  if (!offerStatus || !offerStatus.active || offerStatus.expired) return 0;
  return rawDiscount;
}

export function resolveServiceLeadCouponDiscount(
  lead: Record<string, unknown>,
  config: PostBookingMembershipConfig = DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG,
): number {
  const meta = parseMetaObject(lead.meta);
  const bundle = meta.booking_membership_bundle as Record<string, unknown> | undefined;
  const couponFromMeta = Number(bundle?.coupon_discount || 0);
  if (couponFromMeta > 0) return couponFromMeta;

  const totalDiscount = Number(lead.discount_amount || 0);
  const membershipDiscount = resolveActiveMembershipBundleDiscount(lead, config);
  return Math.max(0, Math.round((totalDiscount - membershipDiscount) * 100) / 100);
}

/** Correct payable amount when an expired membership bundle discount is still stored on the lead. */
export function resolveLeadAmountDisplay(
  lead: Record<string, unknown>,
  config: PostBookingMembershipConfig = DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG,
): number {
  const actual = Number(lead.actual_amount || 0);
  const estimated = Number(lead.estimated_amount || 0);
  let amount = actual > 0 ? actual : estimated;
  if (amount <= 0) return 0;

  if (resolveActiveMembershipBundleDiscount(lead, config) > 0) return amount;

  const meta = parseMetaObject(lead.meta);
  const bundle = meta.booking_membership_bundle as Record<string, unknown> | undefined;
  const storedDiscount = Number(bundle?.discount_amount || 0);
  if (storedDiscount <= 0) return amount;

  const offerStatus = resolvePostBookingMembershipOfferStatus(lead, config);
  const bundleExpired =
    Boolean(bundle?.expired_at) ||
    wasRevokedByAdmin(meta) ||
    !offerStatus ||
    !offerStatus.active ||
    offerStatus.expired;

  if (bundleExpired) {
    return Math.round((amount + storedDiscount) * 100) / 100;
  }

  return amount;
}

export async function expireUnpaidBookingMembershipBundleIfNeeded(
  supabaseAdmin: any,
  lead: Record<string, unknown>,
  config: PostBookingMembershipConfig = DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG,
): Promise<void> {
  const meta = parseMetaObject(lead.meta);
  const bundle = meta.booking_membership_bundle as Record<string, unknown> | undefined;
  if (!bundle || bundle.applied_at || bundle.membership_id) return;
  if (bundle.expired_at) return;
  if (isMembershipBundleExpired(meta) && Number(bundle.discount_amount || 0) <= 0) return;

  const offerStatus = resolvePostBookingMembershipOfferStatus(lead, config);
  if (offerStatus?.active) return;

  const bundleDiscount = Number(bundle.discount_amount || 0);
  const estimated = Number(lead.estimated_amount || 0);
  const discount = Number(lead.discount_amount || 0);
  const newEstimated =
    bundleDiscount > 0
      ? Math.round((estimated + bundleDiscount) * 100) / 100
      : estimated;
  const newDiscount =
    bundleDiscount > 0
      ? Math.max(0, Math.round((discount - bundleDiscount) * 100) / 100)
      : discount;

  const expiredAt = new Date().toISOString();
  const newMeta: Record<string, unknown> = {
    ...meta,
    booking_membership_bundle: {
      ...bundle,
      include_membership: false,
      discount_amount: 0,
      expired_at: expiredAt,
    },
    post_booking_membership_offer: {
      ...(typeof meta.post_booking_membership_offer === 'object'
        ? (meta.post_booking_membership_offer as Record<string, unknown>)
        : {}),
      expired_at: expiredAt,
    },
  };

  const leadId = String(lead.id || '').trim();
  if (!leadId) return;

  const { error } = await supabaseAdmin
    .from('service_leads')
    .update({
      estimated_amount: newEstimated,
      actual_amount: newEstimated,
      discount_amount: newDiscount,
      meta: newMeta,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId);

  if (error) {
    console.error('[expireUnpaidBookingMembershipBundleIfNeeded]', error.message);
    return;
  }

  lead.estimated_amount = newEstimated;
  lead.actual_amount = newEstimated;
  lead.discount_amount = newDiscount;
  lead.meta = newMeta;
}

export function resolvePostBookingMembershipOfferStatus(
  lead: Record<string, unknown>,
  config: PostBookingMembershipConfig = DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG,
): PostBookingMembershipOfferStatus | null {
  if (!config.enabled) return null;

  const meta = parseMetaObject(lead.meta);
  const bundleMeta = meta.booking_membership_bundle;
  if (
    bundleMeta &&
    typeof bundleMeta === 'object' &&
    ((bundleMeta as Record<string, unknown>).applied_at ||
      (bundleMeta as Record<string, unknown>).membership_id)
  ) {
    return null;
  }
  if (isMembershipBundleExpired(meta)) return null;

  let offer = parsePostBookingMembershipOffer(meta, config);
  if (!offer) {
    const createdAt = String(lead.created_at || '').trim();
    if (!createdAt) return null;
    const createdMs = new Date(createdAt).getTime();
    if (!Number.isFinite(createdMs)) return null;
    const expiresMs = createdMs + config.offer_window_minutes * 60 * 1000;
    if (expiresMs <= Date.now()) {
      const serviceSubtotal = deriveServiceSubtotalFromLead(lead);
      if (serviceSubtotal <= 0) return null;
      offer = {
        offered_at: createdAt,
        expires_at: new Date(expiresMs).toISOString(),
        service_subtotal: serviceSubtotal,
        bundle_discount: bundleDiscountForSubtotal(serviceSubtotal, config),
      };
    } else {
      const serviceSubtotal = deriveServiceSubtotalFromLead(lead);
      if (serviceSubtotal <= 0) return null;
      offer = buildPostBookingMembershipOffer(serviceSubtotal, config);
      offer.offered_at = createdAt;
      offer.expires_at = new Date(expiresMs).toISOString();
    }
  }

  const active = isPostBookingMembershipOfferActive(offer);
  return {
    ...offer,
    active,
    expired: !active,
    consumed: false,
  };
}

export type PostBookingMembershipAdminRow = {
  lead_id: string;
  lead_number: string;
  customer_name: string;
  customer_phone: string;
  vehicle_number: string;
  created_at: string;
  lead_status: string;
  offer_status: 'active' | 'expired' | 'paid' | 'revoked';
  expires_at: string | null;
  bundle_discount: number;
  service_subtotal: number;
  membership_payable: number | null;
  booking_amount: number;
};

export function resolvePostBookingMembershipAdminRow(
  lead: Record<string, unknown>,
  config: PostBookingMembershipConfig,
  membershipListPrice = 699,
): PostBookingMembershipAdminRow | null {
  const meta = parseMetaObject(lead.meta);
  const bundle = meta.booking_membership_bundle as Record<string, unknown> | undefined;
  const hasOfferMeta = Boolean(meta.post_booking_membership_offer);
  if (!bundle && !hasOfferMeta) return null;
  if (bundle?.expired_at && !hasOfferMeta) return null;

  if (bundle?.applied_at || bundle?.membership_id) {
    return {
      lead_id: String(lead.id || ''),
      lead_number: String(lead.lead_number || lead.id || ''),
      customer_name: String(lead.customer_name || ''),
      customer_phone: String(lead.customer_phone || ''),
      vehicle_number: String(lead.vehicle_number || ''),
      created_at: String(lead.created_at || ''),
      lead_status: String(lead.status || ''),
      offer_status: 'paid',
      expires_at: null,
      bundle_discount: Number(bundle.discount_amount || 0),
      service_subtotal: Number(bundle.service_subtotal || deriveServiceSubtotalFromLead(lead)),
      membership_payable: null,
      booking_amount: Number(lead.estimated_amount || lead.actual_amount || 0),
    };
  }

  const offerStatus = resolvePostBookingMembershipOfferStatus(lead, config);
  if (!offerStatus) {
    if (isMembershipBundleExpired(meta)) {
      return {
        lead_id: String(lead.id || ''),
        lead_number: String(lead.lead_number || lead.id || ''),
        customer_name: String(lead.customer_name || ''),
        customer_phone: String(lead.customer_phone || ''),
        vehicle_number: String(lead.vehicle_number || ''),
        created_at: String(lead.created_at || ''),
        lead_status: String(lead.status || ''),
        offer_status: wasRevokedByAdmin(meta) ? 'revoked' : 'expired',
        expires_at: null,
        bundle_discount: Number(bundle?.discount_amount || 0),
        service_subtotal: deriveServiceSubtotalFromLead(lead),
        membership_payable: null,
        booking_amount: Number(lead.estimated_amount || lead.actual_amount || 0),
      };
    }
    return null;
  }

  const bundleDiscount = Number(offerStatus.bundle_discount || bundle.discount_amount || 0);
  return {
    lead_id: String(lead.id || ''),
    lead_number: String(lead.lead_number || lead.id || ''),
    customer_name: String(lead.customer_name || ''),
    customer_phone: String(lead.customer_phone || ''),
    vehicle_number: String(lead.vehicle_number || ''),
    created_at: String(lead.created_at || ''),
    lead_status: String(lead.status || ''),
    offer_status: offerStatus.active ? 'active' : 'expired',
    expires_at: offerStatus.expires_at,
    bundle_discount: bundleDiscount,
    service_subtotal: Number(offerStatus.service_subtotal || 0),
    membership_payable: Math.max(0, membershipListPrice - bundleDiscount),
    booking_amount: Number(lead.estimated_amount || lead.actual_amount || 0),
  };
}

export async function listPostBookingMembershipAdminRows(
  supabaseAdmin: any,
  config: PostBookingMembershipConfig,
  membershipListPrice = 699,
  limit = 150,
): Promise<PostBookingMembershipAdminRow[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('service_leads')
    .select(
      'id, lead_number, customer_name, customer_phone, vehicle_number, created_at, status, estimated_amount, actual_amount, discount_amount, meta',
    )
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(Math.max(20, Math.min(limit, 300)));

  if (error) throw new Error(error.message || 'Could not load bookings');

  const rows: PostBookingMembershipAdminRow[] = [];
  for (const lead of data || []) {
    const row = resolvePostBookingMembershipAdminRow(lead as Record<string, unknown>, config, membershipListPrice);
    if (row) rows.push(row);
  }
  return rows;
}

export async function revokePostBookingMembershipOfferByAdmin(
  supabaseAdmin: any,
  leadId: string,
  adminUserId?: string | null,
  config: PostBookingMembershipConfig = DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG,
): Promise<void> {
  const id = String(leadId || '').trim();
  if (!id) throw new Error('Lead id is required');

  const { data: lead, error } = await supabaseAdmin
    .from('service_leads')
    .select('id, estimated_amount, actual_amount, discount_amount, meta')
    .eq('id', id)
    .maybeSingle();

  if (error || !lead) throw new Error('Booking not found');

  const leadRecord = lead as Record<string, unknown>;
  const meta = parseMetaObject(leadRecord.meta);
  const bundle = meta.booking_membership_bundle as Record<string, unknown> | undefined;
  if (bundle?.applied_at || bundle?.membership_id) {
    throw new Error('Prime is already paid for this booking');
  }
  if (isMembershipBundleExpired(meta)) {
    throw new Error('Offer is already closed for this booking');
  }

  const revokedAt = new Date().toISOString();
  const bundleDiscount = Number(bundle?.discount_amount || 0);
  const estimated = Number(leadRecord.estimated_amount || 0);
  const discount = Number(leadRecord.discount_amount || 0);
  const newEstimated =
    bundleDiscount > 0 ? Math.round((estimated + bundleDiscount) * 100) / 100 : estimated;
  const newDiscount =
    bundleDiscount > 0 ? Math.max(0, Math.round((discount - bundleDiscount) * 100) / 100) : discount;

  const newMeta: Record<string, unknown> = {
    ...meta,
    revoked_by_admin_at: revokedAt,
    revoked_by_admin_id: adminUserId || null,
    booking_membership_bundle: bundle
      ? {
          ...bundle,
          include_membership: false,
          expired_at: revokedAt,
          revoked_by_admin_at: revokedAt,
        }
      : bundle,
    post_booking_membership_offer: {
      ...(typeof meta.post_booking_membership_offer === 'object'
        ? (meta.post_booking_membership_offer as Record<string, unknown>)
        : {}),
      expired_at: revokedAt,
      revoked_by_admin_at: revokedAt,
    },
  };

  const { error: updateError } = await supabaseAdmin
    .from('service_leads')
    .update({
      estimated_amount: newEstimated,
      actual_amount: newEstimated,
      discount_amount: newDiscount,
      meta: newMeta,
      updated_at: revokedAt,
    })
    .eq('id', id);

  if (updateError) throw new Error(updateError.message || 'Could not revoke offer');

  void config;
}
