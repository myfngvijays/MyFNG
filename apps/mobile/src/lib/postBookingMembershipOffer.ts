export const POST_BOOKING_MEMBERSHIP_OFFER_MINUTES = 180;
export const POST_BOOKING_MEMBERSHIP_OFFER_HOURS = Math.floor(
  POST_BOOKING_MEMBERSHIP_OFFER_MINUTES / 60,
);
export const POST_BOOKING_MEMBERSHIP_BUNDLE_MAX = 250;
export const DEFAULT_POST_BOOKING_MEMBERSHIP_CARD_TITLE = 'Keep your booking discount';
export const DEFAULT_POST_BOOKING_MEMBERSHIP_FOMO_MESSAGE =
  'Activate Prime before the timer ends - or your special booking price will be removed.';

export const MEMBERSHIP_OFFER_CARD_TITLE = DEFAULT_POST_BOOKING_MEMBERSHIP_CARD_TITLE;
export const MEMBERSHIP_OFFER_FOMO_MESSAGE = DEFAULT_POST_BOOKING_MEMBERSHIP_FOMO_MESSAGE;

export function membershipOfferFomoMessage(_saveAmount?: number, overrideMessage?: string): string {
  const text = String(overrideMessage || MEMBERSHIP_OFFER_FOMO_MESSAGE).trim();
  return text || MEMBERSHIP_OFFER_FOMO_MESSAGE;
}

function normalizeRupeeAmount(value: unknown, fallback = 699): number {
  const direct = Number(value);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const parsed = Number(String(value ?? '').replace(/[^\d.]/g, ''));
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return fallback;
}

export function resolveMembershipListPrice(
  plan?: { priceNum?: number; price?: unknown } | null,
  fallback = 699,
): number {
  const fromNum = Number(plan?.priceNum);
  if (Number.isFinite(fromNum) && fromNum > 0) return fromNum;
  return normalizeRupeeAmount(plan?.price, fallback);
}

export function formatMembershipPayable(amount: number): string {
  return `₹${Math.round(normalizeRupeeAmount(amount, 0)).toLocaleString('en-IN')}`;
}

export function membershipOfferCardTitle(overrideTitle?: string): string {
  const text = String(overrideTitle || MEMBERSHIP_OFFER_CARD_TITLE).trim();
  return text || MEMBERSHIP_OFFER_CARD_TITLE;
}

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
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}

export function parsePostBookingMembershipOfferFromOrder(order: any): PostBookingMembershipOfferStatus | null {
  if (!order || order.membership_claim?.benefit_code) return null;
  const meta = order.meta && typeof order.meta === 'object' ? order.meta : {};
  const bundle = (meta as any).booking_membership_bundle;
  if (bundle?.applied_at || bundle?.membership_id || bundle?.expired_at) return null;

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
    const expiresMs = createdMs + POST_BOOKING_MEMBERSHIP_OFFER_MINUTES * 60 * 1000;
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

export type MembershipOfferPayView = {
  offer: PostBookingMembershipOfferStatus;
  payable: number;
  saveAmount: number;
  listPrice: number;
};

export function resolveOrderDisplayAmount(order: any): number {
  const base = Number(order.amount_display || order.actual_amount || order.estimated_amount || 0);
  if (base <= 0) return 0;

  const activeDiscount = resolveOrderMembershipBundleDiscount(order);
  if (activeDiscount > 0) return base;

  const meta = order.meta && typeof order.meta === 'object' ? order.meta : {};
  const bundle = (meta as any).booking_membership_bundle;
  const storedDiscount = Number(bundle?.discount_amount || 0);
  if (storedDiscount <= 0) return base;

  const offer = resolveOrderMembershipOffer(order);
  const bundleExpired =
    Boolean(bundle?.expired_at) ||
    !offer ||
    !offer.active ||
    offer.expired;

  if (bundleExpired) {
    return Math.round((base + storedDiscount) * 100) / 100;
  }

  return base;
}

export function resolveOrderMembershipBundleDiscount(order: any): number {
  if (!order) return 0;
  const fromApi = Number(order.membership_bundle_discount || 0);
  if (fromApi > 0) return fromApi;

  const meta = order.meta && typeof order.meta === 'object' ? order.meta : {};
  const bundle = (meta as any).booking_membership_bundle;
  const raw = Number(bundle?.discount_amount || 0);
  if (raw <= 0) return 0;
  if (bundle?.applied_at || bundle?.membership_id) return raw;
  if (bundle?.expired_at) return 0;

  const offer = resolveOrderMembershipOffer(order);
  if (!offer?.active || offer.expired) return 0;
  return raw;
}

export function resolveOrderMembershipOffer(order: any): PostBookingMembershipOfferStatus | null {
  if (!order || order.membership_claim?.benefit_code) return null;
  const fromApi = order.post_booking_membership;
  if (fromApi?.expires_at) {
    return {
      expires_at: String(fromApi.expires_at),
      offered_at: String(fromApi.offered_at || fromApi.expires_at),
      service_subtotal: Number(fromApi.service_subtotal || 0),
      bundle_discount: Number(fromApi.bundle_discount || 0),
      active: Boolean(fromApi.active),
      expired: Boolean(fromApi.expired) || !fromApi.active,
    };
  }
  return parsePostBookingMembershipOfferFromOrder(order);
}

export function buildMembershipOfferPayView(
  order: any,
  membershipListPrice: number | { priceNum?: number; price?: unknown },
): MembershipOfferPayView | null {
  const offer = resolveOrderMembershipOffer(order);
  if (!offer || !offer.active) return null;
  const listPrice =
    typeof membershipListPrice === 'number'
      ? normalizeRupeeAmount(membershipListPrice)
      : resolveMembershipListPrice(membershipListPrice);
  const saveAmount = Number(offer.bundle_discount || 0);
  const payable = Math.max(0, listPrice - saveAmount);
  if (!Number.isFinite(payable) || payable <= 0) return null;
  return { offer, payable, saveAmount, listPrice };
}

export function findPendingMembershipOfferOrder(
  orders: any[],
  hasActiveMembership: boolean,
  membershipPlan?: { priceNum?: number; price?: unknown } | null,
): { order: any; offerPayView: MembershipOfferPayView } | null {
  if (hasActiveMembership || !Array.isArray(orders) || orders.length === 0) return null;
  const priceSource = membershipPlan ?? { priceNum: 699 };
  let best: { order: any; offerPayView: MembershipOfferPayView } | null = null;
  for (const order of orders) {
    const offerPayView = buildMembershipOfferPayView(order, priceSource);
    if (!offerPayView) continue;
    if (
      !best ||
      new Date(offerPayView.offer.expires_at).getTime() < new Date(best.offerPayView.offer.expires_at).getTime()
    ) {
      best = { order, offerPayView };
    }
  }
  return best;
}
