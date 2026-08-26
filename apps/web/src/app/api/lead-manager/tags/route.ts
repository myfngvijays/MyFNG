import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Soft palette — each new tag rotates to a different color */
export const CRM_TAG_COLORS = [
  '#DDD6FE',
  '#BFDBFE',
  '#FECACA',
  '#BBF7D0',
  '#FED7AA',
  '#FBCFE8',
  '#A5F3FC',
  '#FEF08A',
  '#C7D2FE',
  '#99F6E4',
  '#FDE68A',
  '#E9D5FF',
] as const;

function nextAutoColor(existingColors: string[]): string {
  const used = new Set(
    existingColors.map((c) => String(c || '').trim().toUpperCase()).filter(Boolean),
  );
  for (const c of CRM_TAG_COLORS) {
    if (!used.has(c.toUpperCase())) return c;
  }
  // All used — rotate by count
  return CRM_TAG_COLORS[existingColors.length % CRM_TAG_COLORS.length];
}

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

  if (!['LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN', 'TELECALLER', 'APP_OPERATIONS'].includes(roleCode)) {
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
    .select('id, name, color, parent_tag_id, created_at')
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

  const mapTagIds = String(request.nextUrl.searchParams.get('map_tag_ids') || '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
    .slice(0, 80);

  let maps: Array<{ lead_id: string; tag_id: string }> = [];
  if (mapTagIds.length > 0) {
    const { data: mapRows } = await supabaseAdmin
      .from('crm_lead_tag_map')
      .select('lead_id, tag_id')
      .in('tag_id', mapTagIds)
      .limit(20000);
    maps = (mapRows || []).map((row: any) => ({
      lead_id: String(row.lead_id),
      tag_id: String(row.tag_id),
    }));
  }

  return NextResponse.json({
    tags: tags || [],
    lead_tag_ids: leadTagIds,
    maps,
    palette: [...CRM_TAG_COLORS],
  });
}

/** POST create / update / delete tag (manager) or set tags on lead */
export async function POST(request: NextRequest) {
  const gate = await requireCrmUser(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || 'create_tag').trim();

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ error: 'Admin unavailable' }, { status: 500 });

  if (action === 'create_tag') {
    if (!gate.canManage) {
      return NextResponse.json({ error: 'Only managers/admins can create tags' }, { status: 403 });
    }
    const name = String(body?.name || '').trim();
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    const { data: existingRows } = await supabaseAdmin.from('crm_lead_tags').select('id, name, color');
    const dup = (existingRows || []).find(
      (r: any) => String(r.name || '').trim().toLowerCase() === name.toLowerCase(),
    );
    if (dup) {
      return NextResponse.json(
        {
          error: `Tag already exists as "${dup.name}" (case-insensitive). Use edit instead.`,
          existing: dup,
        },
        { status: 409 },
      );
    }

    const autoColor = nextAutoColor((existingRows || []).map((r: any) => String(r.color || '')));
    const color =
      body?.auto_color === false && String(body?.color || '').trim()
        ? String(body.color).trim()
        : autoColor;
    const parent_tag_id = String(body?.parent_tag_id || '').trim() || null;

    const { data, error } = await supabaseAdmin
      .from('crm_lead_tags')
      .insert({ name, color, created_by: gate.userId, parent_tag_id })
      .select('id, name, color, parent_tag_id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, tag: data });
  }

  if (action === 'update_tag') {
    if (!gate.canManage) {
      return NextResponse.json({ error: 'Only managers/admins can edit tags' }, { status: 403 });
    }
    const id = String(body?.id || body?.tag_id || '').trim();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const patch: Record<string, string | null> = {};
    if (body?.name != null) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

      const { data: existingRows } = await supabaseAdmin.from('crm_lead_tags').select('id, name');
      const dup = (existingRows || []).find(
        (r: any) =>
          String(r.id) !== id &&
          String(r.name || '').trim().toLowerCase() === name.toLowerCase(),
      );
      if (dup) {
        return NextResponse.json(
          {
            error: `Another tag already exists as "${dup.name}" (case-insensitive).`,
            existing: dup,
          },
          { status: 409 },
        );
      }
      patch.name = name;
    }
    if (body?.color != null) {
      const color = String(body.color).trim();
      if (color) patch.color = color;
    }
    if (body?.parent_tag_id !== undefined) {
      const pid = String(body.parent_tag_id || '').trim();
      patch.parent_tag_id = pid || null;
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('crm_lead_tags')
      .update(patch)
      .eq('id', id)
      .select('id, name, color, parent_tag_id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, tag: data });
  }

  if (action === 'delete_tag') {
    if (!gate.canManage) {
      return NextResponse.json({ error: 'Only managers/admins can delete tags' }, { status: 403 });
    }
    const id = String(body?.id || body?.tag_id || '').trim();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Map rows cascade via FK ON DELETE CASCADE
    const { error } = await supabaseAdmin.from('crm_lead_tags').delete().eq('id', id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, deleted: id });
  }

  if (action === 'set_lead_tags' || action === 'add_lead_tags') {
    const leadId = String(body?.lead_id || '').trim();
    let tagIds = Array.isArray(body?.tag_ids)
      ? body.tag_ids.map((x: unknown) => String(x || '').trim()).filter(Boolean)
      : [];
    if (!leadId) return NextResponse.json({ error: 'lead_id required' }, { status: 400 });

    // Expand parent (common) tags — applying "Meta Ads A" also keeps "Meta Ads"
    if (tagIds.length) {
      const { data: rows } = await supabaseAdmin
        .from('crm_lead_tags')
        .select('id, parent_tag_id')
        .in('id', tagIds);
      const expanded = new Set(tagIds);
      for (const r of rows || []) {
        if (r.parent_tag_id) expanded.add(String(r.parent_tag_id));
      }
      tagIds = Array.from(expanded);
    }

    if (action === 'add_lead_tags') {
      const { data: existingMap } = await supabaseAdmin
        .from('crm_lead_tag_map')
        .select('tag_id')
        .eq('lead_id', leadId);
      const have = new Set((existingMap || []).map((m: any) => String(m.tag_id)));
      const toInsert = tagIds.filter((id) => !have.has(id));
      if (toInsert.length) {
        const { error } = await supabaseAdmin.from('crm_lead_tag_map').insert(
          toInsert.map((tag_id: string) => ({
            lead_id: leadId,
            tag_id,
            tagged_by: gate.userId,
          })),
        );
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, lead_id: leadId, tag_ids: tagIds, mode: 'add' });
    }

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
