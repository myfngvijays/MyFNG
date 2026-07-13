import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_ADMIN_ROLES = ['SUPER_ADMIN', 'SUB_ADMIN'];
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v21.0';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';

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

async function createTemplateOnMeta(payload: {
  template_name: string;
  language_code: string;
  category: string;
  body_text: string;
  example_values?: string[];
}) {
  const exampleValues = Array.isArray(payload.example_values)
    ? payload.example_values.map((value) => String(value || '').trim()).filter(Boolean)
    : [];

  const response = await fetch(`${WHATSAPP_API_URL}/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: payload.template_name,
      language: payload.language_code,
      category: payload.category,
      components: [
        {
          type: 'BODY',
          text: payload.body_text,
          ...(exampleValues.length > 0
            ? {
                example: {
                  body_text: [exampleValues],
                },
              }
            : {}),
        },
      ],
    }),
    cache: 'no-store',
  });

  const metaResult = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg =
      String(metaResult?.error?.error_user_msg || metaResult?.error?.message || '').trim() ||
      'Failed to create template on Meta';
    throw new Error(msg);
  }

  return metaResult;
}

async function verifyTemplateOnMeta(templateName: string) {
  const url = `${WHATSAPP_API_URL}/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates?fields=id,name,status,language,category&limit=50&name=${encodeURIComponent(
    templateName
  )}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg =
      String(payload?.error?.error_user_msg || payload?.error?.message || '').trim() ||
      'Meta verification call failed';
    throw new Error(msg);
  }
  const data = Array.isArray(payload?.data) ? payload.data : [];
  return (
    data.find((row: any) => String(row?.name || '').trim().toLowerCase() === templateName.toLowerCase()) || null
  );
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!WHATSAPP_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'WHATSAPP_ACCESS_TOKEN is not configured' }, { status: 500 });
    }
    if (!WHATSAPP_BUSINESS_ACCOUNT_ID) {
      return NextResponse.json({ error: 'WHATSAPP_BUSINESS_ACCOUNT_ID is not configured' }, { status: 500 });
    }

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Invalid template id' }, { status: 400 });

    const supabase = await createClient();
    const db: any = supabase;
    const auth = await assertAdmin(db);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { data: localTemplate, error: fetchError } = await db
      .from('whatsapp_templates')
      .select('id, template_name, display_name, language_code, category, body_text, variable_keys, example_values')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !localTemplate) {
      return NextResponse.json({ error: fetchError?.message || 'Template not found' }, { status: 404 });
    }

    try {
      await createTemplateOnMeta({
        template_name: String(localTemplate.template_name),
        language_code: String(localTemplate.language_code || 'en'),
        category: String(localTemplate.category || 'UTILITY'),
        body_text: String(localTemplate.body_text || ''),
        example_values: Array.isArray(localTemplate.example_values)
          ? localTemplate.example_values.map((value: unknown) => String(value || '').trim()).filter(Boolean)
          : [],
      });
    } catch (error: any) {
      const message = String(error?.message || '').toLowerCase();
      const alreadyOnMeta =
        message.includes('already exists') ||
        message.includes('already english content') ||
        message.includes('already content for this template');
      if (!alreadyOnMeta) throw error;
      // Template already on Meta — verify and link local row.
    }

    const verified = await verifyTemplateOnMeta(String(localTemplate.template_name));
    if (!verified) {
      return NextResponse.json(
        { error: `Template not verifiable on this WABA (${WHATSAPP_BUSINESS_ACCOUNT_ID}) after push.` },
        { status: 502 }
      );
    }

    const metaStatus = String(verified?.status || 'PENDING').toUpperCase();
    const { data: updated, error: updateError } = await db
      .from('whatsapp_templates')
      .update({
        is_active: metaStatus === 'APPROVED',
        meta: {
          source: 'meta_push_existing',
          status: metaStatus,
          template_id: verified?.id || null,
          category: verified?.category || localTemplate.category,
          language: verified?.language || localTemplate.language_code,
          pushed_at: new Date().toISOString(),
          raw: verified,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, template_name, display_name, language_code, category, body_text, variable_keys, example_values, is_active, meta, created_at, updated_at')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message || 'Failed to update local template' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      template: updated,
      message:
        metaStatus === 'APPROVED'
          ? 'Template linked to Meta and approved.'
          : `Template linked to Meta with status ${metaStatus}.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

