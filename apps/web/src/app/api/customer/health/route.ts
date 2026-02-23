import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ ok: false, error: 'server_config' }, { status: 500 });

  const checks = await Promise.all([
    supabaseAdmin.from('customers').select('id', { head: true, count: 'exact' }),
    supabaseAdmin.from('wallet_accounts').select('id', { head: true, count: 'exact' }),
    supabaseAdmin.from('referral_codes').select('id', { head: true, count: 'exact' }),
    supabaseAdmin.from('carts').select('id', { head: true, count: 'exact' }),
  ]);

  const failed = checks.some((x) => Boolean(x.error));
  return NextResponse.json({
    ok: !failed,
    service: 'customer-profile',
    checked_at: new Date().toISOString(),
    checks: checks.map((x) => ({ ok: !x.error, count: x.count || 0, error: x.error?.message || null })),
  }, { status: failed ? 500 : 200 });
}

