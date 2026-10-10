import { createClient } from '@/lib/supabase/server';
import { getTopOfferBanner, normalizeTopOfferBanner, saveTopOfferBanner } from '@/lib/top-offer-banner';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function assertSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false as const, status: 401, error: 'Unauthorized', user: null };

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();
  if (roleError || !userData) {
    return { ok: false as const, status: 403, error: 'Forbidden', user: null };
  }
  const roleCode = (userData as { roles?: { role_code?: string } }).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(String(roleCode || ''))) {
    return { ok: false as const, status: 403, error: 'Forbidden', user: null };
  }
  return { ok: true as const, status: 200, error: null, user };
}

export async function GET() {
  const auth = await assertSuperAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const config = await getTopOfferBanner();
  return NextResponse.json({ success: true, config });
}

export async function PATCH(request: NextRequest) {
  const auth = await assertSuperAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => ({}));
  try {
    const config = await saveTopOfferBanner(
      normalizeTopOfferBanner(body?.config || body),
      auth.user?.id || null,
    );
    return NextResponse.json({ success: true, config });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Save failed' }, { status: 500 });
  }
}
