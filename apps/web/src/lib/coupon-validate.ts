import type { SupabaseClient } from '@supabase/supabase-js';

type CouponLeadContext = {
  subtotal?: number;
  customer_phone?: string | null;
  service_items?: Array<{ label?: string | null; price?: number | null }>;
};

function normalizePhone(phone: string | null | undefined) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '').slice(-10);
  return digits || null;
}

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

export type CouponValidationResult =
  | {
      valid: true;
      discountAmount: number;
      coupon: Record<string, unknown>;
      couponMeta: Record<string, unknown>;
    }
  | { valid: false; error: string };

export async function validateCouponForCheckout(
  supabaseAdmin: SupabaseClient,
  code: string,
  leadContext: CouponLeadContext,
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

  const subtotal = Number(leadContext?.subtotal || 0);
  if (coupon.min_order_value && subtotal < Number(coupon.min_order_value || 0)) {
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
  if (coupon.coupon_kind === 'TOTAL_DISCOUNT') {
    const derivedFromDesc = parseDiscountFromDescription(coupon.description);
    const discountMode =
      normalizeDiscountMode(coupon.discount_mode) ||
      normalizeDiscountMode((coupon as any).mode) ||
      normalizeDiscountMode((coupon as any).discount_type) ||
      derivedFromDesc.mode;
    const discountValueRaw =
      coupon.discount_value ??
      (coupon as any).value ??
      (coupon as any).amount ??
      (coupon as any).discount ??
      derivedFromDesc.value;
    const discountValue = Number(discountValueRaw);

    if (!discountMode || !Number.isFinite(discountValue) || discountValue <= 0 || subtotal <= 0) {
      return { valid: false, error: 'Invalid discount configuration.' };
    }
    if (discountMode === 'AMOUNT') {
      discountAmount = Math.min(discountValue, subtotal);
    } else {
      discountAmount = (subtotal * discountValue) / 100;
    }
  } else {
    return { valid: false, error: 'This coupon is not applicable to membership checkout.' };
  }

  const couponMeta = {
    coupon_id: coupon.id,
    code: coupon.code,
    coupon_kind: coupon.coupon_kind,
    discount_mode: coupon.discount_mode ?? null,
    discount_value: coupon.discount_value ?? null,
    min_order_value: coupon.min_order_value,
    discount_amount: Number(discountAmount || 0),
    computed_on_subtotal: subtotal,
    validated_at: nowIso,
  };

  return {
    valid: true,
    discountAmount: Number(discountAmount || 0),
    coupon,
    couponMeta,
  };
}

export async function recordCouponRedemption(
  supabaseAdmin: SupabaseClient,
  params: {
    couponId: string;
    customerPhone?: string | null;
    meta?: Record<string, unknown>;
  },
) {
  const phone = normalizePhone(params.customerPhone || null);
  await supabaseAdmin.from('coupon_redemptions').insert({
    coupon_id: params.couponId,
    meta: {
      customer_phone: phone,
      ...(params.meta || {}),
    },
  });
}
