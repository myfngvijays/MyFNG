import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (adminErr || !supabaseAdmin) {
      const { data, error } = await supabase
        .from('categories')
        .select('uuid, category, description, sequence, status')
        .eq('status', true)
        .order('sequence', { ascending: true });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data || []);
    }

    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('uuid, category, description, sequence, status')
      .eq('status', true)
      .order('sequence', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users_login')
      .select('roles:role_id (role_code)')
      .eq('id', session.user.id)
      .single();

    // @ts-ignore
    if (userData?.roles?.role_code !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (adminErr || !supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error: missing service role key' }, { status: 500 });
    }

    const body = await request.json();
    const { category, description } = body;

    if (!category || !category.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const { data: maxSeq } = await supabaseAdmin
      .from('categories')
      .select('sequence')
      .order('sequence', { ascending: false })
      .limit(1)
      .single();

    const nextSequence = (maxSeq?.sequence || 0) + 1;

    const { data, error } = await supabaseAdmin
      .from('categories')
      .insert([{
        category: category.trim(),
        description: description?.trim() || null,
        sequence: nextSequence,
        status: true
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Category already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
