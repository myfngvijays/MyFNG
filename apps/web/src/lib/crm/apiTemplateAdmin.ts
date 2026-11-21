import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { PANEL_ACCESS_ROLES } from '@/lib/super-admin-auth';
import { buildLeadVariables, renderTemplate, templateVariables, type ApiTemplate } from '@/lib/crm/apiTemplates';
import { TRIGGER_OPTIONS, type ApiTemplateRow } from '@/lib/crm/apiTemplateShared';

/** Admins + lead managers (same roles as Bookings & Leads). */
export async function authorizeApiTemplates(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { ok: false as const, res: NextResponse.json({ error: 'Admin client not configured' }, { status: 500 }) };
  }
  const profile = await resolveUserProfile(supabaseAdmin as any, user);
  const role = String((profile?.roles as any)?.role_code || '').toUpperCase();
  if (!(PANEL_ACCESS_ROLES.bookings as readonly string[]).includes(role)) {
    return { ok: false as const, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return {
    ok: true as const,
    db: supabaseAdmin as any,
    userId: String(profile?.id || user.id),
    userName: String((profile as any)?.full_name || user.email || 'Admin'),
  };
}

export function tableMissingResponse(error: any) {
  const msg = String(error?.message || '');
  if (/send_once_per_lead/.test(msg)) {
    return NextResponse.json(
      { error: 'Run database/403_crm_api_templates_once_per_lead.sql in Supabase SQL editor first.', needs_migration: true },
      { status: 503 },
    );
  }
  if (error?.code === '42P01' || error?.code === 'PGRST205' || (/crm_api_template/.test(msg) && /exist|find/i.test(msg))) {
    return NextResponse.json(
      { error: 'API Templates table missing — run database/402_crm_api_templates.sql in Supabase SQL editor.', needs_migration: true },
      { status: 503 },
    );
  }
  return null;
}

/** Row for the browser (admins / lead managers only — includes the auth secrets). */
export function serializeTemplate(row: any): ApiTemplateRow {
  return {
    id: String(row.id),
    name: row.name || '',
    description: row.description || null,
    method: row.method || 'POST',
    url: row.url || '',
    timeout_seconds: Number(row.timeout_seconds || 10),
    auth_type: row.auth_type || 'NONE',
    // Shown in full to admins / lead managers so they can see and edit it (like TeleCRM).
    auth_token: row.auth_token || '',
    auth_username: row.auth_username || '',
    auth_password: row.auth_password || '',
    auth_header_name: row.auth_header_name || '',
    auth_header_value: row.auth_header_value || '',
    has_auth_token: Boolean(row.auth_token),
    has_auth_password: Boolean(row.auth_password),
    has_auth_header_value: Boolean(row.auth_header_value),
    extra_headers: row.extra_headers && typeof row.extra_headers === 'object' ? row.extra_headers : {},
    payload_type: row.payload_type || 'JSON',
    payload_template: row.payload_template || '',
    trigger_status: row.trigger_status || 'MANUAL',
    is_active: row.is_active !== false,
    send_once_per_lead: Boolean(row.send_once_per_lead),
    variables: templateVariables(`${row.url || ''}\n${row.payload_template || ''}`),
    last_run_at: row.last_run_at || null,
    last_run_ok: row.last_run_ok ?? null,
    last_run_status: row.last_run_status ?? null,
    last_run_error: row.last_run_error || null,
    created_by_name: row.created_by_name || null,
    updated_by_name: row.updated_by_name || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const AUTH = new Set(['NONE', 'BEARER', 'BASIC', 'HEADER']);
const TRIGGERS = new Set(TRIGGER_OPTIONS.map((t) => t.id));

/**
 * Validate a create/update body into DB columns. Secret fields left blank (or still masked)
 * keep the stored value: `existing` supplies it.
 */
export function templateFromBody(
  body: any,
  existing?: any,
): { ok: true; row: Record<string, unknown>; merged: ApiTemplate } | { ok: false; error: string } {
  const name = String(body?.name ?? existing?.name ?? '').trim();
  if (!name) return { ok: false, error: 'Template name is required' };
  const url = String(body?.url ?? existing?.url ?? '').trim();
  if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'Endpoint URL must start with http:// or https://' };
  const method = String(body?.method ?? existing?.method ?? 'POST').toUpperCase();
  if (!METHODS.has(method)) return { ok: false, error: 'Invalid request method' };
  const authType = String(body?.auth_type ?? existing?.auth_type ?? 'NONE').toUpperCase();
  if (!AUTH.has(authType)) return { ok: false, error: 'Invalid authentication type' };
  const trigger = String(body?.trigger_status ?? existing?.trigger_status ?? 'MANUAL').toUpperCase();
  if (!TRIGGERS.has(trigger)) return { ok: false, error: 'Invalid trigger' };
  const payloadType = String(body?.payload_type ?? existing?.payload_type ?? 'JSON').toUpperCase() === 'FORM' ? 'FORM' : 'JSON';
  const timeout = Math.min(60, Math.max(1, parseInt(String(body?.timeout_seconds ?? existing?.timeout_seconds ?? 10), 10) || 10));

  // Masked values ("abcd••••wxyz") or blanks mean "keep what is saved".
  const secret = (key: string) => {
    const v = body?.[key];
    if (v == null) return existing?.[key] ?? null;
    const s = String(v);
    if (!s.trim() || s.includes('••••')) return existing?.[key] ?? null;
    return s.trim();
  };

  let extraHeaders: Record<string, string> = {};
  const rawHeaders = body?.extra_headers ?? existing?.extra_headers ?? {};
  if (rawHeaders && typeof rawHeaders === 'object' && !Array.isArray(rawHeaders)) {
    for (const [k, v] of Object.entries(rawHeaders)) {
      if (String(k).trim()) extraHeaders[String(k).trim()] = String(v ?? '');
    }
  } else {
    extraHeaders = {};
  }

  const row: Record<string, unknown> = {
    name: name.slice(0, 120),
    description: String(body?.description ?? existing?.description ?? '').trim().slice(0, 500) || null,
    method,
    url,
    timeout_seconds: timeout,
    auth_type: authType,
    auth_token: authType === 'BEARER' ? secret('auth_token') : null,
    auth_username: authType === 'BASIC' ? String(body?.auth_username ?? existing?.auth_username ?? '').trim() || null : null,
    auth_password: authType === 'BASIC' ? secret('auth_password') : null,
    auth_header_name: authType === 'HEADER' ? String(body?.auth_header_name ?? existing?.auth_header_name ?? '').trim() || null : null,
    auth_header_value: authType === 'HEADER' ? secret('auth_header_value') : null,
    extra_headers: extraHeaders,
    payload_type: payloadType,
    payload_template: String(body?.payload_template ?? existing?.payload_template ?? '').slice(0, 20000),
    trigger_status: trigger,
    is_active: body?.is_active == null ? existing?.is_active !== false : Boolean(body.is_active),
    send_once_per_lead:
      body?.send_once_per_lead == null ? Boolean(existing?.send_once_per_lead) : Boolean(body.send_once_per_lead),
  };
  if (authType === 'BEARER' && !row.auth_token) return { ok: false, error: 'Bearer token is required' };
  if (authType === 'HEADER' && (!row.auth_header_name || !row.auth_header_value)) {
    return { ok: false, error: 'Header name and value are required' };
  }

  const merged = { id: existing?.id || 'draft', ...row } as unknown as ApiTemplate;
  // Payload must stay valid JSON once variables are filled in.
  try {
    renderTemplate(merged, buildLeadVariables({} as any));
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Payload is not valid JSON' };
  }
  return { ok: true, row, merged };
}
