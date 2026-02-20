import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { NextResponse } from 'next/server';

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
    const now = new Date().toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from('sarv_aansh_sessions')
      .select('id, aansh_id, user_id, assignee_role, expires_at, created_at')
      .is('released_at', null)
      .gt('expires_at', now)
      .order('expires_at', { ascending: true });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const list = Array.isArray(rows) ? rows : [];
    const userIds = [...new Set(list.map((r: any) => r.user_id).filter(Boolean))];
    let userMap: Record<string, { full_name?: string; email?: string }> = {};
    if (userIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from('users_login')
        .select('id, full_name, email')
        .in('id', userIds);
      for (const u of users || []) {
        userMap[u.id] = { full_name: u.full_name, email: u.email };
      }
    }
    const sessions = list.map((r: any) => ({
      ...r,
      user_name: userMap[r.user_id]?.full_name ?? null,
      user_email: userMap[r.user_id]?.email ?? null,
    }));
    return NextResponse.json({ sessions });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
