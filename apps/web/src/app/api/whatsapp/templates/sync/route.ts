import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_ADMIN_ROLES = ['SUPER_ADMIN', 'SUB_ADMIN'];
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v21.0';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';

type MetaTemplate = {
  id?: string;
  name?: string;
  language?: string;
  category?: string;
  status?: string;
  components?: Array<{
    type?: string;
    text?: string;
    format?: string;
    example?: {
      body_text?: string[][];
    };
  }>;
};

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

function extractVariableKeys(bodyText: string) {
  const matches = bodyText.match(/\{\{\s*\d+\s*\}\}/g) || [];
  const indexes = Array.from(
    new Set(
      matches
        .map((token) => Number(token.replace(/[^\d]/g, '')))
        .filter((num) => Number.isFinite(num) && num > 0)
    )
  ).sort((a, b) => a - b);
  return indexes.map((index) => `variable_${index}`);
}

function normalizeTemplate(template: MetaTemplate, actorId: string) {
  const bodyComponent = (template.components || []).find(
    (component) => String(component?.type || '').toUpperCase() === 'BODY'
  );
  const bodyText = String(bodyComponent?.text || '').trim();
  const variableKeys = extractVariableKeys(bodyText);
  const exampleValues = Array.isArray(bodyComponent?.example?.body_text?.[0])
    ? bodyComponent?.example?.body_text?.[0]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    : [];
  const status = String(template.status || '').toUpperCase();

  return {
    template_name: String(template.name || '').trim().toLowerCase(),
    display_name: String(template.name || '').trim() || null,
    language_code: String(template.language || 'en').trim() || 'en',
    category: String(template.category || 'UTILITY').trim().toUpperCase() || 'UTILITY',
    body_text: bodyText || '[Body not provided by Meta]',
    variable_keys: variableKeys,
    example_values: exampleValues,
    is_active: status === 'APPROVED',
    meta: {
      source: 'meta_sync',
      status,
      template_id: template.id || null,
      synced_at: new Date().toISOString(),
      raw: template,
    },
    created_by: actorId,
    updated_at: new Date().toISOString(),
  };
}

async function fetchAllMetaTemplates() {
  const allTemplates: MetaTemplate[] = [];
  let nextUrl = `${WHATSAPP_API_URL}/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates?fields=id,name,language,status,category,components&limit=100`;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      },
      cache: 'no-store',
    });

    const payload = await response.json();
    if (!response.ok) {
      const metaMessage = String(
        payload?.error?.error_user_msg ||
          payload?.error?.message ||
          `Meta template fetch failed (${response.status})`
      );
      const metaCode = Number(payload?.error?.code || 0);
      const normalized = metaMessage.toLowerCase();

      // Friendly diagnostics for the most common setup mistakes.
      if (metaCode === 100 && normalized.includes('message_templates')) {
        throw new Error(
          'Meta rejected message_templates endpoint. Check WHATSAPP_BUSINESS_ACCOUNT_ID (must be WABA ID, not Page/Business ID) and ensure token has whatsapp_business_management permission.'
        );
      }
      if (metaCode === 190) {
        throw new Error('WhatsApp access token is invalid or expired. Please update WHATSAPP_ACCESS_TOKEN.');
      }
      if (metaCode === 200 || metaCode === 10) {
        throw new Error(
          'Permission denied by Meta. Grant whatsapp_business_management and whatsapp_business_messaging to this token.'
        );
      }

      throw new Error(metaMessage);
    }

    const chunk = Array.isArray(payload?.data) ? payload.data : [];
    allTemplates.push(...chunk);
    nextUrl = payload?.paging?.next || '';
  }

  return allTemplates;
}

export async function POST() {
  try {
    if (!WHATSAPP_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'WHATSAPP_ACCESS_TOKEN is not configured' }, { status: 500 });
    }
    if (!WHATSAPP_BUSINESS_ACCOUNT_ID) {
      return NextResponse.json({ error: 'WHATSAPP_BUSINESS_ACCOUNT_ID is not configured' }, { status: 500 });
    }

    const supabase = await createClient();
    const db: any = supabase;
    const auth = await assertAdmin(db);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const metaTemplates = await fetchAllMetaTemplates();
    const normalizedRows = metaTemplates
      .map((template) => normalizeTemplate(template, auth.userProfile.id))
      .filter((row) => Boolean(row.template_name));

    if (normalizedRows.length === 0) {
      return NextResponse.json({
        success: true,
        fetched: metaTemplates.length,
        synced: 0,
        message: 'No templates found on Meta for sync.',
      });
    }

    const { error } = await db
      .from('whatsapp_templates')
      .upsert(normalizedRows, { onConflict: 'template_name' });

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to sync templates' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      fetched: metaTemplates.length,
      synced: normalizedRows.length,
      message: 'Templates synced from Meta successfully.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
