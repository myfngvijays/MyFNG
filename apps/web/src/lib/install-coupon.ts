import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { inferCouponTypeSlug, isInstallWalletCouponType } from '@/lib/coupon-types';
import { couponAppliesToChannel, normalizePhone } from '@/lib/coupon-rules';
import { redeemCouponAtomic } from '@/lib/coupon-service';
import { isWelcomeCiGatedCoupon } from '@/lib/welcome-ci-coupon-gate';
import { creditWallet, getWalletSummary } from '@/lib/wallet-service';

function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
import { getWalletConfig, parseWalletPlatform, type WalletPlatform } from '@/lib/wallet-config';

const MAX_INSTALL_CREDIT = 10000;
const FIRST_LOGIN_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export function installCouponIdempotencyKey(customerId: string, code?: string) {
  const normalized = normalizeCode(code);
  return normalized ? `install-coupon:${customerId}:${normalized}` : `install-coupon:${customerId}`;
}

function isInstallCouponIdempotencyKey(customerId: string, key: unknown) {
  return String(key || '').startsWith(`install-coupon:${customerId}`);
}

function couponCodeFromCredit(row: {
  idempotency_key?: string | null;
  metadata?: unknown;
}) {
  const meta =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  const fromMeta = normalizeCode(meta.coupon_code);
  if (fromMeta) return fromMeta;
  const key = String(row.idempotency_key || '');
  const prefix = `install-coupon:`;
  if (!key.startsWith(prefix)) return '';
  const rest = key.slice(prefix.length);
  const colon = rest.indexOf(':');
  return colon >= 0 ? normalizeCode(rest.slice(colon + 1)) : '';
}

function normalizeCode(code: unknown) {
  return String(code || '').trim().toUpperCase();
}

function parseFlatAmount(coupon: Record<string, unknown>): number {
  const mode = String(coupon.discount_mode || '').trim().toUpperCase();
  if (mode && mode !== 'AMOUNT' && mode !== 'FLAT' && mode !== 'FIXED' && mode !== 'VALUE') {
    return 0;
  }
  const raw = Number(coupon.discount_value ?? (coupon as { value?: unknown }).value);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return roundMoney(raw);
}

async function loadCustomerRow(
  supabaseAdmin: SupabaseClient,
  customerId: string,
): Promise<{
  id: string;
  phone: string | null;
  created_at: string | null;
  install_coupon_code: string | null;
} | null> {
  const { data, error } = await supabaseAdmin
    .from('customers')
    .select('id, phone, created_at, install_coupon_code')
    .eq('id', customerId)
    .maybeSingle();
  if (!error && data) {
    return {
      id: String(data.id),
      phone: data.phone || null,
      created_at: data.created_at || null,
      install_coupon_code: data.install_coupon_code || null,
    };
  }

  const fallback = await supabaseAdmin
    .from('customers')
    .select('id, phone, created_at')
    .eq('id', customerId)
    .maybeSingle();
  if (!fallback.data) return null;
  return {
    id: String(fallback.data.id),
    phone: fallback.data.phone || null,
    created_at: fallback.data.created_at || null,
    install_coupon_code: null,
  };
}

async function listInstallCredits(
  supabaseAdmin: SupabaseClient,
  customerId: string,
) {
  const { data } = await supabaseAdmin
    .from('wallet_transactions')
    .select('id, amount, balance_after, metadata, idempotency_key')
    .eq('customer_id', customerId)
    .eq('transaction_type', 'CREDIT')
    .like('idempotency_key', `install-coupon:${customerId}%`);
  return data || [];
}

function claimedInstallCodes(
  rows: Array<{ idempotency_key?: string | null; metadata?: unknown }>,
  fallbackCode?: string | null,
) {
  const codes = new Set<string>();
  for (const row of rows) {
    const code = couponCodeFromCredit(row);
    if (code) codes.add(code);
  }
  const fallback = normalizeCode(fallbackCode);
  if (fallback) codes.add(fallback);
  return [...codes];
}

export async function getInstallCouponEligibility(
  supabaseAdmin: SupabaseClient,
  customerId: string,
) {
  const customer = await loadCustomerRow(supabaseAdmin, customerId);
  if (!customer) {
    return { eligible: false, can_claim: false, already_claimed: false, reason: 'not_found' as const };
  }

  const existing = await listInstallCredits(supabaseAdmin, customerId);
  const codes = claimedInstallCodes(existing, customer.install_coupon_code);
  if (codes.length) {
    return {
      eligible: false,
      can_claim: true,
      already_claimed: true,
      code: codes[codes.length - 1] || null,
      codes,
      reason: 'already_claimed' as const,
    };
  }

  const createdMs = Date.parse(String(customer.created_at || ''));
  const withinWindow = !Number.isFinite(createdMs) || Date.now() - createdMs <= FIRST_LOGIN_WINDOW_MS;
  if (!withinWindow) {
    return {
      eligible: false,
      can_claim: true,
      already_claimed: false,
      codes: [] as string[],
      reason: 'window_closed' as const,
    };
  }

  return { eligible: true, can_claim: true, already_claimed: false, codes: [] as string[], reason: 'ok' as const };
}

export async function claimInstallCoupon(opts: {
  supabaseAdmin: SupabaseClient;
  customerId: string;
  code: string;
  platform?: WalletPlatform | string | null;
}) {
  const code = normalizeCode(opts.code);
  if (!code) {
    return { ok: false as const, error: 'Enter a coupon code.', status: 400 };
  }

  const customer = await loadCustomerRow(opts.supabaseAdmin, opts.customerId);
  if (!customer) {
    return { ok: false as const, error: 'Customer not found.', status: 404 };
  }

  const existingCredits = await listInstallCredits(opts.supabaseAdmin, customer.id);
  const alreadyUsed = claimedInstallCodes(existingCredits, customer.install_coupon_code);
  if (alreadyUsed.includes(code)) {
    return {
      ok: false as const,
      error: 'You have already used this coupon.',
      status: 409,
    };
  }

  const nowIso = new Date().toISOString();
  const { data: coupon, error: couponErr } = await opts.supabaseAdmin
    .from('coupons')
    .select('*')
    .ilike('code', code)
    .eq('is_active', true)
    .maybeSingle();

  if (couponErr || !coupon) {
    return { ok: false as const, error: 'Invalid or inactive coupon.', status: 400 };
  }

  if (coupon.start_at && String(coupon.start_at) > nowIso) {
    return { ok: false as const, error: 'Coupon is not active yet.', status: 400 };
  }
  if (coupon.end_at && String(coupon.end_at) < nowIso) {
    return { ok: false as const, error: 'Coupon has expired.', status: 400 };
  }

  if (isWelcomeCiGatedCoupon(coupon) || String(coupon.coupon_type_slug || '') === 'referral') {
    return { ok: false as const, error: 'This coupon cannot be added to wallet here.', status: 400 };
  }

  const typeSlug = inferCouponTypeSlug(coupon);
  if (!isInstallWalletCouponType(typeSlug)) {
    return {
      ok: false as const,
      error: 'Use a festival, society, or flat-amount offer coupon.',
      status: 400,
    };
  }

  if (String(coupon.coupon_kind || '').toUpperCase() === 'FREE_SERVICE') {
    return { ok: false as const, error: 'This coupon is for a free service, not wallet credit.', status: 400 };
  }

  const amount = parseFlatAmount(coupon);
  if (amount <= 0) {
    return { ok: false as const, error: 'This coupon has no wallet amount. Use a flat ₹ coupon.', status: 400 };
  }
  if (amount > MAX_INSTALL_CREDIT) {
    return { ok: false as const, error: 'Coupon amount is too high to credit on first login.', status: 400 };
  }

  const platform = parseWalletPlatform(opts.platform);
  const channel = platform === 'ios' ? 'IOS' : platform === 'android' ? 'ANDROID' : 'WEB';
  if (!couponAppliesToChannel(coupon, channel)) {
    return { ok: false as const, error: 'Coupon is not valid on this platform.', status: 400 };
  }

  // is_public only hides the coupon from Offers & Coupons list.
  // Anyone who types a valid festival / flat / society code can still credit wallet.

  if (coupon.usage_limit_total) {
    const { count } = await opts.supabaseAdmin
      .from('coupon_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('coupon_id', coupon.id);
    if ((count || 0) >= Number(coupon.usage_limit_total || 0)) {
      return { ok: false as const, error: 'Coupon usage limit reached.', status: 400 };
    }
  }

  const customerPhone = normalizePhone(customer.phone);
  if (coupon.usage_limit_per_customer && customerPhone) {
    const { count } = await opts.supabaseAdmin
      .from('coupon_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('coupon_id', coupon.id)
      .contains('meta', { customer_phone: customerPhone });
    if ((count || 0) >= Number(coupon.usage_limit_per_customer || 0)) {
      return { ok: false as const, error: 'You have already used this coupon.', status: 400 };
    }
  }

  const config = await getWalletConfig(opts.supabaseAdmin, platform);
  const summaryBefore = await getWalletSummary(opts.supabaseAdmin, customer.id, platform);
  const { data: welcomeRows } = await opts.supabaseAdmin
    .from('wallet_transactions')
    .select('amount, idempotency_key')
    .eq('customer_id', customer.id)
    .eq('transaction_type', 'CREDIT')
    .eq('source', config.WELCOME_SOURCE);
  const welcomeAlready = roundMoney(
    (welcomeRows || [])
      .filter((row: { idempotency_key?: string }) => !isInstallCouponIdempotencyKey(customer.id, row.idempotency_key))
      .reduce((sum: number, row: { amount?: number }) => sum + Number(row.amount || 0), 0),
  );
  const expiresAt =
    summaryBefore.welcome_bonus_expires_at ||
    new Date(Date.now() + Number(config.WELCOME_EXPIRY_DAYS || 90) * 24 * 60 * 60 * 1000).toISOString();

  const credited = await creditWallet(opts.supabaseAdmin, customer.id, amount, {
    source: config.WELCOME_SOURCE,
    idempotencyKey: installCouponIdempotencyKey(customer.id, code),
    sourceRefId: String(coupon.id),
    expiresAt,
    metadata: {
      label: 'Install coupon wallet credit',
      description: `${code} added with welcome bonus`,
      coupon_id: coupon.id,
      coupon_code: code,
      coupon_type: typeSlug,
      install_coupon: true,
    },
  });

  if (!credited.duplicate) {
    const redeem = await redeemCouponAtomic(opts.supabaseAdmin, {
      couponId: String(coupon.id),
      customerPhone,
      discountAmount: amount,
      appliedByRole: 'CUSTOMER',
      meta: {
        source: 'install_wallet_credit',
        customer_id: customer.id,
        customer_phone: customerPhone,
        wallet_credit: amount,
      },
      idempotencyKey: installCouponIdempotencyKey(customer.id, code),
    });
    if (!redeem.success) {
      console.warn('[claimInstallCoupon] redemption audit failed:', redeem.error);
    }

    const patch: Record<string, unknown> = {
      updated_at: nowIso,
    };
    if (!customer.install_coupon_code) {
      patch.install_coupon_code = code;
      patch.install_coupon_type = typeSlug;
    }
    if (typeSlug === 'society') patch.society_code = code;
    const { error: tagErr } = await opts.supabaseAdmin
      .from('customers')
      .update(patch)
      .eq('id', customer.id);
    if (tagErr) {
      console.warn('[claimInstallCoupon] customer tag failed:', tagErr.message);
    }
  }

  const summaryAfter = await getWalletSummary(opts.supabaseAdmin, customer.id, platform);
  const walletTotal = roundMoney(Number(summaryAfter.spendable_balance || credited.balance_after || 0));

  return {
    ok: true as const,
    already_applied: Boolean(credited.duplicate),
    coupon_code: code,
    coupon_type: typeSlug,
    coupon_amount: amount,
    welcome_amount: welcomeAlready,
    wallet_total: walletTotal,
    expires_at: expiresAt,
    society: typeSlug === 'society',
    codes: [...alreadyUsed, code],
  };
}
