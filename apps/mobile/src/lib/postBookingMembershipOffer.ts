export const POST_BOOKING_MEMBERSHIP_OFFER_HOURS = 3;
export const POST_BOOKING_MEMBERSHIP_BUNDLE_MAX = 250;

function calcBundleDiscount(serviceSubtotal: number): number {
  if (serviceSubtotal <= 0) return 0;
  return Math.min(Math.round(serviceSubtotal * 0.05), POST_BOOKING_MEMBERSHIP_BUNDLE_MAX);
}

export type PostBookingMembershipOfferStatus = {
  expires_at: string;
  offered_at: string;
  service_subtotal: number;
  bundle_discount: number;
  active: boolean;
  expired: boolean;
};

export function formatOfferCountdown(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Offer expired';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

export function parsePostBookingMembershipOfferFromOrder(order: any): PostBookingMembershipOfferStatus | null {
  if (!order || order.membership_claim?.benefit_code) return null;
  const meta = order.meta && typeof order.meta === 'object' ? order.meta : {};
  const bundle = (meta as any).booking_membership_bundle;
  if (bundle?.applied_at || bundle?.membership_id) return null;

  const raw = (meta as any).post_booking_membership_offer;
  let offer: PostBookingMembershipOfferStatus | null = null;

  if (raw && typeof raw === 'object' && raw.expires_at) {
    offer = {
      expires_at: String(raw.expires_at),
      offered_at: String(raw.offered_at || raw.expires_at),
      service_subtotal: Number(raw.service_subtotal || 0),
      bundle_discount: Number(raw.bundle_discount || 0),
      active: new Date(String(raw.expires_at)).getTime() > Date.now(),
      expired: new Date(String(raw.expires_at)).getTime() <= Date.now(),
    };
  } else if (order.created_at) {
    const createdMs = new Date(order.created_at).getTime();
    const expiresMs = createdMs + POST_BOOKING_MEMBERSHIP_OFFER_HOURS * 60 * 60 * 1000;
    const estimated = Number(order.estimated_amount || order.amount_display || 0);
    const discount = Number(order.discount_amount || 0);
    const wallet = Number((meta as any).wallet_deduction || 0);
    const serviceSubtotal = Math.max(0, estimated + discount + wallet) || estimated;
    if (serviceSubtotal <= 0) return null;
    offer = {
      offered_at: String(order.created_at),
      expires_at: new Date(expiresMs).toISOString(),
      service_subtotal: serviceSubtotal,
      bundle_discount: Number(order.post_booking_membership?.bundle_discount || 0),
      active: expiresMs > Date.now(),
      expired: expiresMs <= Date.now(),
    };
  }

  if (!offer) return null;
  if (order.post_booking_membership?.bundle_discount && offer.bundle_discount <= 0) {
    offer.bundle_discount = Number(order.post_booking_membership.bundle_discount);
  }
  if (offer.bundle_discount <= 0 && offer.service_subtotal > 0) {
    offer.bundle_discount = calcBundleDiscount(offer.service_subtotal);
  }
  return offer;
}
