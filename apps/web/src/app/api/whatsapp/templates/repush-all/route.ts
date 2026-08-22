import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  assertWhatsAppTemplatePushConfig,
  pushWhatsAppTemplateToMeta,
  sleep,
} from '@/lib/services/whatsappTemplateMetaPush';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const ALLOWED_ADMIN_ROLES = ['SUPER_ADMIN', 'SUB_ADMIN'];

async function assertAdmin(db: any) {
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (authError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const { data: userProfile } = await db
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .maybeSingle();

  const roleCode = (userProfile as { roles?: { role_code?: string } })?.roles?.role_code;
  if (!userProfile || !ALLOWED_ADMIN_ROLES.includes(String(roleCode || ''))) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }
  return { ok: true, status: 200, error: null };
}

export async function POST() {
  try {
    const config = await assertWhatsAppTemplatePushConfig();

    const supabase = await createClient();
    const db: any = supabase;
    const auth = await assertAdmin(db);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { data: templates, error: fetchError } = await db
      .from('whatsapp_templates')
      .select('id, template_name, display_name, language_code, category, body_text, variable_keys, example_values, meta')
      .order('template_name', { ascending: true });

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message || 'Failed to load templates' }, { status: 500 });
    }

    const rows = Array.isArray(templates) ? templates : [];
    const results: Array<{
      template_name: string;
      ok: boolean;
      action?: string;
      metaStatus?: string;
      message?: string;
      error?: string;
    }> = [];

    let created = 0;
    let linked = 0;
    let failed = 0;

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const templateName = String(row.template_name || '').trim();
      if (!templateName) continue;

      try {
        const result = await pushWhatsAppTemplateToMeta(row);
        if (result.action === 'created') created += 1;
        if (result.action === 'linked') linked += 1;
        results.push({
          template_name: templateName,
          ok: true,
          action: result.action,
          metaStatus: result.metaStatus,
          message: result.message,
        });
      } catch (error: unknown) {
        failed += 1;
        results.push({
          template_name: templateName,
          ok: false,
          error: String((error as { message?: string })?.message || 'Push failed'),
        });
      }

      if (index < rows.length - 1) {
        await sleep(350);
      }
    }

    return NextResponse.json({
      success: true,
      wabaId: config.whatsapp_business_account_id,
      total: rows.length,
      created,
      linked,
      failed,
      results,
      message:
        failed === 0
          ? `Repush complete on WABA ${config.whatsapp_business_account_id}: ${created} submitted, ${linked} already on Meta.`
          : `Repush finished with ${failed} failure(s) on WABA ${config.whatsapp_business_account_id}.`,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: String((error as { message?: string })?.message || 'Internal server error') }, { status: 500 });
  }
}
