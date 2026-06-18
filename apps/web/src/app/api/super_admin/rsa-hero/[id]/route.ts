import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const TABLE = 'rsa_screen_hero_banners';
const MIGRATION_HINT = 'Database table missing. Run `database/155_rsa_screen_hero_banner.sql` in Supabase (SQL editor) and retry.';

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

export async function PUT(request: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const id = params.id;
    const body = await request.json();
    const { title, image_url, route_name, route_params, display_order, is_active } = body || {};

    const patch: any = {};
    if (title !== undefined) patch.title = title || null;
    if (image_url !== undefined) patch.image_url = image_url;
    if (route_name !== undefined) patch.route_name = route_name;
    if (route_params !== undefined) patch.route_params = route_params || {};
    if (display_order !== undefined) patch.display_order = Number.isFinite(Number(display_order)) ? Number(display_order) : 0;
    if (is_active !== undefined) patch.is_active = !!is_active;
    patch.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from(TABLE).update(patch).eq('id', id).select().single();
    if (error) {
      const code = (error as any).code as string | undefined;
      const hintIfMissingTable = code === '42P01' || /does not exist/i.test(error.message) ? MIGRATION_HINT : undefined;
      return NextResponse.json(
        { error: hintIfMissingTable || 'Failed to update RSA hero banner', details: error.message, code },
        { status: 500 },
      );
    }
    return NextResponse.json({ data, message: 'RSA hero banner updated successfully' });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const id = params.id;
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) {
      const code = (error as any).code as string | undefined;
      const hintIfMissingTable = code === '42P01' || /does not exist/i.test(error.message) ? MIGRATION_HINT : undefined;
      return NextResponse.json(
        { error: hintIfMissingTable || 'Failed to delete RSA hero banner', details: error.message, code },
        { status: 500 },
      );
    }
    return NextResponse.json({ message: 'RSA hero banner deleted successfully' });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
