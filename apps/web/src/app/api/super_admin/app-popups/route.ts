import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function assertSuperAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();
  if (roleError || !userData) return { ok: false as const, status: 403, error: 'Forbidden' };

  const roleCode = (userData as any).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode))
    return { ok: false as const, status: 403, error: 'Forbidden' };

  return { ok: true as const };
}

export async function GET() {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: 'Admin client error' }, { status: 500 });

    const { data, error } = await supabaseAdmin
      .from('app_popups')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ popups: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: 'Admin client error' }, { status: 500 });

    const body = await request.json();
    const insert = {
      title: String(body.title || '').trim(),
      body: body.body || null,
      icon: body.icon || 'gift',
      image_url: body.image_url || null,
      primary_button_text: body.primary_button_text || 'OK',
      primary_button_action: body.primary_button_action || 'DISMISS',
      secondary_button_text: body.secondary_button_text || null,
      target_screens: Array.isArray(body.target_screens) ? body.target_screens : ['HOME'],
      display_rule: body.display_rule || 'ONCE_PER_SESSION',
      show_for: body.show_for || 'ALL',
      is_active: body.is_active !== false,
      priority: Number(body.priority || 0),
      starts_at: body.starts_at || null,
      ends_at: body.ends_at || null,
    };

    if (!insert.title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('app_popups')
      .insert(insert)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ popup: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
