import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const TABLE = 'rsa_screen_hero_banners';
const MIGRATION_HINT = 'Database table missing. Run `database/155_rsa_screen_hero_banner.sql` in Supabase (SQL editor) and reload.';

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
      const code = (error as any).code as string | undefined;
      const hintIfMissingTable = code === '42P01' || /does not exist/i.test(error.message) ? MIGRATION_HINT : undefined;
      return NextResponse.json(
        { error: hintIfMissingTable || 'Failed to fetch RSA hero banner', details: error.message, code },
        { status: 500 },
      );
    }
    return NextResponse.json({ data: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const { count } = await supabase.from(TABLE).select('id', { count: 'exact', head: true });
    if ((count || 0) >= 1) {
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

    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        title: title || null,
        image_url,
        route_name: route_name || 'RoadsideAssistance',
        route_params: route_params || {},
        display_order: Number.isFinite(Number(display_order)) ? Number(display_order) : 0,
        is_active: is_active !== undefined ? !!is_active : true,
      })
      .select()
      .single();

    if (error) {
      const code = (error as any).code as string | undefined;
      const hintIfMissingTable = code === '42P01' || /does not exist/i.test(error.message) ? MIGRATION_HINT : undefined;
      return NextResponse.json(
        { error: hintIfMissingTable || 'Failed to create RSA hero banner', details: error.message, code },
        { status: 500 },
      );
    }
    return NextResponse.json({ data, message: 'RSA hero banner created successfully' });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
