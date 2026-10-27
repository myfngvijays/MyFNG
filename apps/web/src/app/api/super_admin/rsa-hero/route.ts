import { createClient } from '@/lib/supabase/server';
import { createRsaHeroBanner, listRsaHeroBanners } from '@/lib/rsa/heroBanner';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function requireSuperAdmin(supabase: any) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  if (roleError || !userData) {
    return { ok: false, res: NextResponse.json({ error: 'Forbidden - Role check failed' }, { status: 403 }) };
  }

  const roleCode = (userData as any).roles?.role_code;
  if (roleCode !== 'SUPER_ADMIN') {
    return { ok: false, res: NextResponse.json({ error: 'Forbidden - Not super admin' }, { status: 403 }) };
  }

  return { ok: true, user };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const { data, error } = await listRsaHeroBanners();
    if (error) {
      return NextResponse.json({ error: 'Failed to fetch RSA hero banner', details: error }, { status: 500 });
    }
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const existing = await listRsaHeroBanners();
    if (existing.error) {
      return NextResponse.json({ error: 'Failed to create RSA hero banner', details: existing.error }, { status: 500 });
    }
    if (existing.data.length >= 1) {
      return NextResponse.json(
        { error: 'Only one RSA hero banner is allowed. Edit or delete the existing banner first.' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { title, image_url, route_name, route_params, display_order, is_active } = body || {};

    if (!image_url) {
      return NextResponse.json({ error: 'image_url is required' }, { status: 400 });
    }

    const { data, error } = await createRsaHeroBanner({
      title: title || null,
      image_url,
      route_name: route_name || 'RoadsideAssistance',
      route_params: route_params || {},
      display_order: Number.isFinite(Number(display_order)) ? Number(display_order) : 0,
      is_active: is_active !== undefined ? !!is_active : true,
    });

    if (error || !data) {
      return NextResponse.json(
        { error: 'Failed to create RSA hero banner', details: error || 'Save failed' },
        { status: 500 },
      );
    }
    return NextResponse.json({ data, message: 'RSA hero banner created successfully' });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
