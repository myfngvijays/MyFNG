import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const TABLE = 'customer_reviews';

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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const body = await request.json();
    const { name, car, stars, text, date, display_order, is_active } = body || {};

    const updates: any = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (car !== undefined) updates.car = car;
    if (stars !== undefined) updates.stars = Math.min(5, Math.max(1, Number(stars) || 5));
    if (text !== undefined) updates.text = text;
    if (date !== undefined) updates.date = date;
    if (display_order !== undefined) updates.display_order = Number(display_order) || 0;
    if (is_active !== undefined) updates.is_active = !!is_active;

    const { data, error } = await supabase
      .from(TABLE)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[customer-reviews][PUT] supabase error:', error);
      return NextResponse.json({ error: 'Failed to update review', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ data, message: 'Review updated successfully' });
  } catch (e: any) {
    console.error('[customer-reviews][PUT] exception:', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const { error } = await supabase.from(TABLE).delete().eq('id', id);

    if (error) {
      console.error('[customer-reviews][DELETE] supabase error:', error);
      return NextResponse.json({ error: 'Failed to delete review', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Review deleted successfully' });
  } catch (e: any) {
    console.error('[customer-reviews][DELETE] exception:', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
