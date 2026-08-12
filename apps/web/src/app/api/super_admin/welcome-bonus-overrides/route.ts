import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  getWalletLogicSettings,
  parseWelcomeBonusPhoneOverrides,
  type WelcomeBonusPhoneOverride,
} from '@/lib/wallet-config';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export type WelcomeOverrideRowStatus =
  | 'not_logged_in'
  | 'logged_in_pending'
  | 'credited_override'
  | 'credited_other';

export type WelcomeOverrideRow = {
  phone: string;
  override_amount: number;
  status: WelcomeOverrideRowStatus;
  customer_id: string | null;
  full_name: string | null;
  app_platform: string | null;
  last_login_at: string | null;
  customer_created_at: string | null;
  welcome_credited: boolean;
  welcome_amount: number | null;
  welcome_credited_at: string | null;
  welcome_expires_at: string | null;
  coupon_assigned: boolean;
  coupon_pending: boolean;
  coupon_code: string | null;
};

async function assertSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false as const, status: 401, error: 'Unauthorized' };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  if (roleError || !userData) {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  const roleCode = (userData as any).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN', 'APP_OPERATIONS'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return { ok: true as const };
}

function phoneLast10(raw: unknown): string {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
}

async function fetchCustomersByPhones(
  supabaseAdmin: any,
  phones: string[],
): Promise<
  Array<{
    id: string;
    phone: string | null;
    full_name: string | null;
    app_platform: string | null;
    last_login_at: string | null;
    created_at: string | null;
  }>
> {
  const out: Array<{
    id: string;
    phone: string | null;
    full_name: string | null;
    app_platform: string | null;
    last_login_at: string | null;
    created_at: string | null;
  }> = [];

  const chunkSize = 25;
  for (let i = 0; i < phones.length; i += chunkSize) {
    const chunk = phones.slice(i, i + chunkSize);
    const orParts = chunk.flatMap((p) => [
      `phone.eq.${p}`,
      `phone.eq.91${p}`,
      `phone.eq.+91${p}`,
      `phone.ilike.%${p}`,
    ]);
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('id, phone, full_name, app_platform, last_login_at, created_at')
      .or(orParts.join(','));
    if (error) throw new Error(error.message);
    out.push(...(data || []));
  }

  return out;
}

export async function GET() {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const settings = await getWalletLogicSettings(supabaseAdmin);
    const overrides: WelcomeBonusPhoneOverride[] = parseWelcomeBonusPhoneOverrides(
      settings.welcome_bonus_phone_overrides,
    );
    const defaultAmount = Number(settings.global.welcome_bonus_amount) || 1000;
    const expiryDays = Number(settings.global.welcome_expiry_days) || 90;

    const autoCouponId = String(settings.welcome_bonus_auto_coupon_id || '').trim() || null;
    let autoCouponCode: string | null = null;
    if (autoCouponId) {
      const { data: couponRow } = await supabaseAdmin
        .from('coupons')
        .select('id, code, is_active')
        .eq('id', autoCouponId)
        .maybeSingle();
      autoCouponCode = couponRow?.code ? String(couponRow.code) : null;
    }

    if (overrides.length === 0) {
      return NextResponse.json({
        default_amount: defaultAmount,
        expiry_days: expiryDays,
        auto_coupon_id: autoCouponId,
        auto_coupon_code: autoCouponCode,
        summary: {
          listed: 0,
          logged_in: 0,
          credited_override: 0,
          credited_other: 0,
          pending: 0,
          not_logged_in: 0,
          coupon_assigned: 0,
          coupon_pending: 0,
        },
        rows: [] as WelcomeOverrideRow[],
      });
    }

    const phones = overrides.map((o) => o.phone);
    const customers = await fetchCustomersByPhones(supabaseAdmin, phones);

    const customerByPhone = new Map<string, (typeof customers)[number]>();
    for (const c of customers) {
      const key = phoneLast10(c.phone);
      if (!key || !phones.includes(key)) continue;
      const existing = customerByPhone.get(key);
      if (!existing) {
        customerByPhone.set(key, c);
        continue;
      }
      // Prefer the one with last_login_at / newer created_at
      const existingTs = Date.parse(String(existing.last_login_at || existing.created_at || 0));
      const nextTs = Date.parse(String(c.last_login_at || c.created_at || 0));
      if (nextTs > existingTs) customerByPhone.set(key, c);
    }

    const customerIds = [...customerByPhone.values()].map((c) => c.id);
    const welcomeByCustomer = new Map<
      string,
      { amount: number; created_at: string | null; expires_at: string | null }
    >();
    const couponAssignedCustomerIds = new Set<string>();
    const couponPendingPhones = new Set<string>();

    if (customerIds.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < customerIds.length; i += chunkSize) {
        const chunk = customerIds.slice(i, i + chunkSize);
        const { data, error } = await supabaseAdmin
          .from('wallet_transactions')
          .select('customer_id, amount, created_at, expires_at, source')
          .in('customer_id', chunk)
          .eq('source', 'WELCOME_BONUS')
          .eq('transaction_type', 'CREDIT');
        if (error) throw new Error(error.message);
        for (const row of data || []) {
          const cid = String(row.customer_id || '');
          if (!cid || welcomeByCustomer.has(cid)) continue;
          welcomeByCustomer.set(cid, {
            amount: Number(row.amount) || 0,
            created_at: row.created_at ? String(row.created_at) : null,
            expires_at: row.expires_at ? String(row.expires_at) : null,
          });
        }
      }
    }

    if (autoCouponId) {
      if (customerIds.length > 0) {
        const chunkSize = 100;
        for (let i = 0; i < customerIds.length; i += chunkSize) {
          const chunk = customerIds.slice(i, i + chunkSize);
          const { data, error } = await supabaseAdmin
            .from('customer_coupon_assignments')
            .select('customer_id')
            .eq('coupon_id', autoCouponId)
            .in('customer_id', chunk);
          if (error) throw new Error(error.message);
          for (const row of data || []) {
            if (row.customer_id) couponAssignedCustomerIds.add(String(row.customer_id));
          }
        }
      }

      const { data: pendingRows, error: pendingError } = await supabaseAdmin
        .from('customer_coupon_assignments')
        .select('pending_phone')
        .eq('coupon_id', autoCouponId)
        .in('pending_phone', phones)
        .is('customer_id', null);
      if (pendingError) throw new Error(pendingError.message);
      for (const row of pendingRows || []) {
        const p = phoneLast10(row.pending_phone);
        if (p) couponPendingPhones.add(p);
      }
    }

    const rows: WelcomeOverrideRow[] = overrides.map((ov) => {
      const customer = customerByPhone.get(ov.phone) || null;
      const welcome = customer ? welcomeByCustomer.get(customer.id) || null : null;
      const couponAssigned = customer ? couponAssignedCustomerIds.has(customer.id) : false;
      const couponPending = !couponAssigned && couponPendingPhones.has(ov.phone);

      let status: WelcomeOverrideRowStatus = 'not_logged_in';
      if (!customer) {
        status = 'not_logged_in';
      } else if (!welcome) {
        status = 'logged_in_pending';
      } else if (Math.round(welcome.amount) === Math.round(ov.override_amount)) {
        status = 'credited_override';
      } else {
        status = 'credited_other';
      }

      return {
        phone: ov.phone,
        override_amount: ov.override_amount,
        status,
        customer_id: customer?.id || null,
        full_name: customer?.full_name || null,
        app_platform: customer?.app_platform || null,
        last_login_at: customer?.last_login_at || null,
        customer_created_at: customer?.created_at || null,
        welcome_credited: Boolean(welcome),
        welcome_amount: welcome ? welcome.amount : null,
        welcome_credited_at: welcome?.created_at || null,
        welcome_expires_at: welcome?.expires_at || null,
        coupon_assigned: couponAssigned,
        coupon_pending: couponPending,
        coupon_code: autoCouponCode,
      };
    });

    // Sort: credited first, then logged in, then not logged in
    const order: Record<WelcomeOverrideRowStatus, number> = {
      credited_override: 0,
      credited_other: 1,
      logged_in_pending: 2,
      not_logged_in: 3,
    };
    rows.sort((a, b) => order[a.status] - order[b.status] || a.phone.localeCompare(b.phone));

    const summary = {
      listed: rows.length,
      logged_in: rows.filter((r) => r.status !== 'not_logged_in').length,
      credited_override: rows.filter((r) => r.status === 'credited_override').length,
      credited_other: rows.filter((r) => r.status === 'credited_other').length,
      pending: rows.filter((r) => r.status === 'logged_in_pending').length,
      not_logged_in: rows.filter((r) => r.status === 'not_logged_in').length,
      coupon_assigned: rows.filter((r) => r.coupon_assigned).length,
      coupon_pending: rows.filter((r) => r.coupon_pending).length,
    };

    return NextResponse.json({
      default_amount: defaultAmount,
      expiry_days: expiryDays,
      auto_coupon_id: autoCouponId,
      auto_coupon_code: autoCouponCode,
      summary,
      rows,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load welcome overrides' }, { status: 500 });
  }
}
