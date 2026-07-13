import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  approveMembershipClaimRequest,
  rejectMembershipClaimRequest,
} from '@/lib/membership-claim-approval';
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
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

    const { requestId } = await params;
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'approve').trim().toLowerCase();

    if (action === 'reject') {
      const result = await rejectMembershipClaimRequest(supabaseAdmin, requestId, {
        reviewSource: 'ADMIN_PANEL',
        reviewedBy: auth.userId,
        reviewNote: body.review_note ? String(body.review_note) : null,
      });
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      const { data: membershipRow } = await supabaseAdmin
        .from('membership_claim_requests')
        .select('customer_membership_id')
        .eq('id', requestId)
        .maybeSingle();
      const detail = membershipRow?.customer_membership_id
        ? await fetchMembershipCustomerDetail(supabaseAdmin, String(membershipRow.customer_membership_id))
        : null;

      return NextResponse.json({ success: true, request: result.request, detail });
    }

    const result = await approveMembershipClaimRequest(supabaseAdmin, requestId, {
      reviewSource: 'ADMIN_PANEL',
      reviewedBy: auth.userId,
    });
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const { data: membershipRow } = await supabaseAdmin
      .from('membership_claim_requests')
      .select('customer_membership_id')
      .eq('id', requestId)
      .maybeSingle();
    const detail = membershipRow?.customer_membership_id
      ? await fetchMembershipCustomerDetail(supabaseAdmin, String(membershipRow.customer_membership_id))
      : null;

    return NextResponse.json({
      success: true,
      request: result.request,
      lead: result.lead,
      detail,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
