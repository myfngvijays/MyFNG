import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  assertWhatsAppTemplatePushConfig,
  getWhatsAppTemplatePushConfig,
  pushWhatsAppTemplateToMeta,
} from '@/lib/services/whatsappTemplateMetaPush';

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

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await assertWhatsAppTemplatePushConfig();
    const config = await getWhatsAppTemplatePushConfig();

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Invalid template id' }, { status: 400 });

    const supabase = await createClient();
    const db: any = supabase;
    const auth = await assertAdmin(db);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { data: localTemplate, error: fetchError } = await db
      .from('whatsapp_templates')
      .select('id, template_name, display_name, language_code, category, body_text, variable_keys, example_values, meta')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !localTemplate) {
      return NextResponse.json({ error: fetchError?.message || 'Template not found' }, { status: 404 });
    }

    const result = await pushWhatsAppTemplateToMeta(localTemplate);

    const { data: updated, error: updateError } = await db
      .from('whatsapp_templates')
      .select('id, template_name, display_name, language_code, category, body_text, variable_keys, example_values, is_active, meta, created_at, updated_at')
      .eq('id', id)
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message || 'Failed to load updated template' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      template: updated,
      wabaId: config.whatsapp_business_account_id,
      message: result.message,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
