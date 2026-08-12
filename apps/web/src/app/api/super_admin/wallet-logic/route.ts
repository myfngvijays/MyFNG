import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  getWalletLogicSettings,
  saveWalletLogicSettings,
  validateWalletLogicFullSettings,
  type WalletLogicFullSettings,
} from '@/lib/wallet-config';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function assertSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false as const, status: 401, error: 'Unauthorized', user: null };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  if (roleError || !userData) {
    return { ok: false as const, status: 403, error: 'Forbidden - Role check failed', user: null };
  }

  const roleCode = (userData as any).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden - Not super admin', user: null };
  }

  return { ok: true as const, status: 200, error: null, user };
}

export async function GET() {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    const settings = await getWalletLogicSettings(supabaseAdmin);
    return NextResponse.json({ success: true, settings });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const payload = body.settings as WalletLogicFullSettings;

    const validationError = validateWalletLogicFullSettings(payload);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const saved = await saveWalletLogicSettings(supabaseAdmin, payload, auth.user?.id || null);

    // Best-effort: assign auto coupon to override phones (registered + pending).
    // Keep this out of wallet-config — that module is also imported by client components.
    if (
      saved.welcome_bonus_auto_coupon_id &&
      (saved.welcome_bonus_phone_overrides || []).length > 0
    ) {
      try {
        const { backfillWelcomeOverrideCoupons } = await import('@/lib/welcome-override-coupon');
        await backfillWelcomeOverrideCoupons(supabaseAdmin);
      } catch (e) {
        console.warn('[wallet-logic] welcome override coupon backfill failed:', e);
      }
    }

    return NextResponse.json({
      success: true,
      settings: saved,
      message: 'Wallet logic updated successfully',
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
