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
    const updates: any = { updated_at: new Date().toISOString(), car: '' };
    if (body?.name !== undefined) updates.name = String(body.name).trim();
    if (body?.stars !== undefined) updates.stars = Math.min(5, Math.max(1, Number(body.stars) || 5));
    if (body?.text !== undefined) updates.text = String(body.text).trim();
    if (body?.date !== undefined) updates.date = String(body.date).trim();
    if (body?.display_order !== undefined) updates.display_order = Number(body.display_order) || 0;
    if (body?.is_active !== undefined) updates.is_active = !!body.is_active;

    if (
      (body?.name !== undefined && !updates.name) ||
      (body?.text !== undefined && !updates.text) ||
      (body?.date !== undefined && !updates.date)
    ) {
      return NextResponse.json({ error: 'name, text, and date cannot be empty' }, { status: 400 });
    }

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
