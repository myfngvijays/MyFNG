import 'server-only';
import {
  getWalletLogicSettings,
  parseWelcomeBonusPhoneOverrides,
  resolveWelcomeBonusAmountForPhone,
} from '@/lib/wallet-config';

/** Per-user coupon validity after assign/login (matches welcome wallet expiry default). */
const DEFAULT_OVERRIDE_COUPON_EXPIRY_DAYS = 90;

function phoneLast10(raw: unknown): string {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
}

function resolveExpiryDays(settings: { global?: { welcome_expiry_days?: number } }): number {
  const days = Number(settings.global?.welcome_expiry_days);
  if (Number.isFinite(days) && days > 0) return Math.round(days);
  return DEFAULT_OVERRIDE_COUPON_EXPIRY_DAYS;
}

function expiryIsoFromNow(days: number): string {
  const safe = Math.max(1, Math.round(days) || DEFAULT_OVERRIDE_COUPON_EXPIRY_DAYS);
  return new Date(Date.now() + safe * 24 * 60 * 60 * 1000).toISOString();
}

async function ensurePendingOverrideCoupon(
  supabaseAdmin: any,
  phone: string,
  couponId: string,
  overrideAmount: number,
): Promise<boolean> {
  const { data: existing } = await supabaseAdmin
    .from('customer_coupon_assignments')
    .select('id')
    .eq('pending_phone', phone)
    .eq('coupon_id', couponId)
    .is('customer_id', null)
    .maybeSingle();
  if (existing?.id) return true;

  // No expires_at yet — clock starts when customer logs in / gets assigned.
  const { error } = await supabaseAdmin.from('customer_coupon_assignments').insert({
    pending_phone: phone,
    coupon_id: couponId,
    notes: JSON.stringify({
      source: 'welcome_bonus_phone_override',
      phone,
      welcome_override_amount: overrideAmount,
      assignment_status: 'LOCKED',
      unlock_rule: 'first_completed_non_inspection_service',
    }),
    redeemed_at: null,
    expires_at: null,
  });
  if (error) {
    console.warn('[welcome-override-coupon] pending assign failed:', error.message);
    return false;
  }
  return true;
}

/**
 * If customer phone is on welcome bonus override list and an auto-coupon is configured,
 * assign that coupon to My Coupons (idempotent). Expiry is per-user from assign/login time.
 */
export async function ensureWelcomeOverrideCouponForCustomer(
  supabaseAdmin: any,
  customerId: string,
  phoneHint?: string | null,
): Promise<{ assigned: boolean; coupon_id: string | null; reason?: string }> {
  const cid = String(customerId || '').trim();
  if (!cid || !supabaseAdmin) {
    return { assigned: false, coupon_id: null, reason: 'missing_customer' };
  }

  const settings = await getWalletLogicSettings(supabaseAdmin);
  const couponId = String(settings.welcome_bonus_auto_coupon_id || '').trim();
  if (!couponId) {
    return { assigned: false, coupon_id: null, reason: 'no_coupon_configured' };
  }

  const overrides = parseWelcomeBonusPhoneOverrides(settings.welcome_bonus_phone_overrides);
  if (!overrides.length) {
    return { assigned: false, coupon_id: couponId, reason: 'no_overrides' };
  }

  let phone = phoneLast10(phoneHint);
  if (!phone) {
    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('phone')
      .eq('id', cid)
      .maybeSingle();
    phone = phoneLast10(customer?.phone);
  }
  if (!phone) {
    return { assigned: false, coupon_id: couponId, reason: 'no_phone' };
  }

  const onList = overrides.some((row) => row.phone === phone);
  if (!onList) {
    return { assigned: false, coupon_id: couponId, reason: 'not_on_override_list' };
  }

  const { data: coupon } = await supabaseAdmin
    .from('coupons')
    .select('id, is_active, code')
    .eq('id', couponId)
    .maybeSingle();
  if (!coupon?.id || coupon.is_active === false) {
    return { assigned: false, coupon_id: couponId, reason: 'coupon_inactive' };
  }

  const expiryDays = resolveExpiryDays(settings);
  const expiresAt = expiryIsoFromNow(expiryDays);

  const { data: existing } = await supabaseAdmin
    .from('customer_coupon_assignments')
    .select('id, expires_at')
    .eq('customer_id', cid)
    .eq('coupon_id', couponId)
    .maybeSingle();

  if (existing?.id) {
    // Pending→resolved or older rows may lack per-user expiry — start clock on first login touch.
    if (!existing.expires_at) {
      const { error: patchErr } = await supabaseAdmin
        .from('customer_coupon_assignments')
        .update({ expires_at: expiresAt })
        .eq('id', existing.id)
        .is('expires_at', null);
      if (patchErr) {
        console.warn('[welcome-override-coupon] expiry backfill failed:', patchErr.message);
      }
    }
    return { assigned: true, coupon_id: couponId, reason: 'already_assigned' };
  }

  const overrideAmount = resolveWelcomeBonusAmountForPhone(
    settings.global.welcome_bonus_amount,
    phone,
    overrides,
  );

  const { error } = await supabaseAdmin.from('customer_coupon_assignments').upsert(
    {
      customer_id: cid,
      coupon_id: couponId,
      notes: JSON.stringify({
        source: 'welcome_bonus_phone_override',
        phone,
        welcome_override_amount: overrideAmount,
        expiry_days: expiryDays,
        assignment_status: 'LOCKED',
        unlock_rule: 'first_completed_non_inspection_service',
      }),
      redeemed_at: null,
      expires_at: expiresAt,
    },
    { onConflict: 'customer_id,coupon_id' },
  );

  if (error) {
    console.warn('[welcome-override-coupon] assign failed:', error.message);
    return { assigned: false, coupon_id: couponId, reason: error.message };
  }

  return { assigned: true, coupon_id: couponId, reason: 'assigned' };
}

/**
 * Assign configured coupon to all override phones:
 * registered → customer assignment; not registered → pending_phone (resolves on login).
 */
export async function backfillWelcomeOverrideCoupons(
  supabaseAdmin: any,
): Promise<{ attempted: number; assigned: number; pending: number }> {
  const settings = await getWalletLogicSettings(supabaseAdmin);
  const couponId = String(settings.welcome_bonus_auto_coupon_id || '').trim();
  const overrides = parseWelcomeBonusPhoneOverrides(settings.welcome_bonus_phone_overrides);
  if (!couponId || !overrides.length) {
    return { attempted: 0, assigned: 0, pending: 0 };
  }

  const { data: coupon } = await supabaseAdmin
    .from('coupons')
    .select('id, is_active')
    .eq('id', couponId)
    .maybeSingle();
  if (!coupon?.id || coupon.is_active === false) {
    return { attempted: overrides.length, assigned: 0, pending: 0 };
  }

  let assigned = 0;
  let pending = 0;

  for (const row of overrides) {
    const { data: customers } = await supabaseAdmin
      .from('customers')
      .select('id, phone')
      .or(`phone.eq.${row.phone},phone.eq.91${row.phone},phone.eq.+91${row.phone},phone.ilike.%${row.phone}`)
      .limit(5);

    const list = customers || [];
    if (list.length === 0) {
      const ok = await ensurePendingOverrideCoupon(
        supabaseAdmin,
        row.phone,
        couponId,
        row.amount,
      );
      if (ok) pending += 1;
      continue;
    }

    for (const customer of list) {
      const result = await ensureWelcomeOverrideCouponForCustomer(
        supabaseAdmin,
        String(customer.id),
        customer.phone || row.phone,
      );
      if (result.assigned && (result.reason === 'assigned' || result.reason === 'already_assigned')) {
        assigned += 1;
      }
    }
  }

  return { attempted: overrides.length, assigned, pending };
}
