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

export async function PATCH(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await paramsPromise;
    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: 'Admin client error' }, { status: 500 });

    const body = await request.json();
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    const fields = [
      'title', 'body', 'icon', 'image_url',
      'primary_button_text', 'primary_button_action',
      'secondary_button_text', 'display_rule', 'show_for',
      'is_active', 'priority', 'starts_at', 'ends_at',
    ] as const;

    for (const f of fields) {
      if (body[f] !== undefined) update[f] = body[f];
    }
    if (Array.isArray(body.target_screens)) update.target_screens = body.target_screens;
    if (body.priority !== undefined) update.priority = Number(body.priority || 0);

    const { data, error } = await supabaseAdmin
      .from('app_popups')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ popup: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await paramsPromise;
    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: 'Admin client error' }, { status: 500 });

    const { error } = await supabaseAdmin.from('app_popups').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
