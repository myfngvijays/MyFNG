import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

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

function metaStatusPriority(status: string) {
  const normalized = String(status || '').trim().toUpperCase();
  if (normalized === 'APPROVED') return 4;
  if (normalized === 'PENDING') return 3;
  if (normalized === 'PAUSED') return 2;
  if (normalized === 'REJECTED') return 1;
  return 0;
}

function deduplicateByTemplateName(rows: ReturnType<typeof normalizeTemplate>[]) {
  const byName = new Map<string, ReturnType<typeof normalizeTemplate>>();

  for (const row of rows) {
    const existing = byName.get(row.template_name);
    if (!existing) {
      byName.set(row.template_name, row);
      continue;
    }

    const existingPriority = metaStatusPriority(String(existing.meta?.status || ''));
    const rowPriority = metaStatusPriority(String(row.meta?.status || ''));
    if (rowPriority > existingPriority) {
      byName.set(row.template_name, row);
      continue;
    }
    if (rowPriority === existingPriority && row.language_code === 'en' && existing.language_code !== 'en') {
      byName.set(row.template_name, row);
    }
  }

  return Array.from(byName.values());
}

async function getProtectedTemplateNames(adminDb: any): Promise<Set<string>> {
  const protectedNames = new Set<string>();

  const { data: configs } = await adminDb.from('whatsapp_agent_configs').select('triggers_json');
  for (const row of configs || []) {
    const name = String((row as { triggers_json?: { outbound_template_name?: string } }).triggers_json
      ?.outbound_template_name || '')
      .trim()
      .toLowerCase();
    if (name) protectedNames.add(name);
  }

  const { data: automation } = await adminDb
    .from('whatsapp_automation_settings')
    .select('template_name');
  for (const row of automation || []) {
    const name = String((row as { template_name?: string }).template_name || '')
      .trim()
      .toLowerCase();
    if (name) protectedNames.add(name);
  }

  return protectedNames;
}

function shouldPreserveLocalTemplate(row: { template_name?: string; meta?: Record<string, unknown> }, protectedNames: Set<string>) {
  const name = String(row.template_name || '').trim().toLowerCase();
  if (protectedNames.has(name)) return true;

  const source = String(row.meta?.source || '').trim().toLowerCase();
  if (source === 'local_draft' || source === 'meta_push_existing' || source === 'meta_create') return true;

  if (row.meta?.purpose || row.meta?.deprecated) return true;

  return false;
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
    const normalizedRows = deduplicateByTemplateName(
      metaTemplates
        .map((template) => normalizeTemplate(template, auth.userProfile.id))
        .filter((row) => Boolean(row.template_name))
    );

    const { supabaseAdmin } = getSupabaseAdmin();
    const adminDb = (supabaseAdmin ?? db) as any;

    const protectedNames = await getProtectedTemplateNames(adminDb);
    const { data: existingAll } = await adminDb
      .from('whatsapp_templates')
      .select('template_name, meta, is_active');

    const doNotOverwrite = new Set<string>();
    const existingMetaByName = new Map<string, Record<string, unknown>>();
    const existingActiveByName = new Map<string, boolean>();

    for (const row of existingAll || []) {
      const name = String((row as { template_name?: string }).template_name || '')
        .trim()
        .toLowerCase();
      if (!name) continue;
      existingActiveByName.set(name, Boolean((row as { is_active?: boolean }).is_active));
      existingMetaByName.set(name, ((row as { meta?: Record<string, unknown> }).meta || {}) as Record<string, unknown>);
      if (shouldPreserveLocalTemplate(row as { template_name?: string; meta?: Record<string, unknown> }, protectedNames)) {
        doNotOverwrite.add(name);
      }
    }

    const metaTemplateNames = new Set(normalizedRows.map((r) => r.template_name));

    const rowsToUpsert = normalizedRows
      .filter((row) => !doNotOverwrite.has(row.template_name))
      .map((row) => ({
        ...row,
        is_active: existingActiveByName.has(row.template_name)
          ? existingActiveByName.get(row.template_name)!
          : row.is_active,
      }));

    let linkedProtected = 0;

    if (normalizedRows.length === 0) {
      return NextResponse.json({
        success: true,
        fetched: 0,
        synced: 0,
        deleted: 0,
        linkedProtected: 0,
        preserved: true,
        message: 'No templates found on Meta. Local templates were preserved.',
      });
    }

    if (rowsToUpsert.length > 0) {
      const { error } = await adminDb
        .from('whatsapp_templates')
        .upsert(rowsToUpsert, { onConflict: 'template_name' });

      if (error) {
        return NextResponse.json({ error: error.message || 'Failed to sync templates' }, { status: 500 });
      }
    }

    // Link Meta status onto protected local rows without overwriting body/name.
    for (const row of normalizedRows) {
      if (!doNotOverwrite.has(row.template_name)) continue;
      const priorMeta = existingMetaByName.get(row.template_name) || {};
      const metaStatus = String(row.meta?.status || '').toUpperCase();
      const { error: linkError } = await adminDb
        .from('whatsapp_templates')
        .update({
          meta: {
            ...priorMeta,
            status: metaStatus,
            template_id: row.meta?.template_id || null,
            synced_at: new Date().toISOString(),
            meta_linked: true,
            waba_missing: false,
          },
          is_active:
            metaStatus === 'APPROVED'
              ? true
              : existingActiveByName.has(row.template_name)
                ? existingActiveByName.get(row.template_name)!
                : false,
          updated_at: new Date().toISOString(),
        })
        .eq('template_name', row.template_name);
      if (!linkError) linkedProtected += 1;
    }

    let markedMissing = 0;
    for (const templateName of doNotOverwrite) {
      if (metaTemplateNames.has(templateName)) continue;
      const priorMeta = existingMetaByName.get(templateName) || {};
      const { error: missingError } = await adminDb
        .from('whatsapp_templates')
        .update({
          is_active: false,
          meta: {
            ...priorMeta,
            status: 'NOT_ON_WABA',
            template_id: null,
            synced_at: new Date().toISOString(),
            meta_linked: false,
            waba_missing: true,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('template_name', templateName);
      if (!missingError) markedMissing += 1;
    }

    return NextResponse.json({
      success: true,
      fetched: metaTemplates.length,
      synced: rowsToUpsert.length,
      linkedProtected,
      markedMissing,
      deleted: 0,
      protected: Array.from(doNotOverwrite),
      message: `Synced ${rowsToUpsert.length} templates from Meta.${linkedProtected > 0 ? ` Linked ${linkedProtected} protected templates.` : ''}${markedMissing > 0 ? ` Marked ${markedMissing} local-only templates as NOT_ON_WABA.` : ''} No templates were auto-deleted.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
