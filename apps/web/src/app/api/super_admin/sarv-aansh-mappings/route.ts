import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function assertSuperAdmin(supabase: any) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized', user: null };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();
  if (roleError || !userData) {
    return { ok: false, status: 403, error: 'Forbidden - Role check failed', user };
  }
  const roleCode = (userData as any).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden - Not super admin', user };
  }
  return { ok: true, status: 200, error: null, user };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await assertSuperAdmin(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const { data: mappings, error } = await supabaseAdmin
      .from('sarv_aansh_mappings')
      .select(
        `
        id,
        aansh_id,
        telecaller_id,
        assignee_role,
        assignee_id,
        effective_from,
        effective_to,
        day_of_week,
        time_from,
        time_to,
        assignee:users_login(id, full_name, email, phone)
      `
      )
      .order('effective_from', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch mappings' }, { status: 500 });
    }

    return NextResponse.json({ mappings: mappings || [] });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await assertSuperAdmin(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { aansh_id, assignee_id, assignee_role, effective_from, effective_to, day_of_week, time_from, time_to } = await request.json();

    if (!aansh_id || !assignee_id || !assignee_role) {
      return NextResponse.json({ error: 'aansh_id, assignee_id, assignee_role required' }, { status: 400 });
    }
    if (!['TELECALLER', 'RSA_MANAGER'].includes(String(assignee_role))) {
      return NextResponse.json({ error: 'Invalid assignee_role' }, { status: 400 });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const { data, error } = await supabaseAdmin
      .from('sarv_aansh_mappings')
      .insert({
        aansh_id,
        assignee_id,
        assignee_role,
        telecaller_id: assignee_role === 'TELECALLER' ? assignee_id : null,
        effective_from: effective_from || '1970-01-01T00:00:00Z',
        effective_to: effective_to || null,
        day_of_week: Array.isArray(day_of_week) && day_of_week.length ? day_of_week : null,
        time_from: time_from || null,
        time_to: time_to || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || 'Insert failed' }, { status: 500 });
    }

    return NextResponse.json({ mapping: data });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}
