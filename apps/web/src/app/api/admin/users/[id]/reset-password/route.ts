import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getAdminAuth() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { admin: null as any, error: 'Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL' };
  const admin = createSupabaseAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { admin, error: null };
}

async function requireSuperAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userProfile, error: profileError } = await supabase
    .from('users_login')
    .select('role:roles!role_id(role_code)')
    .eq('id', user.id)
    .single();

  if (profileError || !userProfile) return { ok: false as const, status: 403, error: 'Forbidden' };
  const roleCode = (userProfile.role as any)?.role_code;
  if (roleCode !== 'SUPER_ADMIN') return { ok: false as const, status: 403, error: 'Forbidden' };

  return { ok: true as const, userId: user.id };
}

// POST: reset a user's password (SUPER_ADMIN only)
export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const params = await paramsPromise;
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { admin, error: adminErr } = getAdminAuth();
    if (!admin) return NextResponse.json({ error: adminErr }, { status: 500 });

    const targetUserId = String(params?.id || '').trim();
    if (!targetUserId) return NextResponse.json({ error: 'Missing user id' }, { status: 400 });

    const body = await request.json().catch(() => null) as any;
    const password = String(body?.password || '');
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const { data, error } = await admin.auth.admin.updateUserById(targetUserId, { password });
    if (error) throw error;

    return NextResponse.json({ ok: true, user: { id: data?.user?.id || targetUserId } });
  } catch (error: any) {
    console.error('[admin/users][reset-password][POST]', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

