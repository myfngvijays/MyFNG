import { calculateBookingMembershipBundleDiscount } from '@/lib/booking-membership-discount';

export const POST_BOOKING_MEMBERSHIP_OFFER_HOURS = 3;

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

export function buildPostBookingMembershipOffer(serviceSubtotal: number): PostBookingMembershipOffer {
  const now = new Date();
  const expires = new Date(now.getTime() + POST_BOOKING_MEMBERSHIP_OFFER_HOURS * 60 * 60 * 1000);
  const bundleDiscount = calculateBookingMembershipBundleDiscount(serviceSubtotal);
  return {
    offered_at: now.toISOString(),
    expires_at: expires.toISOString(),
    service_subtotal: serviceSubtotal,
    bundle_discount: bundleDiscount,
  };
}

export function parsePostBookingMembershipOffer(meta: unknown): PostBookingMembershipOffer | null {
  const root = parseMetaObject(meta);
  const raw = root.post_booking_membership_offer;
  if (!raw || typeof raw !== 'object') return null;
  const offer = raw as Record<string, unknown>;
  const expiresAt = String(offer.expires_at || '').trim();
  if (!expiresAt) return null;
  const serviceSubtotal = Number(offer.service_subtotal || 0);
  const bundleDiscount = Number(
    offer.bundle_discount || calculateBookingMembershipBundleDiscount(serviceSubtotal),
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
): number {
  if (!offer) return calculateBookingMembershipBundleDiscount(serviceSubtotal);
  if (isPostBookingMembershipOfferActive(offer)) {
    return offer.bundle_discount > 0
      ? offer.bundle_discount
      : calculateBookingMembershipBundleDiscount(serviceSubtotal);
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

export function resolvePostBookingMembershipOfferStatus(
  lead: Record<string, unknown>,
): PostBookingMembershipOfferStatus | null {
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

  let offer = parsePostBookingMembershipOffer(meta);
  if (!offer) {
    const createdAt = String(lead.created_at || '').trim();
    if (!createdAt) return null;
    const createdMs = new Date(createdAt).getTime();
    if (!Number.isFinite(createdMs)) return null;
    const expiresMs = createdMs + POST_BOOKING_MEMBERSHIP_OFFER_HOURS * 60 * 60 * 1000;
    if (expiresMs <= Date.now()) {
      const serviceSubtotal = deriveServiceSubtotalFromLead(lead);
      if (serviceSubtotal <= 0) return null;
      offer = {
        offered_at: createdAt,
        expires_at: new Date(expiresMs).toISOString(),
        service_subtotal: serviceSubtotal,
        bundle_discount: calculateBookingMembershipBundleDiscount(serviceSubtotal),
      };
    } else {
      const serviceSubtotal = deriveServiceSubtotalFromLead(lead);
      if (serviceSubtotal <= 0) return null;
      offer = buildPostBookingMembershipOffer(serviceSubtotal);
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
