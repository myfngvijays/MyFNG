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
      console.error('[customer-reviews][GET] supabase error:', error);
      const code = (error as any).code as string | undefined;
      const hintIfMissingTable =
        code === '42P01' || /does not exist/i.test(error.message)
          ? 'Database table missing. Run `database/147_customer_reviews.sql` in Supabase (SQL editor) and reload.'
          : undefined;
      return NextResponse.json(
        { error: hintIfMissingTable || 'Failed to fetch reviews', details: error.message, code },
        { status: 500 }
      );
    }
    return NextResponse.json({ data: data || [] });
  } catch (e: any) {
    console.error('[customer-reviews][GET] exception:', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const body = await request.json();
    const { name, car, stars, text, date, display_order, is_active } = body || {};

    if (!name || !car || !text || !date) {
      return NextResponse.json({ error: 'name, car, text, and date are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        name,
        car,
        stars: Math.min(5, Math.max(1, Number(stars) || 5)),
        text,
        date,
        display_order: Number.isFinite(Number(display_order)) ? Number(display_order) : 0,
        is_active: is_active !== undefined ? !!is_active : true,
      })
      .select()
      .single();

    if (error) {
      console.error('[customer-reviews][POST] supabase error:', error);
      const code = (error as any).code as string | undefined;
      const hintIfMissingTable =
        code === '42P01' || /does not exist/i.test(error.message)
          ? 'Database table missing. Run `database/147_customer_reviews.sql` in Supabase (SQL editor) and retry.'
          : undefined;
      return NextResponse.json(
        { error: hintIfMissingTable || 'Failed to create review', details: error.message, code },
        { status: 500 }
      );
    }
    return NextResponse.json({ data, message: 'Review created successfully' });
  } catch (e: any) {
    console.error('[customer-reviews][POST] exception:', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
