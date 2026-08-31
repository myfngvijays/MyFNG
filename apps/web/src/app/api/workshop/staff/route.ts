import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';

async function resolveWorkshopUser(supabase: Awaited<ReturnType<typeof createClient>>, authUser: { id: string; email?: string | null }) {
  const select = 'id, workshop_id, roles!inner(role_code)';

  const { data: byId } = await supabase
    .from('users_login')
    .select(select)
    .eq('id', authUser.id)
    .maybeSingle();

  if (byId?.workshop_id) return byId;

  const email = String(authUser.email || '').trim();
  if (!email) return byId;

  const { data: byEmail } = await supabase
    .from('users_login')
    .select(select)
    .ilike('email', email)
    .maybeSingle();

  return byEmail || byId;
}

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const me = await resolveWorkshopUser(supabase, user);
    if (!me) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const workshopId = (me as any)?.workshop_id;
    if (!workshopId) {
      return NextResponse.json({ staff: [] }, { status: 200 });
    }

    const roleCode = String((me as any)?.roles?.role_code || '').trim().toUpperCase();
    const allowed =
      roleCode === 'SUPER_ADMIN' ||
      roleCode === 'SUB_ADMIN' ||
      roleCode.startsWith('WORKSHOP_') ||
      roleCode === 'PICKUP_BOY';
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    const db = supabaseAdmin || supabase;
    if (adminErr) {
      console.warn('[workshop/staff] admin client unavailable, using session client');
    }

    const { data: staffRows, error: staffErr } = await db
      .from('users_login')
      .select('id, full_name, email, is_active, roles!inner(role_code)')
      .eq('workshop_id', workshopId)
      .eq('is_active', true)
      .order('full_name', { ascending: true });

    if (staffErr) {
      return NextResponse.json({ error: 'Failed to fetch staff', details: staffErr.message }, { status: 500 });
    }

    const staff = (staffRows || []).map((r: any) => ({
      id: r.id,
      full_name: r.full_name || r.email || '—',
      role_code: r.roles?.role_code || null,
    }));

    return NextResponse.json({ staff }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: e?.message || String(e) },
      { status: 500 }
    );
  }
}

