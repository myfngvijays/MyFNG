import type { SupabaseClient } from '@supabase/supabase-js';

export type CouponChannel = 'WEB' | 'MOBILE' | 'MEMBERSHIP' | 'TELECALLER' | 'ALL';

export type CouponScopeContext = {
  channel?: CouponChannel | string | null;
  city_id?: string | null;
  workshop_id?: string | null;
  service_type_ids?: string[];
  customer_phone?: string | null;
  subtotal?: number;
};

export function normalizePhone(phone: string | null | undefined) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '').slice(-10);
  return digits || null;
}

export function parseIdArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v)).filter(Boolean);
    } catch {
      return value.split(',').map((v) => v.trim()).filter(Boolean);
    }
  }
  return [];
}

export function parseChannelArray(value: unknown): CouponChannel[] {
  const raw = parseIdArray(value).map((v) => v.toUpperCase());
  if (raw.length === 0) return ['ALL'];
  return raw as CouponChannel[];
}

export function couponAppliesToChannel(coupon: any, channel?: string | null): boolean {
  const channels = parseChannelArray(coupon?.applicable_channels);
  if (channels.includes('ALL')) return true;
  const normalized = String(channel || 'WEB').trim().toUpperCase();
  return channels.includes(normalized as CouponChannel);
}

export function couponAppliesToCity(coupon: any, cityId?: string | null): boolean {
  const allowed = parseIdArray(coupon?.applicable_city_ids);
  if (allowed.length === 0) return true;
  if (!cityId) return false;
  return allowed.includes(String(cityId));
}

export function couponAppliesToWorkshop(coupon: any, workshopId?: string | null): boolean {
  const allowed = parseIdArray(coupon?.applicable_workshop_ids);
  if (allowed.length === 0) return true;
  if (!workshopId) return true;
  return allowed.includes(String(workshopId));
}

export function couponAppliesToServiceTypes(coupon: any, serviceTypeIds?: string[]): boolean {
  const allowed = parseIdArray(coupon?.applicable_service_type_ids);
  if (allowed.length === 0) return true;
  const selected = new Set((serviceTypeIds || []).map(String));
  if (selected.size === 0) return false;
  return allowed.some((id) => selected.has(id));
}

export async function customerHasPriorOrders(
  supabaseAdmin: SupabaseClient,
  customerPhone: string | null | undefined,
): Promise<boolean> {
  const phone = normalizePhone(customerPhone);
  if (!phone) return false;

  const { count: leadCount } = await supabaseAdmin
    .from('service_leads')
    .select('id', { count: 'exact', head: true })
    .or(`customer_phone.ilike.%${phone},phone.ilike.%${phone}`);

  if ((leadCount || 0) > 0) return true;

  const { count: redemptionCount } = await supabaseAdmin
    .from('coupon_redemptions')
    .select('id', { count: 'exact', head: true })
    .contains('meta', { customer_phone: phone });

  return (redemptionCount || 0) > 0;
}

export function applyMaxDiscountCap(amount: number, coupon: any): number {
  const cap = Number(coupon?.max_discount_amount || 0);
  if (!Number.isFinite(cap) || cap <= 0) return amount;
  return Math.min(amount, cap);
}

export async function validateCouponScope(
  supabaseAdmin: SupabaseClient,
  coupon: any,
  context: CouponScopeContext,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!couponAppliesToChannel(coupon, context.channel)) {
    return { ok: false, error: 'Coupon is not valid on this platform.' };
  }

  if (!couponAppliesToCity(coupon, context.city_id)) {
    return { ok: false, error: 'Coupon is not valid in your city.' };
  }

  if (!couponAppliesToWorkshop(coupon, context.workshop_id)) {
    return { ok: false, error: 'Coupon is not valid for this workshop.' };
  }

  if (!couponAppliesToServiceTypes(coupon, context.service_type_ids)) {
    return { ok: false, error: 'Coupon is not applicable to selected services.' };
  }

  if (coupon?.first_order_only) {
    const hasPrior = await customerHasPriorOrders(supabaseAdmin, context.customer_phone);
    if (hasPrior) {
      return { ok: false, error: 'Coupon is valid for first order only.' };
    }
  }

  return { ok: true };
}

export function generateBulkCodes(prefix: string, count: number, randomLength = 6): string[] {
  const cleanPrefix = String(prefix || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const codes = new Set<string>();
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let guard = 0;

  while (codes.size < count && guard < count * 20) {
    guard += 1;
    let suffix = '';
    for (let i = 0; i < randomLength; i += 1) {
      suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    codes.add(`${cleanPrefix}${suffix}`);
  }

  return Array.from(codes);
}

export async function logCouponAudit(
  supabaseAdmin: SupabaseClient,
  entry: {
    coupon_id?: string | null;
    batch_id?: string | null;
    action: string;
    actor_user_id?: string | null;
    details?: Record<string, unknown>;
  },
) {
  try {
    await supabaseAdmin.from('coupon_audit_log').insert({
      coupon_id: entry.coupon_id || null,
      batch_id: entry.batch_id || null,
      action: entry.action,
      actor_user_id: entry.actor_user_id || null,
      details: entry.details || {},
    });
  } catch {
    // non-blocking
  }
}
