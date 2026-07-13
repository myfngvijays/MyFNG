import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

const ALLOWED_ADMIN_ROLES = ['SUPER_ADMIN', 'SUB_ADMIN'];

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

async function assertAdmin(db: any) {
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (authError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized', userProfile: null };
  }

  const { data: userProfile } = await db
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .maybeSingle();

  const roleCode = (userProfile as any)?.roles?.role_code;
  if (!userProfile || !ALLOWED_ADMIN_ROLES.includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden', userProfile: null };
  }
  return { ok: true, status: 200, error: null, userProfile };
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
    const auth = await assertAdmin(db);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
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

    const { data, error } = await db
      .from('whatsapp_templates')
      .update(updates)
      .eq('id', id)
      .select(
        'id, template_name, display_name, language_code, category, body_text, variable_keys, example_values, is_active, created_at, updated_at'
      )
      .single();

    if (error) return NextResponse.json({ error: error.message || 'Update failed' }, { status: 500 });

    if (body?.is_active === true && data?.template_name) {
      const { supabaseAdmin } = getSupabaseAdmin();
      const automationDb = supabaseAdmin || db;
      await automationDb
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
    const auth = await assertAdmin(db);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { error } = await db.from('whatsapp_templates').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message || 'Delete failed' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
