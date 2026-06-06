import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function verifySupeAdmin() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: 'Unauthorized', status: 401 };

  const { data: userData } = await supabase
    .from('users_login')
    .select('roles:role_id (role_code)')
    .eq('id', session.user.id)
    .single();

  // @ts-ignore
  if (userData?.roles?.role_code !== 'SUPER_ADMIN') {
    return { error: 'Forbidden', status: 403 };
  }

  return { error: null, status: 200 };
}

export async function PUT(request: Request, { params }: { params: Promise<{ uuid: string }> }) {
  try {
    const { uuid } = await params;
    const authCheck = await verifySupeAdmin();
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (adminErr || !supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const body = await request.json();
    const { category, description } = body;

    if (!category || !category.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('categories')
      .update({
        category: category.trim(),
        description: description?.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq('uuid', uuid)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Category name already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ uuid: string }> }) {
  try {
    const { uuid } = await params;
    const authCheck = await verifySupeAdmin();
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (adminErr || !supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Unlink services from this category first
    await supabaseAdmin
      .from('service_types')
      .update({ category_uuid: null })
      .eq('category_uuid', uuid);

    // Delete the category
    const { error } = await supabaseAdmin
      .from('categories')
      .delete()
      .eq('uuid', uuid);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
