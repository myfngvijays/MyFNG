import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

const FULL_ADMIN_ROLES = ['SUPER_ADMIN', 'SUB_ADMIN'];
const TELECALLER_VISIBILITY_ROLES = ['SUPER_ADMIN', 'SUB_ADMIN', 'LEAD_MANAGER'];

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

async function resolveUser(db: any) {
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (authError || !user) {
    return { ok: false as const, status: 401, error: 'Unauthorized', roleCode: '', userProfile: null };
  }

  const { data: userProfile } = await db
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .maybeSingle();

  const roleCode = String((userProfile as any)?.roles?.role_code || '').toUpperCase();
  if (!userProfile) {
    return { ok: false as const, status: 403, error: 'Forbidden', roleCode: '', userProfile: null };
  }
  return { ok: true as const, status: 200, error: null, roleCode, userProfile };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Invalid template id' }, { status: 400 });

    const supabase = await createClient();
    const db: any = supabase;
    const auth = await resolveUser(db);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const wantsCrmTelecaller = body?.crm_telecaller !== undefined;
    const wantsFullUpdate =
      body?.display_name !== undefined ||
      body?.body_text !== undefined ||
      body?.is_active !== undefined ||
      body?.language_code !== undefined ||
      body?.category !== undefined ||
      body?.variable_keys !== undefined ||
      body?.example_values !== undefined;

    if (wantsFullUpdate && !FULL_ADMIN_ROLES.includes(auth.roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (wantsCrmTelecaller && !TELECALLER_VISIBILITY_ROLES.includes(auth.roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!wantsFullUpdate && !wantsCrmTelecaller) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    const writeDb = supabaseAdmin || db;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body?.display_name !== undefined) updates.display_name = String(body.display_name || '').trim() || null;
    if (body?.body_text !== undefined) updates.body_text = String(body.body_text || '').trim();
    if (body?.is_active !== undefined) updates.is_active = Boolean(body.is_active);
    if (body?.language_code !== undefined) updates.language_code = String(body.language_code || 'en').trim() || 'en';
    if (body?.category !== undefined) updates.category = String(body.category || 'UTILITY').trim().toUpperCase();
    if (body?.variable_keys !== undefined) {
      updates.variable_keys = Array.isArray(body.variable_keys)
        ? body.variable_keys.map((v: unknown) => String(v || '').trim()).filter(Boolean)
        : [];
    }
    if (body?.example_values !== undefined) {
      updates.example_values = Array.isArray(body.example_values)
        ? body.example_values.map((v: unknown) => String(v || '').trim()).filter(Boolean)
        : [];
    }

    if (wantsCrmTelecaller) {
      const { data: existing, error: existingError } = await writeDb
        .from('whatsapp_templates')
        .select('meta')
        .eq('id', id)
        .maybeSingle();
      if (existingError) {
        return NextResponse.json({ error: existingError.message || 'Lookup failed' }, { status: 500 });
      }
      const prevMeta =
        existing?.meta && typeof existing.meta === 'object' && !Array.isArray(existing.meta)
          ? (existing.meta as Record<string, unknown>)
          : {};
      updates.meta = {
        ...prevMeta,
        crm_telecaller: Boolean(body.crm_telecaller),
      };
    }

    const { data, error } = await writeDb
      .from('whatsapp_templates')
      .update(updates)
      .eq('id', id)
      .select(
        'id, template_name, display_name, language_code, category, body_text, variable_keys, example_values, is_active, meta, created_at, updated_at'
      )
      .single();

    if (error) return NextResponse.json({ error: error.message || 'Update failed' }, { status: 500 });

    if (body?.is_active === true && data?.template_name) {
      await writeDb
        .from('whatsapp_automation_settings')
        .update({ is_enabled: true, updated_at: new Date().toISOString() })
        .eq('template_name', String(data.template_name));
    }

    return NextResponse.json({ success: true, template: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Invalid template id' }, { status: 400 });

    const supabase = await createClient();
    const db: any = supabase;
    const auth = await resolveUser(db);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    if (!FULL_ADMIN_ROLES.includes(auth.roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await db.from('whatsapp_templates').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message || 'Delete failed' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
