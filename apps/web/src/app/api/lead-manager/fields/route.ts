import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SETTING_KEY = 'crm_lead_custom_fields';

function missingRelation(error: { code?: string; message?: string } | null | undefined) {
  const msg = String(error?.message || '').toLowerCase();
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  );
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
  return { ok: true as const, userId: String((profile as { id?: string } | null)?.id || user.id), canManage };
}

async function readSettings(supabaseAdmin: any) {
  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', SETTING_KEY)
    .maybeSingle();
  try {
    const parsed = JSON.parse(String(data?.setting_value || '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeSettings(supabaseAdmin: any, rows: any[], userId?: string | null) {
  const { error } = await supabaseAdmin.from('system_settings').upsert(
    {
      setting_key: SETTING_KEY,
      setting_value: JSON.stringify(rows),
      setting_type: 'JSON',
      category: 'SYSTEM',
      description: 'Custom lead fields added from Lead Fields',
      is_editable: true,
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'setting_key' },
  );
  return error;
}

async function loadFields(supabaseAdmin: any) {
  const { data, error } = await supabaseAdmin
    .from('crm_lead_custom_fields')
    .select('id, name, field_type, sort_order, is_active, created_at')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error && missingRelation(error)) {
    const rows = await readSettings(supabaseAdmin);
    return { fields: rows.filter((r: any) => r.is_active !== false), store: 'settings' as const };
  }
  if (error) return { fields: [] as any[], store: 'table' as const, error: error.message };
  return {
    fields: (data || []).filter((r: any) => r.is_active !== false),
    store: 'table' as const,
  };
}

export async function GET(request: NextRequest) {
  const gate = await requireCrmUser(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ error: 'Admin unavailable' }, { status: 500 });

  const pack = await loadFields(supabaseAdmin);
  if (pack.error) return NextResponse.json({ error: pack.error }, { status: 500 });
  return NextResponse.json({ fields: pack.fields });
}

export async function POST(request: NextRequest) {
  const gate = await requireCrmUser(request);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (!gate.canManage) {
    return NextResponse.json({ error: 'Only managers/admins can manage fields' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || 'create_field').trim();
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ error: 'Admin unavailable' }, { status: 500 });

  const pack = await loadFields(supabaseAdmin);
  const rows = pack.store === 'settings' ? await readSettings(supabaseAdmin) : pack.fields;

  if (action === 'create_field') {
    const name = String(body?.name || '').trim();
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const dup = rows.find((r: any) => String(r.name || '').trim().toLowerCase() === name.toLowerCase());
    if (dup) {
      return NextResponse.json({ error: `Field already exists as "${dup.name}"` }, { status: 409 });
    }

    if (pack.store === 'settings') {
      const field = {
        id: crypto.randomUUID(),
        name,
        field_type: 'text',
        sort_order: rows.length * 10 + 10,
        is_active: true,
      };
      const writeErr = await writeSettings(supabaseAdmin, [...rows, field], gate.userId);
      if (writeErr) return NextResponse.json({ error: writeErr.message }, { status: 500 });
      return NextResponse.json({ success: true, field });
    }

    const { data, error } = await supabaseAdmin
      .from('crm_lead_custom_fields')
      .insert({
        name,
        field_type: 'text',
        sort_order: rows.length * 10 + 10,
        is_active: true,
        created_by: gate.userId,
      })
      .select('id, name, field_type, sort_order, is_active')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, field: data });
  }

  if (action === 'update_field') {
    const id = String(body?.id || '').trim();
    const name = String(body?.name || '').trim();
    if (!id || !name) return NextResponse.json({ error: 'id and name required' }, { status: 400 });
    const dup = rows.find(
      (r: any) => String(r.id) !== id && String(r.name || '').trim().toLowerCase() === name.toLowerCase(),
    );
    if (dup) return NextResponse.json({ error: `Another field already exists as "${dup.name}"` }, { status: 409 });

    if (pack.store === 'settings') {
      const next = rows.map((r: any) => (String(r.id) === id ? { ...r, name } : r));
      const writeErr = await writeSettings(supabaseAdmin, next, gate.userId);
      if (writeErr) return NextResponse.json({ error: writeErr.message }, { status: 500 });
      return NextResponse.json({ success: true, field: next.find((r: any) => String(r.id) === id) || null });
    }

    const { data, error } = await supabaseAdmin
      .from('crm_lead_custom_fields')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, name, field_type, sort_order, is_active')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, field: data });
  }

  if (action === 'delete_field') {
    const id = String(body?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    if (pack.store === 'settings') {
      const writeErr = await writeSettings(
        supabaseAdmin,
        rows.filter((r: any) => String(r.id) !== id),
        gate.userId,
      );
      if (writeErr) return NextResponse.json({ error: writeErr.message }, { status: 500 });
      return NextResponse.json({ success: true, deleted: id });
    }

    const { error } = await supabaseAdmin.from('crm_lead_custom_fields').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, deleted: id });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
