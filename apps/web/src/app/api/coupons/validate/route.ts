import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

type ValidatePayload = {
  code?: string;
  lead_context?: {
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
    customer_phone?: string | null;
  };
};

function parseBodyText(text: string): ValidatePayload | null {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as ValidatePayload;
  } catch {
    // ignore
  }
  try {
    const params = new URLSearchParams(trimmed);
    if (params.has('code') || params.has('lead_context')) {
      let leadContext: ValidatePayload['lead_context'] | undefined = undefined;
      const leadContextRaw = params.get('lead_context');
      if (leadContextRaw) {
        try {
          leadContext = JSON.parse(leadContextRaw);
        } catch {
          // ignore
        }
      }
      return {
        code: params.get('code') || undefined,
        lead_context: leadContext,
      };
    }
  } catch {
    // ignore
  }
  return { code: trimmed };
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function normalizePhone(phone: string | null | undefined) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '').slice(-10);
  return digits || null;
}

function getNowIso() {
  return new Date().toISOString();
}

function normalizeDiscountMode(mode: any): 'AMOUNT' | 'PERCENT' | null {
  const m = String(mode ?? '').trim().toUpperCase();
  if (!m) return null;
  if (m === 'AMOUNT' || m === 'FLAT' || m === 'FIXED' || m === 'VALUE') return 'AMOUNT';
  if (m === 'PERCENT' || m === 'PERCENTAGE' || m === 'PCT') return 'PERCENT';
  return null;
}

function parseDiscountFromDescription(desc: any): { mode: 'AMOUNT' | 'PERCENT' | null; value: number | null } {
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

function findFreeServicePrice(
  coupon: any,
  context: ValidatePayload['lead_context']
) {
  const serviceTypeIds = new Set(context?.service_type_ids || []);
  const subserviceIds = new Set(context?.subservice_ids || []);
  const customLabels = new Set((context?.custom_labels || []).map((l) => String(l).toLowerCase()));
  const items = context?.service_items || [];

  const targetServiceTypeId = coupon?.target_service_type_id || null;
  const targetSubserviceId = coupon?.target_subservice_id || null;
  const targetCustomLabel = coupon?.target_custom_label || null;

  let matched = false;
  let price = 0;
  let matchLabel: string | null = null;

  if (targetServiceTypeId && serviceTypeIds.has(targetServiceTypeId)) {
    matched = true;
  }
  if (targetSubserviceId && subserviceIds.has(targetSubserviceId)) {
    matched = true;
  }
  if (targetCustomLabel && customLabels.has(String(targetCustomLabel).toLowerCase())) {
    matched = true;
    matchLabel = targetCustomLabel;
  }

  if (!matched) {
    return { matched: false, price: 0, matchLabel };
  }

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
    if (targetCustomLabel && item.label && String(item.label).toLowerCase() === String(targetCustomLabel).toLowerCase()) {
      price = Number(item.price || 0);
      matchLabel = item.label || matchLabel;
      break;
    }
  }

  return { matched: true, price, matchLabel };
}

export async function POST(request: NextRequest) {
  try {
    const requestClone = request.clone();
    const body = (await request
      .json()
      .catch(async () => parseBodyText(await requestClone.text().catch(() => '')) || {})) as ValidatePayload;
    const codeRaw = String(body?.code || request.nextUrl.searchParams.get('code') || '').trim();
    if (!codeRaw) {
      return NextResponse.json({ valid: false, error: 'Coupon code is required.' }, { status: 200 });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ valid: false, error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const code = normalizeCode(codeRaw);
    const nowIso = getNowIso();

    const { data: coupon, error } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .ilike('code', code)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !coupon) {
      return NextResponse.json({ valid: false, error: 'Invalid or inactive coupon.' }, { status: 200 });
    }

    const baseCoupon = {
      id: coupon.id,
      code: coupon.code,
      coupon_kind: coupon.coupon_kind,
      discount_mode: coupon.discount_mode,
      discount_value: coupon.discount_value,
      min_order_value: coupon.min_order_value,
      target_service_type_id: coupon.target_service_type_id,
      target_subservice_id: coupon.target_subservice_id,
      target_custom_label: coupon.target_custom_label,
      description: coupon.description,
    };
    const baseMeta = {
      coupon_id: coupon.id,
      code: coupon.code,
      coupon_kind: coupon.coupon_kind,
      discount_mode: coupon.discount_mode ?? null,
      discount_value: coupon.discount_value ?? null,
      min_order_value: coupon.min_order_value,
      discount_amount: 0,
      computed_on_subtotal: Number(body?.lead_context?.subtotal || 0),
      free_service:
        coupon.coupon_kind === 'FREE_SERVICE'
          ? {
              target_service_type_id: coupon.target_service_type_id || null,
              target_subservice_id: coupon.target_subservice_id || null,
              // Some installs store the FREE_SERVICE label in description instead of target_custom_label.
              target_custom_label: coupon.target_custom_label || coupon.description || null,
              matched_label: null,
              original_price: 0,
            }
          : null,
      validated_at: nowIso,
    };
    const invalid = (msg: string) =>
      NextResponse.json(
        {
          valid: false,
          error: msg,
          coupon: baseCoupon,
          discount_amount: 0,
          coupon_meta: baseMeta,
        },
        { status: 200 }
      );

    if (coupon.start_at && String(coupon.start_at) > nowIso) {
      return invalid('Coupon is not active yet.');
    }
    if (coupon.end_at && String(coupon.end_at) < nowIso) {
      return invalid('Coupon has expired.');
    }

    // Usage limit checks
    if (coupon.usage_limit_total) {
      const { count } = await supabaseAdmin
        .from('coupon_redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('coupon_id', coupon.id);
      if ((count || 0) >= Number(coupon.usage_limit_total || 0)) {
        return invalid('Coupon usage limit reached.');
      }
    }

    if (coupon.usage_limit_per_customer) {
      const customerPhone = normalizePhone(body?.lead_context?.customer_phone || null);
      if (customerPhone) {
        const { count } = await supabaseAdmin
          .from('coupon_redemptions')
          .select('id', { count: 'exact', head: true })
          .eq('coupon_id', coupon.id)
          .contains('meta', { customer_phone: customerPhone });
        if ((count || 0) >= Number(coupon.usage_limit_per_customer || 0)) {
          return invalid('Coupon already used by customer.');
        }
      }
    }

    const subtotal = Number(body?.lead_context?.subtotal || 0);
    if (coupon.min_order_value && subtotal < Number(coupon.min_order_value || 0)) {
      return invalid(`Minimum order value is ₹${coupon.min_order_value}.`);
    }

    let discountAmount = 0;
    let freeServiceMeta: any = null;

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
        (coupon as any).amount_off ??
        (coupon as any).percent_off ??
        derivedFromDesc.value;
      const discountValue = Number(discountValueRaw);

      if (!discountMode || !Number.isFinite(discountValue) || discountValue <= 0 || subtotal <= 0) {
        return invalid('Invalid discount configuration.');
      }
      if (discountMode === 'AMOUNT') {
        discountAmount = Math.min(discountValue, subtotal);
      } else if (discountMode === 'PERCENT') {
        discountAmount = (subtotal * discountValue) / 100;
      }
    } else if (coupon.coupon_kind === 'FREE_SERVICE') {
      const freeService = findFreeServicePrice(coupon, body?.lead_context);
      if (!freeService.matched) {
        // Still return coupon details so UI can show FREE_SERVICE label even if not applicable.
        return NextResponse.json(
          {
            valid: false,
            error: 'Coupon is not applicable to selected services.',
            coupon: baseCoupon,
            discount_amount: 0,
            coupon_meta: {
              ...baseMeta,
              free_service: {
                ...(baseMeta as any).free_service,
                matched_label: null,
                original_price: 0,
              },
            },
          },
          { status: 200 }
        );
      }
      discountAmount = Math.max(0, Number(freeService.price || 0));
      freeServiceMeta = {
        target_service_type_id: coupon.target_service_type_id || null,
        target_subservice_id: coupon.target_subservice_id || null,
        // Some installs store the FREE_SERVICE label in description instead of target_custom_label.
        target_custom_label: coupon.target_custom_label || coupon.description || null,
        matched_label: freeService.matchLabel || null,
        original_price: freeService.price || 0,
      };
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
      free_service: freeServiceMeta,
      validated_at: nowIso,
    };

    return NextResponse.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        coupon_kind: coupon.coupon_kind,
        discount_mode: coupon.discount_mode,
        discount_value: coupon.discount_value,
        min_order_value: coupon.min_order_value,
        target_service_type_id: coupon.target_service_type_id,
        target_subservice_id: coupon.target_subservice_id,
        target_custom_label: coupon.target_custom_label,
        description: coupon.description,
      },
      discount_amount: Number(discountAmount || 0),
      coupon_meta: couponMeta,
    });
  } catch (error: any) {
    return NextResponse.json(
      { valid: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
