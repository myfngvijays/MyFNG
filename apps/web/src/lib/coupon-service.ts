import type { SupabaseClient } from '@supabase/supabase-js';
import {
  applyMaxDiscountCap,
  couponAppliesToChannel,
  normalizePhone,
  validateCouponScope,
  type CouponScopeContext,
} from './coupon-rules';

export type CouponLeadContext = CouponScopeContext & {
  subtotal?: number;
  service_type_ids?: string[];
  subservice_ids?: string[];
  custom_labels?: string[];
  service_items?: Array<{
    service_type_id?: string | null;
    subservice_id?: string | null;
    label?: string | null;
    price?: number | null;
  }>;
  customer_id?: string | null;
};

export type CouponValidationResult =
  | {
      valid: true;
      discountAmount: number;
      coupon: Record<string, unknown>;
      couponMeta: Record<string, unknown>;
    }
  | { valid: false; error: string };

function normalizeDiscountMode(mode: unknown): 'AMOUNT' | 'PERCENT' | null {
  const m = String(mode ?? '').trim().toUpperCase();
  if (!m) return null;
  if (m === 'AMOUNT' || m === 'FLAT' || m === 'FIXED' || m === 'VALUE') return 'AMOUNT';
  if (m === 'PERCENT' || m === 'PERCENTAGE' || m === 'PCT') return 'PERCENT';
  return null;
}

function parseDiscountFromDescription(desc: unknown): { mode: 'AMOUNT' | 'PERCENT' | null; value: number | null } {
  const s = String(desc ?? '').trim();
  if (!s) return { mode: null, value: null };
  const percentMatch = s.match(/(\d+(?:\.\d+)?)\s*%/);
  if (percentMatch) {
    const v = Number(percentMatch[1]);
    return { mode: 'PERCENT', value: Number.isFinite(v) ? v : null };
  }
  const numMatch = s.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) {
    const v = Number(numMatch[1]);
    return { mode: 'AMOUNT', value: Number.isFinite(v) ? v : null };
  }
  return { mode: null, value: null };
}

function findFreeServicePrice(coupon: any, context: CouponLeadContext) {
  const serviceTypeIds = new Set(context?.service_type_ids || []);
  const subserviceIds = new Set(context?.subservice_ids || []);
  const customLabels = new Set((context?.custom_labels || []).map((l) => String(l).toLowerCase()));
  const items = context?.service_items || [];

  const targetServiceTypeId = coupon?.target_service_type_id || null;
  const targetSubserviceId = coupon?.target_subservice_id || null;
  const targetCustomLabel = coupon?.target_custom_label || coupon?.description || null;

  let matched = false;
  let price = 0;
  let matchLabel: string | null = null;

  if (targetServiceTypeId && serviceTypeIds.has(targetServiceTypeId)) matched = true;
  if (targetSubserviceId && subserviceIds.has(targetSubserviceId)) matched = true;
  if (targetCustomLabel && customLabels.has(String(targetCustomLabel).toLowerCase())) {
    matched = true;
    matchLabel = targetCustomLabel;
  }

  if (!matched) return { matched: false, price: 0, matchLabel };

  for (const item of items) {
    if (targetServiceTypeId && item.service_type_id === targetServiceTypeId) {
      price = Number(item.price || 0);
      matchLabel = item.label || matchLabel;
      break;
    }
    if (targetSubserviceId && item.subservice_id === targetSubserviceId) {
      price = Number(item.price || 0);
      matchLabel = item.label || matchLabel;
      break;
    }
    if (
      targetCustomLabel &&
      item.label &&
      String(item.label).toLowerCase() === String(targetCustomLabel).toLowerCase()
    ) {
      price = Number(item.price || 0);
      matchLabel = item.label || matchLabel;
      break;
    }
  }

  return { matched: true, price, matchLabel };
}

async function customerHasAssignment(
  supabaseAdmin: SupabaseClient,
  couponId: string,
  customerId?: string | null,
  customerPhone?: string | null,
) {
  const { count: anyAssignment } = await supabaseAdmin
    .from('customer_coupon_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('coupon_id', couponId);

  if (!anyAssignment || anyAssignment === 0) return true;

  const phone = normalizePhone(customerPhone || null);

  let resolvedId = customerId || null;
  if (!resolvedId && phone) {
    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('id')
      .ilike('phone', `%${phone}`)
      .maybeSingle();
    resolvedId = customer?.id ? String(customer.id) : null;
  }

  if (resolvedId) {
    const { count } = await supabaseAdmin
      .from('customer_coupon_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('coupon_id', couponId)
      .eq('customer_id', resolvedId)
      .is('redeemed_at', null);
    if ((count || 0) > 0) return true;
  }

  // Also check pending (pre-registration) phone-based assignments
  if (phone) {
    const { count: pendingCount } = await supabaseAdmin
      .from('customer_coupon_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('coupon_id', couponId)
      .eq('pending_phone', phone)
      .is('customer_id', null)
      .is('redeemed_at', null);
    if ((pendingCount || 0) > 0) return true;
  }

  return false;
}

export async function validateCouponForCheckout(
  supabaseAdmin: SupabaseClient,
  code: string,
  leadContext: CouponLeadContext,
  options?: { membershipOnly?: boolean; serviceBooking?: boolean; reserveOnly?: boolean },
): Promise<CouponValidationResult> {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) return { valid: false, error: 'Coupon code is required.' };

  const nowIso = new Date().toISOString();
  const { data: coupon, error } = await supabaseAdmin
    .from('coupons')
    .select('*')
    .ilike('code', normalizedCode)
    .eq('is_active', true)
    .maybeSingle();

  if (!coupon || error) return { valid: false, error: 'Invalid or inactive coupon.' };

  if (coupon.start_at && String(coupon.start_at) > nowIso) {
    return { valid: false, error: 'Coupon is not active yet.' };
  }
  if (coupon.end_at && String(coupon.end_at) < nowIso) {
    return { valid: false, error: 'Coupon has expired.' };
  }

  const channel = leadContext.channel || (options?.membershipOnly ? 'MEMBERSHIP' : 'WEB');
  if (!couponAppliesToChannel(coupon, channel)) {
    return { valid: false, error: 'Coupon is not valid on this platform.' };
  }

  const scope = await validateCouponScope(supabaseAdmin, coupon, {
    ...leadContext,
    channel,
    service_type_ids: leadContext.service_type_ids || [],
  });
  if (!scope.ok) return { valid: false, error: scope.error };

  const assignedOk = await customerHasAssignment(supabaseAdmin, coupon.id, leadContext.customer_id, leadContext.customer_phone);
  if (!assignedOk) {
    return { valid: false, error: 'This coupon is not assigned to your account.' };
  }

  const subtotal = Number(leadContext?.subtotal || 0);
  const reserveOnly = Boolean(options?.reserveOnly);
  if (!reserveOnly && coupon.min_order_value && subtotal < Number(coupon.min_order_value || 0)) {
    return { valid: false, error: `Minimum order value is ₹${coupon.min_order_value}.` };
  }

  if (coupon.usage_limit_total) {
    const { count } = await supabaseAdmin
      .from('coupon_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('coupon_id', coupon.id);
    if ((count || 0) >= Number(coupon.usage_limit_total || 0)) {
      return { valid: false, error: 'Coupon usage limit reached.' };
    }
  }

  if (coupon.usage_limit_per_customer) {
    const customerPhone = normalizePhone(leadContext?.customer_phone || null);
    if (customerPhone) {
      const { count } = await supabaseAdmin
        .from('coupon_redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('coupon_id', coupon.id)
        .contains('meta', { customer_phone: customerPhone });
      if ((count || 0) >= Number(coupon.usage_limit_per_customer || 0)) {
        return { valid: false, error: 'Coupon already used by customer.' };
      }
    }
  }

  let discountAmount = 0;
  let freeServiceMeta: Record<string, unknown> | null = null;

  if (reserveOnly) {
    const couponMeta = {
      coupon_id: coupon.id,
      code: coupon.code,
      campaign_name: coupon.campaign_name || null,
      coupon_kind: coupon.coupon_kind,
      discount_mode: coupon.discount_mode ?? null,
      discount_value: coupon.discount_value ?? null,
      min_order_value: coupon.min_order_value,
      discount_amount: 0,
      computed_on_subtotal: subtotal,
      free_service: null,
      channel,
      reserved: true,
      validated_at: nowIso,
    };
    return {
      valid: true,
      discountAmount: 0,
      coupon,
      couponMeta,
    };
  }

  if (coupon.coupon_kind === 'TOTAL_DISCOUNT') {
    const derivedFromDesc = parseDiscountFromDescription(coupon.description);
    const discountMode =
      normalizeDiscountMode(coupon.discount_mode) ||
      normalizeDiscountMode((coupon as any).mode) ||
      derivedFromDesc.mode;
    const discountValueRaw =
      coupon.discount_value ?? (coupon as any).value ?? derivedFromDesc.value;
    const discountValue = Number(discountValueRaw);

    if (!discountMode || !Number.isFinite(discountValue) || discountValue <= 0 || subtotal <= 0) {
      return { valid: false, error: 'Invalid discount configuration.' };
    }
    if (discountMode === 'AMOUNT') {
      discountAmount = Math.min(discountValue, subtotal);
    } else {
      discountAmount = (subtotal * discountValue) / 100;
      discountAmount = applyMaxDiscountCap(discountAmount, coupon);
    }
  } else if (coupon.coupon_kind === 'FREE_SERVICE') {
    if (options?.membershipOnly) {
      return { valid: false, error: 'This coupon is not applicable to membership checkout.' };
    }
    const hasTarget = coupon.target_service_type_id || coupon.target_subservice_id || coupon.target_custom_label;
    if (hasTarget) {
      const freeService = findFreeServicePrice(coupon, leadContext);
      if (!freeService.matched) {
        return { valid: false, error: 'Coupon is not applicable to selected services.' };
      }
      discountAmount = Math.max(0, Number(freeService.price || 0));
      freeServiceMeta = {
        target_service_type_id: coupon.target_service_type_id || null,
        target_subservice_id: coupon.target_subservice_id || null,
        target_custom_label: coupon.target_custom_label || coupon.description || null,
        matched_label: freeService.matchLabel || null,
        original_price: freeService.price || 0,
      };
    } else {
      discountAmount = 0;
      freeServiceMeta = {
        target_service_type_id: null,
        target_subservice_id: null,
        target_custom_label: coupon.description || null,
        matched_label: null,
        original_price: 0,
      };
    }
  } else {
    return { valid: false, error: 'Unsupported coupon type.' };
  }

  const couponMeta = {
    coupon_id: coupon.id,
    code: coupon.code,
    campaign_name: coupon.campaign_name || null,
    coupon_kind: coupon.coupon_kind,
    discount_mode: coupon.discount_mode ?? null,
    discount_value: coupon.discount_value ?? null,
    min_order_value: coupon.min_order_value,
    discount_amount: Number(discountAmount || 0),
    computed_on_subtotal: subtotal,
    free_service: freeServiceMeta,
    channel,
    validated_at: nowIso,
  };

  return {
    valid: true,
    discountAmount: Number(discountAmount || 0),
    coupon,
    couponMeta,
  };
}

export async function redeemCouponAtomic(
  supabaseAdmin: SupabaseClient,
  params: {
    couponId: string;
    customerPhone?: string | null;
    discountAmount?: number;
    appliedByRole?: string;
    appliedByUserId?: string | null;
    serviceLeadId?: string | null;
    invoiceId?: string | null;
    meta?: Record<string, unknown>;
    idempotencyKey?: string | null;
  },
) {
  const { data, error } = await supabaseAdmin.rpc('redeem_coupon_atomic', {
    p_coupon_id: params.couponId,
    p_customer_phone: params.customerPhone || null,
    p_discount_amount: Number(params.discountAmount || 0),
    p_applied_by_role: params.appliedByRole || 'CUSTOMER',
    p_applied_by_user_id: params.appliedByUserId || null,
    p_service_lead_id: params.serviceLeadId || null,
    p_invoice_id: params.invoiceId || null,
    p_meta: params.meta || {},
    p_idempotency_key: params.idempotencyKey || null,
  });

  if (error) {
    return { success: false as const, error: error.message || 'Redemption failed' };
  }

  const result = data as { success?: boolean; error?: string; duplicate?: boolean; redemption_id?: string };
  if (!result?.success) {
    return { success: false as const, error: result?.error || 'Redemption failed' };
  }

  return {
    success: true as const,
    duplicate: Boolean(result.duplicate),
    redemptionId: result.redemption_id || null,
  };
}

export async function recordCouponRedemption(
  supabaseAdmin: SupabaseClient,
  params: {
    couponId: string;
    customerPhone?: string | null;
    discountAmount?: number;
    appliedByRole?: string;
    appliedByUserId?: string | null;
    serviceLeadId?: string | null;
    invoiceId?: string | null;
    meta?: Record<string, unknown>;
    idempotencyKey?: string | null;
  },
) {
  const redeemed = await redeemCouponAtomic(supabaseAdmin, params);
  if (!redeemed.success) {
    throw new Error(redeemed.error);
  }
  return redeemed;
}

export { normalizePhone };
