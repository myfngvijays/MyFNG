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

export function hasStoredPostBookingMembershipOffer(
  source:
    | {
        meta?: unknown;
        post_booking_membership?: { expires_at?: string | null; active?: boolean } | null;
      }
    | null
    | undefined,
): boolean {
  const fromApi = source?.post_booking_membership;
  if (fromApi?.active && String(fromApi.expires_at || '').trim()) return true;

  const meta = source?.meta && typeof source.meta === 'object' ? (source.meta as Record<string, unknown>) : {};
  const rawOffer = meta.post_booking_membership_offer;
  if (rawOffer && typeof rawOffer === 'object' && String((rawOffer as { expires_at?: string }).expires_at || '').trim()) {
    return true;
  }

  const bundle = meta.booking_membership_bundle;
  if (bundle && typeof bundle === 'object') {
    const record = bundle as Record<string, unknown>;
    if (!record.applied_at && !record.membership_id && Number(record.discount_amount || 0) > 0) {
      return true;
    }
  }

  return false;
}

/** Prefer server-stored offer expiry; return null when no offer was attached to the booking. */
export function resolveMembershipOfferExpiresAt(
  source:
    | {
        meta?: unknown;
        post_booking_membership?: { expires_at?: string | null } | null;
        created_at?: string | null;
      }
    | null
    | undefined,
  offerWindowMinutes = POST_BOOKING_MEMBERSHIP_OFFER_MINUTES,
): string | null {
  if (!hasStoredPostBookingMembershipOffer(source)) return null;

  const fromApi = String(source?.post_booking_membership?.expires_at || '').trim();
  if (fromApi) return fromApi;

  const meta = source?.meta && typeof source.meta === 'object' ? (source.meta as Record<string, unknown>) : {};
  const rawOffer = meta.post_booking_membership_offer;
  if (rawOffer && typeof rawOffer === 'object' && (rawOffer as { expires_at?: string }).expires_at) {
    return String((rawOffer as { expires_at?: string }).expires_at);
  }

  const windowMinutes =
    Number.isFinite(Number(offerWindowMinutes)) && Number(offerWindowMinutes) > 0
      ? Math.round(Number(offerWindowMinutes))
      : POST_BOOKING_MEMBERSHIP_OFFER_MINUTES;
  const createdAt = String(source?.created_at || '').trim();
  if (createdAt) {
    const createdMs = new Date(createdAt).getTime();
    if (Number.isFinite(createdMs)) {
      return new Date(createdMs + windowMinutes * 60 * 1000).toISOString();
    }
  }

  return null;
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

export function parsePostBookingMembershipOfferFromOrder(
  order: any,
  offerWindowMinutes = POST_BOOKING_MEMBERSHIP_OFFER_MINUTES,
): PostBookingMembershipOfferStatus | null {
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
  } else if (
    order.created_at &&
    bundle &&
    typeof bundle === 'object' &&
    !bundle.applied_at &&
    !bundle.membership_id &&
    Number(bundle.discount_amount || 0) > 0
  ) {
    const createdMs = new Date(order.created_at).getTime();
    const windowMinutes =
      Number.isFinite(Number(offerWindowMinutes)) && Number(offerWindowMinutes) > 0
        ? Math.round(Number(offerWindowMinutes))
        : POST_BOOKING_MEMBERSHIP_OFFER_MINUTES;
    const expiresMs = createdMs + windowMinutes * 60 * 1000;
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

export type MembershipOfferExpiredView = {
  orderId: string;
  leadNumber: string;
  lostBundleDiscount: number;
  currentPayable: number;
  serviceSubtotal: number;
  walletDeduction: number;
  expiredAt?: string | null;
};

export function buildMembershipOfferExpiredView(order: any): MembershipOfferExpiredView | null {
  if (!order || order.membership_claim?.benefit_code) return null;
  if (!isExpiredUnpaidOrderMembershipBundle(order)) return null;

  const lostBundleDiscount = resolveExpiredOrderMembershipBundleDiscount(order);
  if (lostBundleDiscount <= 0) return null;

  const meta = order.meta && typeof order.meta === 'object' ? order.meta : {};
  const bundle = (meta as any).booking_membership_bundle;
  const offer = resolveOrderMembershipOffer(order);
  const expiredAt =
    String(bundle?.expired_at || offer?.expires_at || '').trim() || null;

  return {
    orderId: String(order.id || ''),
    leadNumber: String(order.lead_number || order.id || ''),
    lostBundleDiscount,
    currentPayable: resolveOrderDisplayAmount(order),
    serviceSubtotal: deriveOrderServiceSubtotal(order),
    walletDeduction: resolveOrderWalletDeduction(order),
    expiredAt,
  };
}

export function membershipOfferExpiredTitle(): string {
  return 'Prime Offer Expired';
}

export function membershipOfferExpiredSubtitle(view: MembershipOfferExpiredView): string {
  const lost = Math.round(view.lostBundleDiscount).toLocaleString('en-IN');
  return `The limited-time booking discount of ₹${lost} is no longer applied.`;
}

export function membershipOfferExpiredMessage(view: MembershipOfferExpiredView): string {
  const lost = Math.round(view.lostBundleDiscount).toLocaleString('en-IN');
  const payable = Math.round(view.currentPayable).toLocaleString('en-IN');
  const wallet =
    view.walletDeduction > 0
      ? ` Your wallet credit of ₹${Math.round(view.walletDeduction).toLocaleString('en-IN')} remains applied.`
      : '';
  return `The limited-time Prime booking discount of ₹${lost} has been removed.${wallet} Your updated service amount is ₹${payable}. Activate Prime anytime to unlock member benefits on future bookings.`;
}

export function findRecentlyExpiredMembershipOfferOrder(
  orders: any[],
  hasActiveMembership: boolean,
): { order: any; expiredView: MembershipOfferExpiredView } | null {
  if (hasActiveMembership || !Array.isArray(orders) || orders.length === 0) return null;
  let best: { order: any; expiredView: MembershipOfferExpiredView; expiredMs: number } | null = null;
  for (const order of orders) {
    const expiredView = buildMembershipOfferExpiredView(order);
    if (!expiredView?.orderId) continue;
    const expiredMs = expiredView.expiredAt
      ? new Date(expiredView.expiredAt).getTime()
      : order.created_at
        ? new Date(order.created_at).getTime()
        : 0;
    if (!best || expiredMs > best.expiredMs) {
      best = { order, expiredView, expiredMs };
    }
  }
  return best ? { order: best.order, expiredView: best.expiredView } : null;
}

export function resolveOrderDisplayAmount(order: any): number {
  const base = Number(order.amount_display || order.actual_amount || order.estimated_amount || 0);
  if (base <= 0) return 0;

  const activeDiscount = resolveOrderMembershipBundleDiscount(order);
  if (activeDiscount > 0) return base;

  const meta = order.meta && typeof order.meta === 'object' ? order.meta : {};
  if (isExpiredUnpaidOrderMembershipBundle(order) && (meta as any).wallet_applied) {
    const serviceSubtotal = deriveOrderServiceSubtotal(order);
    const wallet = resolveOrderWalletDeduction(order);
    const discount = Number(order.discount_amount || 0);
    const bundle = (meta as any).booking_membership_bundle;
    const membershipDiscount = Number(bundle?.discount_amount || 0);
    const couponDiscount = Math.max(0, Math.round((discount - membershipDiscount) * 100) / 100);
    if (serviceSubtotal > 0) {
      return Math.max(0, Math.round((serviceSubtotal - couponDiscount - wallet) * 100) / 100);
    }
  }

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

function deriveOrderServiceSubtotal(order: any): number {
  const meta = order.meta && typeof order.meta === 'object' ? order.meta : {};
  if (Number((meta as any).service_subtotal || 0) > 0) {
    return Number((meta as any).service_subtotal);
  }

  const offer = resolveOrderMembershipOffer(order);
  if (offer?.service_subtotal && offer.service_subtotal > 0) return offer.service_subtotal;

  const bundle = (meta as any).booking_membership_bundle;
  if (Number(bundle?.service_subtotal || 0) > 0) return Number(bundle.service_subtotal);

  const estimated = Number(order.estimated_amount || order.amount_display || 0);
  const discount = Number(order.discount_amount || 0);
  const wallet = Number((meta as any).wallet_deduction || order.wallet_deduction || 0);
  const membershipDiscount = Number(bundle?.discount_amount || 0);
  const couponDiscount = Math.max(0, Math.round((discount - membershipDiscount) * 100) / 100);
  const unpaidLine = Number((meta as any).unpaid_membership_line_price || 0);

  if (unpaidLine > 0 && bundle?.include_membership) {
    const withoutLine = Math.round((estimated + wallet + couponDiscount - unpaidLine + membershipDiscount) * 100) / 100;
    if (withoutLine > 0) return withoutLine;
  }

  const serviceOnly = Math.round((estimated + wallet + couponDiscount) * 100) / 100;
  if (serviceOnly > 0) return serviceOnly;

  return Math.max(0, estimated);
}

function resolveExpiredOrderWalletOnServiceSubtotal(serviceSubtotal: number): number {
  if (serviceSubtotal <= 0) return 0;
  return Math.round(Math.min(serviceSubtotal, serviceSubtotal * 0.1) * 100) / 100;
}

function isExpiredUnpaidOrderMembershipBundle(order: any): boolean {
  const meta = order.meta && typeof order.meta === 'object' ? order.meta : {};
  const bundle = (meta as any).booking_membership_bundle;
  if (!bundle || bundle.applied_at || bundle.membership_id) return false;
  if (resolveOrderMembershipBundleDiscount(order) > 0) return false;
  const offer = resolveOrderMembershipOffer(order);
  return Boolean(bundle.expired_at) || !offer || !offer.active || offer.expired;
}

function resolveExpiredOrderMembershipBundleDiscount(order: any): number {
  const offer = resolveOrderMembershipOffer(order);
  if (offer?.bundle_discount && offer.bundle_discount > 0) return offer.bundle_discount;
  const meta = order.meta && typeof order.meta === 'object' ? order.meta : {};
  const rawOffer = (meta as any).post_booking_membership_offer;
  if (rawOffer && typeof rawOffer === 'object') {
    const fromOffer = Number(rawOffer.bundle_discount || 0);
    if (fromOffer > 0) return fromOffer;
  }
  const serviceSubtotal = deriveOrderServiceSubtotal(order);
  if (serviceSubtotal > 0) return calcBundleDiscount(serviceSubtotal);
  return 0;
}

export function resolveOrderWalletDeduction(order: any): number {
  const meta = order.meta && typeof order.meta === 'object' ? order.meta : {};
  const stored = Number((meta as any).wallet_deduction || order.wallet_deduction || 0);
  if (stored <= 0 || !(meta as any).wallet_applied) return stored;
  if (!isExpiredUnpaidOrderMembershipBundle(order)) return stored;

  const serviceSubtotal = deriveOrderServiceSubtotal(order);
  return resolveExpiredOrderWalletOnServiceSubtotal(serviceSubtotal);
}

export function resolveOrderMembershipOffer(
  order: any,
  offerWindowMinutes?: number,
): PostBookingMembershipOfferStatus | null {
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
  return parsePostBookingMembershipOfferFromOrder(order, offerWindowMinutes);
}

export function buildMembershipOfferPayView(
  order: any,
  membershipListPrice: number | { priceNum?: number; price?: unknown },
  offerWindowMinutes?: number,
): MembershipOfferPayView | null {
  const offer = resolveOrderMembershipOffer(order, offerWindowMinutes);
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
  offerWindowMinutes?: number,
): { order: any; offerPayView: MembershipOfferPayView } | null {
  if (hasActiveMembership || !Array.isArray(orders) || orders.length === 0) return null;
  const priceSource = membershipPlan ?? { priceNum: 699 };
  let best: { order: any; offerPayView: MembershipOfferPayView } | null = null;
  for (const order of orders) {
    const offerPayView = buildMembershipOfferPayView(order, priceSource, offerWindowMinutes);
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
