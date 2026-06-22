import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { setCustomerAccountStatus, type CustomerAccountAction } from '@/lib/customer-account-admin';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function assertSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized', user: null };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  if (roleError || !userData) {
    return { ok: false, status: 403, error: 'Forbidden - Role check failed', user: null };
  }

  const roleCode = (userData as any).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden - Not super admin', user: null };
  }

  return { ok: true, status: 200, error: null, user };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const { id: customerId } = await params;
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '').trim().toLowerCase() as CustomerAccountAction;

    if (!['deactivate', 'ban', 'reactivate'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Use deactivate, ban, or reactivate.' },
        { status: 400 },
      );
    }

    const result = await setCustomerAccountStatus(supabaseAdmin, {
      customerId,
      action,
      reason: typeof body.reason === 'string' ? body.reason.trim() : null,
      adminUserId: auth.user?.id || null,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error, details: (result as any).details }, { status: result.status });
    }

    return NextResponse.json({ success: true, customer: result.customer });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
