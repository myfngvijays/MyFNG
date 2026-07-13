import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { revokeMembershipBenefitClaim } from '@/lib/membership-benefits-service';
import { fetchMembershipCustomerDetail } from '@/lib/membership-customers-admin';
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
    return { ok: false as const, status: 401, error: 'Unauthorized', userId: null };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  if (roleError || !userData) {
    return { ok: false as const, status: 403, error: 'Forbidden - Role check failed', userId: null };
  }

  const roleCode = (userData as any).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN', 'APP_OPERATIONS'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden - Not super admin', userId: null };
  }

  return { ok: true as const, status: 200, error: null, userId: user.id };
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ usageId: string }> },
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

    const { usageId } = await params;
    const result = await revokeMembershipBenefitClaim(supabaseAdmin, usageId, {
      adminUserId: auth.userId,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const detail = await fetchMembershipCustomerDetail(supabaseAdmin, result.membership_id);

    return NextResponse.json({
      success: true,
      benefit_code: result.benefit_code,
      lead_cancelled: result.lead_cancelled,
      warning: result.warning || null,
      detail,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
