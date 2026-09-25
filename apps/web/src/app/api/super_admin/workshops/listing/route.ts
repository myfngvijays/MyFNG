import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getRequestUser } from '@/lib/supabase/requestUser';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { normalizeRoleCode } from '@/lib/telecaller/crmRoles';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/super_admin/workshops/listing
 * Super Admin on/off for customer app, website locator, and telecaller pincode lists.
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const auth = await getRequestUser(supabase, request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { supabaseAdmin } = getSupabaseAdmin();
    const profile = await resolveUserProfile(supabase, auth.user, supabaseAdmin);
    const roleCode = normalizeRoleCode((profile as { roles?: { role_code?: string } })?.roles?.role_code);
    if (roleCode !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const id = String(body?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Workshop id required' }, { status: 400 });
    const isActive = body?.is_active !== false;

    const db = supabaseAdmin ?? supabase;
    const now = new Date().toISOString();
    const { data, error } = await db
      .from('workshops')
      .update({ is_active: isActive, updated_at: now })
      .eq('id', id)
      .select('id, is_active')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message || 'Could not update listing' }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Workshop not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, id: data.id, is_active: data.is_active !== false });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Listing update failed' }, { status: 500 });
  }
}
