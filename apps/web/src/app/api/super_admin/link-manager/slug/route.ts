import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { assertShortCodeAvailable } from '@/lib/link-manager/service';
import { sanitizeCustomCode } from '@/lib/link-manager/utils';

export const dynamic = 'force-dynamic';

async function requireSuperAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userProfile, error: profileError } = await supabase
    .from('users_login')
    .select('role:roles!role_id(role_code)')
    .eq('id', user.id)
    .single();

  const roleCode = (userProfile?.role as any)?.role_code;
  if (profileError || roleCode !== 'SUPER_ADMIN') {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return { ok: true as const };
}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminErr }, { status: 500 });

    const slug = sanitizeCustomCode(request.nextUrl.searchParams.get('code') || '');
    const except = String(request.nextUrl.searchParams.get('except') || '').trim() || null;

    if (slug.length < 2) {
      return NextResponse.json({ slug, available: false, used: false, empty: true });
    }

    try {
      await assertShortCodeAvailable(supabaseAdmin, slug, except);
      return NextResponse.json({ slug, available: true, used: false });
    } catch (e: any) {
      const message = String(e?.message || '');
      const used = /already (taken|used)/i.test(message);
      return NextResponse.json({
        slug,
        available: false,
        used,
        message: used ? 'This slug is already used' : message,
      });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
