import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_ADMIN_ROLES = ['SUPER_ADMIN', 'SUB_ADMIN'];

async function assertAdmin(db: any) {
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (authError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized', user: null, userProfile: null };
  }

  const { data: userProfile } = await db
    .from('users_login')
    .select('id, full_name, roles!inner(role_code)')
    .eq('id', user.id)
    .maybeSingle();

  const roleCode = (userProfile as any)?.roles?.role_code;
  if (!userProfile || !ALLOWED_ADMIN_ROLES.includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden', user, userProfile: null };
  }

  return { ok: true, status: 200, error: null, user, userProfile };
}

function normalizeTemplateName(input: string) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

export async function GET() {
  try {
    const supabase = await createClient();
    const db: any = supabase;
    const auth = await assertAdmin(db);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { data, error } = await db
      .from('whatsapp_templates')
      .select(
        'id, template_name, display_name, language_code, category, body_text, variable_keys, example_values, is_active, created_at, updated_at'
      )
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, templates: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const db: any = supabase;
    const auth = await assertAdmin(db);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const templateName = normalizeTemplateName(String(body?.template_name || ''));
    const displayName = String(body?.display_name || '').trim() || null;
    const languageCode = String(body?.language_code || 'en').trim() || 'en';
    const category = String(body?.category || 'UTILITY').trim().toUpperCase() || 'UTILITY';
    const bodyText = String(body?.body_text || '').trim();
    const variableKeys = Array.isArray(body?.variable_keys)
      ? body.variable_keys.map((v: unknown) => String(v || '').trim()).filter(Boolean)
      : [];
    const exampleValues = Array.isArray(body?.example_values)
      ? body.example_values.map((v: unknown) => String(v || '').trim()).filter(Boolean)
      : [];

    if (!templateName) {
      return NextResponse.json({ error: 'template_name is required' }, { status: 400 });
    }
    if (!bodyText) {
      return NextResponse.json({ error: 'body_text is required' }, { status: 400 });
    }

    const { data, error } = await db
      .from('whatsapp_templates')
      .insert({
        template_name: templateName,
        display_name: displayName,
        language_code: languageCode,
        category,
        body_text: bodyText,
        variable_keys: variableKeys,
        example_values: exampleValues,
        is_active: true,
        created_by: auth.userProfile.id,
        updated_at: new Date().toISOString(),
      })
      .select(
        'id, template_name, display_name, language_code, category, body_text, variable_keys, example_values, is_active, created_at, updated_at'
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to create template' }, { status: 500 });
    }
    return NextResponse.json({ success: true, template: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
