import {
  calculateBundleDiscountWithConfig,
  DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG,
  type PostBookingMembershipConfig,
} from '@/lib/post-booking-membership-config';
import {
  calculateMaxWalletUsageWithConfig,
  reconcileBookingWalletOnMembershipExpiry,
  resolveCustomerIdFromLead,
  resolveWalletDeduction,
} from '@/lib/wallet-service';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

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

function resolvePureServiceSubtotalFromLead(
  lead: Record<string, unknown>,
  config: PostBookingMembershipConfig = DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG,
): number {
  const meta = parseMetaObject(lead.meta);
  const offer = parsePostBookingMembershipOffer(meta, config);
  if (offer?.service_subtotal && offer.service_subtotal > 0) return offer.service_subtotal;

  if (Number(meta.service_subtotal || 0) > 0) return Number(meta.service_subtotal);

  const bundle = meta.booking_membership_bundle as Record<string, unknown> | undefined;
  if (Number(bundle?.service_subtotal || 0) > 0) return Number(bundle.service_subtotal);

  const estimated = Number(lead.estimated_amount || 0);
  const walletDeduction = Number(meta.wallet_deduction || 0);
  const couponDiscount = resolveServiceLeadCouponDiscount(lead, config);
  const bundleDiscount = Number(bundle?.discount_amount || 0);
  const unpaidLine = Number(meta.unpaid_membership_line_price || 0);

  if (unpaidLine > 0 && bundle?.include_membership) {
    const withoutLine = roundMoney(
      estimated + walletDeduction + couponDiscount - unpaidLine + bundleDiscount,
    );
    if (withoutLine > 0) return withoutLine;
  }

  const serviceOnly = roundMoney(estimated + walletDeduction + couponDiscount);
  if (serviceOnly > 0) return serviceOnly;

  return roundMoney(estimated + walletDeduction + couponDiscount + bundleDiscount);
}

/** @deprecated alias */
function deriveServiceSubtotalFromLead(
  lead: Record<string, unknown>,
  config: PostBookingMembershipConfig = DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG,
): number {
  return resolvePureServiceSubtotalFromLead(lead, config);
}

async function loadPureServiceSubtotalFromLead(
  supabaseAdmin: any,
  lead: Record<string, unknown>,
  config: PostBookingMembershipConfig = DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG,
): Promise<number> {
  const fromLead = resolvePureServiceSubtotalFromLead(lead, config);
  const meta = parseMetaObject(lead.meta);
  if (Number(meta.service_subtotal || 0) > 0) return fromLead;
  if (parsePostBookingMembershipOffer(meta, config)?.service_subtotal) return fromLead;

  const leadId = String(lead.id || '').trim();
  const customerId =
    String(meta.customer_id || '').trim() ||
    (await resolveCustomerIdFromLead(
      supabaseAdmin,
      lead as { customer_id?: string | null; customer_phone?: string | null },
    )) ||
    '';

  if (leadId && customerId) {
    const { data: tx } = await supabaseAdmin
      .from('wallet_transactions')
      .select('metadata')
      .eq('customer_id', customerId)
      .eq('idempotency_key', `booking:${leadId}`)
      .maybeSingle();
    const fromTx = Number((tx?.metadata as Record<string, unknown> | undefined)?.subtotal || 0);
    if (fromTx > 0) return fromTx;
  }

  return fromLead;
}

/** After Prime expires unpaid: wallet = flat service usage (10%) on full service amount. */
export function resolveExpiredBookingWalletOnServiceSubtotal(
  serviceSubtotal: number,
  spendableBalance = serviceSubtotal,
): number {
  if (serviceSubtotal <= 0) return 0;
  return calculateMaxWalletUsageWithConfig(
    serviceSubtotal,
    spendableBalance,
    'SERVICE',
    DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG,
  );
}

function isExpiredUnpaidMembershipBundle(
  lead: Record<string, unknown>,
  config: PostBookingMembershipConfig = DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG,
): boolean {
  const meta = parseMetaObject(lead.meta);
  const bundle = meta.booking_membership_bundle as Record<string, unknown> | undefined;
  if (!bundle || bundle.applied_at || bundle.membership_id) return false;
  if (resolveActiveMembershipBundleDiscount(lead, config) > 0) return false;

  const offerStatus = resolvePostBookingMembershipOfferStatus(lead, config);
  return (
    Boolean(bundle.expired_at) ||
    wasRevokedByAdmin(meta) ||
    !offerStatus ||
    !offerStatus.active ||
    offerStatus.expired
  );
}

function resolveExpiredMembershipBundleDiscount(
  lead: Record<string, unknown>,
  config: PostBookingMembershipConfig = DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG,
): number {
  const meta = parseMetaObject(lead.meta);
  const offer = parsePostBookingMembershipOffer(meta, config);
  if (offer?.bundle_discount && offer.bundle_discount > 0) return offer.bundle_discount;

  const rawOffer = meta.post_booking_membership_offer;
  if (rawOffer && typeof rawOffer === 'object') {
    const fromOffer = Number((rawOffer as Record<string, unknown>).bundle_discount || 0);
    if (fromOffer > 0) return fromOffer;
  }

  const serviceSubtotal = deriveServiceSubtotalFromLead(lead);
  if (serviceSubtotal > 0) return bundleDiscountForSubtotal(serviceSubtotal, config);
  return 0;
}

/** When Prime timer expires, wallet must be recalculated as flat % on full service amount. */
export function resolveDisplayWalletDeduction(
  lead: Record<string, unknown>,
  config: PostBookingMembershipConfig = DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG,
): number {
  const meta = parseMetaObject(lead.meta);
  const stored = Number(meta.wallet_deduction || 0);
  if (stored <= 0 || !meta.wallet_applied) return stored;
  if (!isExpiredUnpaidMembershipBundle(lead, config)) return stored;

  const serviceSubtotal = resolvePureServiceSubtotalFromLead(lead, config);
  return resolveExpiredBookingWalletOnServiceSubtotal(serviceSubtotal);
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
  if (isExpiredUnpaidMembershipBundle(lead, config) && meta.wallet_applied) {
    const serviceSubtotal = resolvePureServiceSubtotalFromLead(lead, config);
    const wallet = resolveDisplayWalletDeduction(lead, config);
    const couponDiscount = resolveServiceLeadCouponDiscount(lead, config);
    if (serviceSubtotal > 0) {
      return Math.max(0, roundMoney(serviceSubtotal - couponDiscount - wallet));
    }
  }

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
    return roundMoney(amount + storedDiscount);
  }

  return amount;
}

type ExpiredMembershipBookingPricing = {
  serviceSubtotal: number;
  bundleDiscount: number;
  oldWalletDeduction: number;
  newWalletDeduction: number;
  newEstimated: number;
  newDiscount: number;
  customerId: string | null;
};

async function computeExpiredMembershipBookingPricing(
  supabaseAdmin: any,
  lead: Record<string, unknown>,
  config: PostBookingMembershipConfig = DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG,
): Promise<ExpiredMembershipBookingPricing> {
  const meta = parseMetaObject(lead.meta);
  const bundle = meta.booking_membership_bundle as Record<string, unknown> | undefined;
  const bundleDiscount = Number(bundle?.discount_amount || 0);
  const walletDeduction = Number(meta.wallet_deduction || 0);
  const discount = Number(lead.discount_amount || 0);
  const serviceSubtotal = await loadPureServiceSubtotalFromLead(supabaseAdmin, lead, config);
  const couponDiscount = resolveServiceLeadCouponDiscount(lead, config);

  let newWalletDeduction = walletDeduction;
  if (serviceSubtotal > 0) {
    const customerId =
      String(meta.customer_id || '').trim() ||
      (await resolveCustomerIdFromLead(
        supabaseAdmin,
        lead as { customer_id?: string | null; customer_phone?: string | null },
      )) ||
      '';
    const flatWallet = resolveExpiredBookingWalletOnServiceSubtotal(serviceSubtotal);
    if (customerId) {
      try {
        const resolved = await resolveWalletDeduction(
          supabaseAdmin,
          customerId,
          serviceSubtotal,
          'SERVICE',
          true,
          String(lead.vehicle_number || '').trim() || null,
          'web',
        );
        if (!resolved.blocked && resolved.deduction > 0) {
          newWalletDeduction = resolved.deduction;
        } else {
          newWalletDeduction = flatWallet;
        }
      } catch {
        newWalletDeduction = flatWallet;
      }
    } else {
      newWalletDeduction = flatWallet;
    }
  }

  const customerId =
    String(meta.customer_id || '').trim() ||
    (await resolveCustomerIdFromLead(
      supabaseAdmin,
      lead as { customer_id?: string | null; customer_phone?: string | null },
    )) ||
    null;

  return {
    serviceSubtotal,
    bundleDiscount,
    oldWalletDeduction: walletDeduction,
    newWalletDeduction,
    newEstimated: Math.max(0, roundMoney(serviceSubtotal - couponDiscount - newWalletDeduction)),
    newDiscount: bundleDiscount > 0 ? Math.max(0, roundMoney(discount - bundleDiscount)) : discount,
    customerId,
  };
}

async function resolveExpiredUnpaidMembershipBookingPricing(
  supabaseAdmin: any,
  lead: Record<string, unknown>,
  config: PostBookingMembershipConfig = DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG,
): Promise<ExpiredMembershipBookingPricing | null> {
  const meta = parseMetaObject(lead.meta);
  const bundle = meta.booking_membership_bundle as Record<string, unknown> | undefined;
  const hasOfferMeta = Boolean(meta.post_booking_membership_offer);
  if (!bundle && !hasOfferMeta) return null;
  if (bundle?.applied_at || bundle?.membership_id) return null;

  const offerStatus = resolvePostBookingMembershipOfferStatus(lead, config);
  const alreadyExpired = Boolean(bundle?.expired_at) || isMembershipBundleExpired(meta);
  if (!alreadyExpired && offerStatus?.active) return null;

  return computeExpiredMembershipBookingPricing(supabaseAdmin, lead, config);
}

export async function expireUnpaidBookingMembershipBundleIfNeeded(
  supabaseAdmin: any,
  lead: Record<string, unknown>,
  config: PostBookingMembershipConfig = DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG,
): Promise<void> {
  const meta = parseMetaObject(lead.meta);
  const bundle = meta.booking_membership_bundle as Record<string, unknown> | undefined;
  const hasOfferMeta = Boolean(meta.post_booking_membership_offer);
  if (!bundle && !hasOfferMeta) return;

  const pricing = await resolveExpiredUnpaidMembershipBookingPricing(supabaseAdmin, lead, config);
  if (!pricing) return;

  const alreadyExpired = Boolean(bundle?.expired_at) || isMembershipBundleExpired(meta);
  const estimated = Number(lead.estimated_amount || 0);
  const walletDeduction = Number(meta.wallet_deduction || 0);
  const needsLeadUpdate =
    !alreadyExpired ||
    Math.abs(estimated - pricing.newEstimated) > 0.01 ||
    Math.abs(walletDeduction - pricing.newWalletDeduction) > 0.01;
  const needsWalletReconcile =
    pricing.oldWalletDeduction > 0 &&
    Math.abs(pricing.newWalletDeduction - pricing.oldWalletDeduction) > 0.01;

  if (!needsLeadUpdate && !needsWalletReconcile) return;

  const leadId = String(lead.id || '').trim();
  if (!leadId) return;

  if (needsWalletReconcile && pricing.customerId) {
    const walletMeta =
      meta.wallet_transaction_metadata && typeof meta.wallet_transaction_metadata === 'object'
        ? (meta.wallet_transaction_metadata as Record<string, unknown>)
        : {};
    const serviceLabel = String(walletMeta.service_name || walletMeta.label || '').trim() || null;
    await reconcileBookingWalletOnMembershipExpiry(supabaseAdmin, {
      customerId: pricing.customerId,
      leadId,
      targetDeduction: pricing.newWalletDeduction,
      serviceSubtotal: pricing.serviceSubtotal,
      serviceLabel,
    });
  }

  const expiredAt =
    String(bundle?.expired_at || '').trim() ||
    String(
      typeof meta.post_booking_membership_offer === 'object'
        ? (meta.post_booking_membership_offer as Record<string, unknown>).expired_at || ''
        : '',
    ).trim() ||
    new Date().toISOString();

  const newMeta: Record<string, unknown> = {
    ...meta,
    booking_membership_bundle: bundle
      ? {
          ...bundle,
          include_membership: false,
          discount_amount: 0,
          expired_at: expiredAt,
          service_subtotal: pricing.serviceSubtotal,
        }
      : bundle,
    post_booking_membership_offer: hasOfferMeta
      ? {
          ...(typeof meta.post_booking_membership_offer === 'object'
            ? (meta.post_booking_membership_offer as Record<string, unknown>)
            : {}),
          expired_at: expiredAt,
        }
      : meta.post_booking_membership_offer,
  };
  if (pricing.newWalletDeduction > 0) {
    newMeta.wallet_deduction = pricing.newWalletDeduction;
    newMeta.wallet_applied = true;
  }
  newMeta.service_subtotal = pricing.serviceSubtotal;
  newMeta.unpaid_membership_line_price = null;

  const { error } = await supabaseAdmin
    .from('service_leads')
    .update({
      estimated_amount: pricing.newEstimated,
      actual_amount: pricing.newEstimated,
      discount_amount: pricing.newDiscount,
      meta: newMeta,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId);

  if (error) {
    console.error('[expireUnpaidBookingMembershipBundleIfNeeded]', error.message);
    return;
  }

  lead.estimated_amount = pricing.newEstimated;
  lead.actual_amount = pricing.newEstimated;
  lead.discount_amount = pricing.newDiscount;
  lead.meta = newMeta;
}

function hasUnpaidBookingMembershipBundle(meta: Record<string, unknown>): boolean {
  const bundle = meta.booking_membership_bundle;
  if (!bundle || typeof bundle !== 'object') return false;
  const record = bundle as Record<string, unknown>;
  if (record.applied_at || record.membership_id) return false;
  return Number(record.discount_amount || 0) > 0;
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
    // Only reconstruct an offer for bookings that received an unpaid membership bundle
    // discount at checkout. Prime members and plain bookings must not get a synthetic offer.
    if (!hasUnpaidBookingMembershipBundle(meta)) return null;

    const createdAt = String(lead.created_at || '').trim();
    if (!createdAt) return null;
    const createdMs = new Date(createdAt).getTime();
    if (!Number.isFinite(createdMs)) return null;
    const expiresMs = createdMs + config.offer_window_minutes * 60 * 1000;
    const serviceSubtotal = deriveServiceSubtotalFromLead(lead);
    if (serviceSubtotal <= 0) return null;
    if (expiresMs <= Date.now()) {
      offer = {
        offered_at: createdAt,
        expires_at: new Date(expiresMs).toISOString(),
        service_subtotal: serviceSubtotal,
        bundle_discount: bundleDiscountForSubtotal(serviceSubtotal, config),
      };
    } else {
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

function resolveAdminBookingAmount(
  lead: Record<string, unknown>,
  config: PostBookingMembershipConfig = DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG,
): number {
  const display = resolveLeadAmountDisplay(lead, config);
  if (display > 0) return display;
  return Number(lead.estimated_amount || lead.actual_amount || 0);
}

function resolveAdminWalletDeduction(
  lead: Record<string, unknown>,
  config: PostBookingMembershipConfig = DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG,
): number {
  const meta = parseMetaObject(lead.meta);
  const stored = meta.wallet_applied ? Number(meta.wallet_deduction || 0) : 0;
  if (stored > 0) return stored;
  return resolveDisplayWalletDeduction(lead, config);
}

/** Payable amount shown in admin booking/lead lists (service − coupon − Prime − wallet [+ unpaid membership line]). */
export function resolveAdminBookingPayableAmount(
  lead: Record<string, unknown>,
  config: PostBookingMembershipConfig = DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG,
): number {
  const invoiceAmount = Number(lead.invoice_amount || 0);
  if (invoiceAmount > 0) return invoiceAmount;

  const actual = Number(lead.actual_amount || 0);
  const estimated = Number(lead.estimated_amount || 0);
  const storedPayable = actual > 0 ? actual : estimated;
  const meta = parseMetaObject(lead.meta);
  const serviceSubtotal = resolvePureServiceSubtotalFromLead(lead, config);
  if (serviceSubtotal <= 0) {
    return storedPayable;
  }

  const couponDiscount = resolveServiceLeadCouponDiscount(lead, config);
  const membershipDiscount = resolveActiveMembershipBundleDiscount(lead, config);
  const wallet = resolveAdminWalletDeduction(lead, config);
  let payable = roundMoney(serviceSubtotal - couponDiscount - membershipDiscount - wallet);

  const unpaidLine = Number(meta.unpaid_membership_line_price || 0);
  const bundle = meta.booking_membership_bundle as Record<string, unknown> | undefined;
  if (
    unpaidLine > 0 &&
    bundle?.include_membership &&
    !isExpiredUnpaidMembershipBundle(lead, config)
  ) {
    payable = roundMoney(payable + unpaidLine);
  }

  return Math.max(0, payable);
}

/** Apply expiry + display pricing fields for admin lead lists (matches customer app). */
export function enrichServiceLeadPricingForAdmin(
  lead: Record<string, unknown>,
  config: PostBookingMembershipConfig = DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG,
): Record<string, unknown> {
  const payable = resolveAdminBookingPayableAmount(lead, config);
  return {
    ...lead,
    amount_display: payable,
    wallet_deduction_display: resolveDisplayWalletDeduction(lead, config),
  };
}

export async function syncServiceLeadMembershipPricingForAdmin(
  supabaseAdmin: any,
  lead: Record<string, unknown>,
  config: PostBookingMembershipConfig = DEFAULT_POST_BOOKING_MEMBERSHIP_CONFIG,
): Promise<Record<string, unknown>> {
  await expireUnpaidBookingMembershipBundleIfNeeded(supabaseAdmin, lead, config);
  return enrichServiceLeadPricingForAdmin(lead, config);
}

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
        bundle_discount: 0,
        service_subtotal: deriveServiceSubtotalFromLead(lead),
        membership_payable: null,
        booking_amount: resolveAdminBookingAmount(lead, config),
      };
    }
    return null;
  }

  const bundleDiscount = Number(offerStatus.bundle_discount || bundle?.discount_amount || 0);
  const offerActive = offerStatus.active;
  return {
    lead_id: String(lead.id || ''),
    lead_number: String(lead.lead_number || lead.id || ''),
    customer_name: String(lead.customer_name || ''),
    customer_phone: String(lead.customer_phone || ''),
    vehicle_number: String(lead.vehicle_number || ''),
    created_at: String(lead.created_at || ''),
    lead_status: String(lead.status || ''),
    offer_status: offerActive ? 'active' : 'expired',
    expires_at: offerStatus.expires_at,
    bundle_discount: offerActive ? bundleDiscount : 0,
    service_subtotal: Number(offerStatus.service_subtotal || deriveServiceSubtotalFromLead(lead)),
    membership_payable: offerActive ? Math.max(0, membershipListPrice - bundleDiscount) : null,
    booking_amount: resolveAdminBookingAmount(lead, config),
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

  const leads = (data || []) as Record<string, unknown>[];
  await Promise.all(
    leads.map((lead) => expireUnpaidBookingMembershipBundleIfNeeded(supabaseAdmin, lead, config)),
  );

  const rows: PostBookingMembershipAdminRow[] = [];
  for (const lead of leads) {
    const row = resolvePostBookingMembershipAdminRow(lead, config, membershipListPrice);
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
  const pricing = await computeExpiredMembershipBookingPricing(supabaseAdmin, leadRecord, config);

  if (
    pricing.oldWalletDeduction > 0 &&
    pricing.newWalletDeduction > 0 &&
    Math.abs(pricing.newWalletDeduction - pricing.oldWalletDeduction) > 0.01 &&
    pricing.customerId
  ) {
    await reconcileBookingWalletOnMembershipExpiry(supabaseAdmin, {
      customerId: pricing.customerId,
      leadId: id,
      targetDeduction: pricing.newWalletDeduction,
      serviceSubtotal: pricing.serviceSubtotal,
    });
  }

  const newMeta: Record<string, unknown> = {
    ...meta,
    revoked_by_admin_at: revokedAt,
    revoked_by_admin_id: adminUserId || null,
    booking_membership_bundle: bundle
      ? {
          ...bundle,
          include_membership: false,
          discount_amount: 0,
          expired_at: revokedAt,
          revoked_by_admin_at: revokedAt,
          service_subtotal: pricing.serviceSubtotal,
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
  if (pricing.newWalletDeduction > 0) {
    newMeta.wallet_deduction = pricing.newWalletDeduction;
    newMeta.wallet_applied = true;
  }
  newMeta.service_subtotal = pricing.serviceSubtotal;
  newMeta.unpaid_membership_line_price = null;

  const { error: updateError } = await supabaseAdmin
    .from('service_leads')
    .update({
      estimated_amount: pricing.newEstimated,
      actual_amount: pricing.newEstimated,
      discount_amount: pricing.newDiscount,
      meta: newMeta,
      updated_at: revokedAt,
    })
    .eq('id', id);

  if (updateError) throw new Error(updateError.message || 'Could not revoke offer');
}
