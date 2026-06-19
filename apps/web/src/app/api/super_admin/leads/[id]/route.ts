import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { LEAD_SOURCES, normalizeLeadSource } from '@/lib/enquiry/createLead';
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
    return { ok: false as const, status: 401, error: 'Unauthorized' };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  if (roleError || !userData) {
    return { ok: false as const, status: 403, error: 'Forbidden - Role check failed' };
  }

  const roleCode = (userData as any).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden - Not super admin' };
  }

  return { ok: true as const };
}

const EDITABLE_FIELDS = [
  'customer_name',
  'customer_phone',
  'vehicle_number',
  'city',
  'status',
  'lead_source',
  'created_from',
  'estimated_amount',
  'coupon_code',
  'discount_amount',
  'service_type',
  'customer_email',
  'customer_address',
] as const;

export async function PATCH(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await paramsPromise;
    const body = await request.json().catch(() => ({}));

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    for (const field of EDITABLE_FIELDS) {
      if (body[field] !== undefined) {
        update[field] = body[field];
      }
    }

    if (body.lead_source !== undefined) {
      const normalized = normalizeLeadSource(String(body.lead_source || ''));
      if (!LEAD_SOURCES.includes(normalized as any)) {
        return NextResponse.json({ error: 'Invalid lead_source' }, { status: 400 });
      }
      update.lead_source = normalized;
    }

    if (body.estimated_amount !== undefined) {
      update.estimated_amount = body.estimated_amount === '' || body.estimated_amount == null
        ? null
        : Number(body.estimated_amount);
    }

    if (body.discount_amount !== undefined) {
      update.discount_amount = body.discount_amount === '' || body.discount_amount == null
        ? 0
        : Number(body.discount_amount);
    }

    if (Object.keys(update).length <= 1) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('service_leads')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || 'Update failed' }, { status: 500 });
    }

    return NextResponse.json({ lead: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await paramsPromise;
    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const { error } = await supabaseAdmin.from('service_leads').delete().eq('id', id);

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Delete failed. Lead may be linked to jobs or invoices.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
