import { assertPushAdmin } from '@/lib/push/admin-auth';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { PUSH_FALLBACK_TEMPLATES } from '@/lib/push/push-admin-constants';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const auth = await assertPushAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const includeInactive = new URL(request.url).searchParams.get('all') === '1';

    let q = supabaseAdmin
      .from('push_notification_templates')
      .select('*')
      .order('sort_order', { ascending: true });

    if (!includeInactive) {
      q = q.eq('is_active', true);
    }

    const { data, error } = await q;

    if (error) {
      if (error.message?.includes('push_notification_templates')) {
        return NextResponse.json({ templates: PUSH_FALLBACK_TEMPLATES, fallback: true });
      }
      return NextResponse.json({ error: 'Failed to load templates', details: error.message }, { status: 500 });
    }

    return NextResponse.json({
      templates: (data || []).length > 0 ? data : PUSH_FALLBACK_TEMPLATES,
      fallback: !(data || []).length,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

const ALLOWED_PRIORITIES = new Set(['default', 'high']);
const ALLOWED_CATEGORIES = new Set([
  'general',
  'onboarding',
  'promotion',
  'reminder',
  'transactional',
  'system',
  'operations',
  'automation',
]);

export async function POST(request: NextRequest) {
  try {
    const auth = await assertPushAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const name = String(body?.name || '').trim();
    const title = String(body?.title || '').trim();
    const text = String(body?.body || '').trim();
    if (!name || !title || !text) {
      return NextResponse.json({ error: 'Name, title and body are required' }, { status: 400 });
    }

    const priority = String(body?.priority || 'default');
    if (!ALLOWED_PRIORITIES.has(priority)) {
      return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
    }

    const category = String(body?.category || 'general').trim().toLowerCase();
    if (!ALLOWED_CATEGORIES.has(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    const targetRole = String(body?.target_role || 'CUSTOMER').trim() || 'CUSTOMER';
    const description = body?.description != null ? String(body.description).trim() || null : null;
    const isActive = body?.is_active == null ? true : Boolean(body.is_active);

    const { data: maxRow } = await supabaseAdmin
      .from('push_notification_templates')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const sortOrder =
      body?.sort_order != null && Number.isFinite(Number(body.sort_order))
        ? Number(body.sort_order)
        : Number(maxRow?.sort_order || 0) + 10;

    const { data, error } = await supabaseAdmin
      .from('push_notification_templates')
      .insert({
        name,
        title,
        body: text,
        target_role: targetRole,
        priority,
        category,
        description,
        is_active: isActive,
        sort_order: sortOrder,
      })
      .select('*')
      .maybeSingle();

    if (error) {
      if (String(error.code) === '23505' || String(error.message || '').includes('unique')) {
        return NextResponse.json({ error: 'A template with this name already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to create template', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, template: data }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await assertPushAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const id = String(body?.id || '').trim();
    if (!id) {
      return NextResponse.json({ error: 'Template id required' }, { status: 400 });
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.title != null) {
      const title = String(body.title).trim();
      if (!title) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
      patch.title = title;
    }
    if (body.body != null) {
      const text = String(body.body).trim();
      if (!text) return NextResponse.json({ error: 'Body cannot be empty' }, { status: 400 });
      patch.body = text;
    }
    if (body.description != null) patch.description = String(body.description).trim() || null;
    if (body.priority != null) {
      const priority = String(body.priority);
      if (!ALLOWED_PRIORITIES.has(priority)) {
        return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
      }
      patch.priority = priority;
    }
    if (body.category != null) {
      const category = String(body.category).trim().toLowerCase();
      if (!ALLOWED_CATEGORIES.has(category)) {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
      }
      patch.category = category;
    }
    if (body.is_active != null) patch.is_active = Boolean(body.is_active);
    if (body.target_role != null) patch.target_role = String(body.target_role).trim() || 'CUSTOMER';
    if (body.name != null) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
      patch.name = name;
    }

    if (Object.keys(patch).length <= 1) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('push_notification_templates')
      .update(patch)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Failed to update template', details: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, template: data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
