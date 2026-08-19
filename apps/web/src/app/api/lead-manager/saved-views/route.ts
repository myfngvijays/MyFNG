import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function requireCrmUser(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('users_login')
    .select('id, roles!role_id(role_code)')
    .eq('id', user.id)
    .maybeSingle();

  const roleCode = String((profile as { roles?: { role_code?: string } } | null)?.roles?.role_code || '')
    .trim()
    .toUpperCase();

  if (!['LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN', 'TELECALLER'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  const canShare = ['LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode);
  return {
    ok: true as const,
    userId: String((profile as any)?.id || user.id),
    canShare,
    roleCode,
  };
}

/** GET own + shared saved views */
export async function GET(request: NextRequest) {
  const gate = await requireCrmUser(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ error: 'Admin unavailable' }, { status: 500 });

  const { data, error } = await supabaseAdmin
    .from('crm_saved_views')
    .select('id, name, owner_id, is_shared, filters, created_at, updated_at')
    .or(`owner_id.eq.${gate.userId},is_shared.eq.true`)
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({
      views: [],
      warning: 'Run database/317_crm_manager_ops_tags_views_dnd.sql',
    });
  }

  return NextResponse.json({ views: data || [] });
}

/** POST create / update saved view */
export async function POST(request: NextRequest) {
  const gate = await requireCrmUser(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await request.json().catch(() => ({}));
  const id = String(body?.id || '').trim();
  const name = String(body?.name || '').trim();
  const filters = body?.filters && typeof body.filters === 'object' ? body.filters : {};
  const isShared = Boolean(body?.is_shared) && gate.canShare;

  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ error: 'Admin unavailable' }, { status: 500 });

  if (id) {
    const { data: existing } = await supabaseAdmin
      .from('crm_saved_views')
      .select('id, owner_id')
      .eq('id', id)
      .maybeSingle();
    if (!existing || String((existing as any).owner_id) !== gate.userId) {
      return NextResponse.json({ error: 'View not found or not owned' }, { status: 404 });
    }
    const { data, error } = await supabaseAdmin
      .from('crm_saved_views')
      .update({
        name,
        filters,
        is_shared: isShared,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, name, owner_id, is_shared, filters, created_at, updated_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, view: data });
  }

  const { data, error } = await supabaseAdmin
    .from('crm_saved_views')
    .insert({
      name,
      owner_id: gate.userId,
      is_shared: isShared,
      filters,
    })
    .select('id, name, owner_id, is_shared, filters, created_at, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, view: data });
}

export async function DELETE(request: NextRequest) {
  const gate = await requireCrmUser(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const id = String(request.nextUrl.searchParams.get('id') || '').trim();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ error: 'Admin unavailable' }, { status: 500 });

  const { error } = await supabaseAdmin
    .from('crm_saved_views')
    .delete()
    .eq('id', id)
    .eq('owner_id', gate.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
