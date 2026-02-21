import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function assertSessionManager(supabase: any) {
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
  if (!['SUPER_ADMIN', 'SUB_ADMIN', 'RSA_MANAGER'].includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden - Not allowed', user };
  }
  return { ok: true, status: 200, error: null, user };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await assertSessionManager(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }
    const { data: rows, error } = await supabaseAdmin
      .from('sarv_aansh_sessions')
      .select('id, aansh_id, user_id, assignee_role, expires_at, created_at')
      .is('released_at', null)
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

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await assertSessionManager(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    let body: { session_id?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const sessionId = typeof body?.session_id === 'string' ? body.session_id.trim() : '';
    if (!sessionId) {
      return NextResponse.json({ error: 'session_id required' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('sarv_aansh_sessions')
      .update({ released_at: now })
      .eq('id', sessionId)
      .is('released_at', null)
      .select('id')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Session not found or already released' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
