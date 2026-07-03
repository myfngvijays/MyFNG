import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

async function requireSuperAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userProfile, error: profileError } = await supabase
    .from('users_login')
    .select('role:roles!role_id(role_code)')
    .eq('id', user.id)
    .single();

  const roleCode = (userProfile?.role as any)?.role_code;
  if (profileError || roleCode !== 'SUPER_ADMIN') {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return { ok: true as const };
}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    const { data, error } = await supabaseAdmin
      .from('app_settings_menu')
      .select('*')
      .order('section')
      .order('display_order');

    if (error) throw error;

    return NextResponse.json({ items: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    const body = await request.json();
    const { items } = body;

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 });
    }

    for (const item of items) {
      const update: Record<string, any> = { updated_at: new Date().toISOString() };
      if (item.enabled !== undefined) update.enabled = item.enabled;
      if (item.label !== undefined) update.label = item.label;
      if (item.display_order !== undefined) update.display_order = item.display_order;

      await supabaseAdmin
        .from('app_settings_menu')
        .update(update)
        .eq('menu_id', item.menu_id);
    }

    const { data } = await supabaseAdmin
      .from('app_settings_menu')
      .select('*')
      .order('section')
      .order('display_order');

    return NextResponse.json({ items: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
