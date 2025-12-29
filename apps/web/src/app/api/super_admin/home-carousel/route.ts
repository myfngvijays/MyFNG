import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const TABLE = 'home_carousel_banners';

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

    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[home-carousel][GET] supabase error:', error);
      const code = (error as any).code as string | undefined;
      const hintIfMissingTable =
        code === '42P01' || /does not exist/i.test(error.message)
          ? 'Database table missing. Run `database/103_home_carousel_banners.sql` in Supabase (SQL editor) and reload.'
          : undefined;
      return NextResponse.json(
        {
          error: hintIfMissingTable || 'Failed to fetch banners',
          details: error.message,
          code,
          hint: (error as any).hint,
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ data: data || [] });
  } catch (e: any) {
    console.error('[home-carousel][GET] exception:', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const body = await request.json();
    const { title, image_url, route_name, route_params, display_order, is_active } = body || {};

    if (!image_url || !route_name) {
      return NextResponse.json({ error: 'image_url and route_name are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        title: title || null,
        image_url,
        route_name,
        route_params: route_params || {},
        display_order: Number.isFinite(Number(display_order)) ? Number(display_order) : 0,
        is_active: is_active !== undefined ? !!is_active : true,
      })
      .select()
      .single();

    if (error) {
      console.error('[home-carousel][POST] supabase error:', error);
      const code = (error as any).code as string | undefined;
      const hintIfMissingTable =
        code === '42P01' || /does not exist/i.test(error.message)
          ? 'Database table missing. Run `database/103_home_carousel_banners.sql` in Supabase (SQL editor) and retry.'
          : undefined;
      return NextResponse.json(
        {
          error: hintIfMissingTable || 'Failed to create banner',
          details: error.message,
          code,
          hint: (error as any).hint,
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ data, message: 'Banner created successfully' });
  } catch (e: any) {
    console.error('[home-carousel][POST] exception:', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}


