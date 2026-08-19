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

  const canManage = ['LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode);
  return {
    ok: true as const,
    userId: String((profile as any)?.id || user.id),
    canManage,
    roleCode,
  };
}

/** GET tags list; optional ?lead_id= for tags on a lead */
export async function GET(request: NextRequest) {
  const gate = await requireCrmUser(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ error: 'Admin unavailable' }, { status: 500 });

  const leadId = String(request.nextUrl.searchParams.get('lead_id') || '').trim();

  const { data: tags, error } = await supabaseAdmin
    .from('crm_lead_tags')
    .select('id, name, color, created_at')
    .order('name');

  if (error) {
    return NextResponse.json({
      tags: [],
      lead_tag_ids: [],
      warning: 'Run database/317_crm_manager_ops_tags_views_dnd.sql',
    });
  }

  let leadTagIds: string[] = [];
  if (leadId) {
    const { data: map } = await supabaseAdmin
      .from('crm_lead_tag_map')
      .select('tag_id')
      .eq('lead_id', leadId);
    leadTagIds = (map || []).map((m: any) => String(m.tag_id));
  }

  return NextResponse.json({ tags: tags || [], lead_tag_ids: leadTagIds });
}

/** POST create tag (manager) or set tags on lead */
export async function POST(request: NextRequest) {
  const gate = await requireCrmUser(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || 'create_tag').trim();

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ error: 'Admin unavailable' }, { status: 500 });

  if (action === 'create_tag') {
    if (!gate.canManage) {
      return NextResponse.json({ error: 'Only Lead Manager can create tags' }, { status: 403 });
    }
    const name = String(body?.name || '').trim();
    const color = String(body?.color || '#004AAD').trim() || '#004AAD';
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('crm_lead_tags')
      .insert({ name, color, created_by: gate.userId })
      .select('id, name, color')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, tag: data });
  }

  if (action === 'set_lead_tags') {
    const leadId = String(body?.lead_id || '').trim();
    const tagIds = Array.isArray(body?.tag_ids)
      ? body.tag_ids.map((x: unknown) => String(x || '').trim()).filter(Boolean)
      : [];
    if (!leadId) return NextResponse.json({ error: 'lead_id required' }, { status: 400 });

    await supabaseAdmin.from('crm_lead_tag_map').delete().eq('lead_id', leadId);
    if (tagIds.length) {
      const { error } = await supabaseAdmin.from('crm_lead_tag_map').insert(
        tagIds.map((tag_id: string) => ({
          lead_id: leadId,
          tag_id,
          tagged_by: gate.userId,
        })),
      );
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, lead_id: leadId, tag_ids: tagIds });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
