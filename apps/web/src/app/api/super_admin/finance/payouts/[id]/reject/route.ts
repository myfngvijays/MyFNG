/**
 * POST /api/super_admin/finance/payouts/[id]/reject
 * Reject a pending payout (Super Admin only)
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

async function assertSuperAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false, status: 401 as const, error: 'Unauthorized', user: null };
  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles(role_code)')
    .eq('id', user.id)
    .maybeSingle();
  if (roleError || !userData) return { ok: false, status: 403 as const, error: 'Forbidden', user };
  const roleCode = (userData as { roles?: { role_code: string } })?.roles?.role_code ?? null;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) return { ok: false, status: 403 as const, error: 'Forbidden', user };
  return { ok: true, status: 200 as const, error: null, user };
}

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();
    const auth = await assertSuperAdmin(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const rejection_reason = (body.rejection_reason as string) || 'Rejected by Super Admin';

    const { data: payout, error: fetchErr } = await supabaseAdmin
      .from('workshop_payouts')
      .select('id, status')
      .eq('id', params.id)
      .single();

    if (fetchErr || !payout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    }
    if (payout.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Payout is not pending (${payout.status})` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const { error: updateErr } = await supabaseAdmin
      .from('workshop_payouts')
      .update({
        status: 'REJECTED',
        rejected_by: auth.user?.id ?? null,
        rejected_at: now,
        rejection_reason,
        updated_at: now,
      })
      .eq('id', params.id);

    if (updateErr) {
      console.error('Error rejecting payout:', updateErr);
      return NextResponse.json(
        { error: 'Failed to reject payout', details: updateErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Payout rejected' });
  } catch (error) {
    console.error('Error in POST reject payout:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
