import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function assertSuperAdmin(supabase: any) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized', user: null };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();
  if (roleError || !userData) {
    return { ok: false, status: 403, error: 'Forbidden - Role check failed', user };
  }
  const roleCode = (userData as any).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden - Not super admin', user };
  }
  return { ok: true, status: 200, error: null, user };
}

function normalizeText(value: unknown, maxLen: number) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function parseScore(value: unknown) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const int = Math.trunc(n);
  if (int < 1 || int > 5) return null;
  return int;
}

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const callId = String(id || '').trim();
    if (!callId) {
      return NextResponse.json({ error: 'Missing call id' }, { status: 400 });
    }

    const supabase = await createClient();
    const auth = await assertSuperAdmin(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }
    const db = supabaseAdmin as any;

    const { data, error } = await db
      .from('sarv_call_audits')
      .select('id, sarv_call_id, audit_status, audit_score, feedback, audited_by_id, audited_at, updated_at, created_at')
      .eq('sarv_call_id', callId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Failed to load audit' }, { status: 500 });
    }

    return NextResponse.json({ audit: data || null });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const callId = String(id || '').trim();
    if (!callId) {
      return NextResponse.json({ error: 'Missing call id' }, { status: 400 });
    }

    const supabase = await createClient();
    const auth = await assertSuperAdmin(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }
    const db = supabaseAdmin as any;

    const body = await request.json().catch(() => ({}));
    const audit_status = normalizeText(body?.audit_status, 50);
    const audit_score = parseScore(body?.audit_score);
    const feedback = normalizeText(body?.feedback, 5000) || null;

    if (!audit_status) {
      return NextResponse.json({ error: 'Audit status is required' }, { status: 400 });
    }

    // Upsert without requiring a unique constraint: update if exists else insert.
    const { data: existing, error: existingError } = await db
      .from('sarv_call_audits')
      .select('id')
      .eq('sarv_call_id', callId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) {
      return NextResponse.json({ error: 'Failed to save audit' }, { status: 500 });
    }

    const now = new Date().toISOString();

    if (existing?.id) {
      const { data, error } = await db
        .from('sarv_call_audits')
        .update({
          audit_status,
          audit_score,
          feedback,
          audited_by_id: auth.user?.id || null,
          audited_at: now,
          updated_at: now,
        })
        .eq('id', existing.id)
        .select('id, sarv_call_id, audit_status, audit_score, feedback, audited_by_id, audited_at, updated_at, created_at')
        .maybeSingle();
      if (error) {
        return NextResponse.json({ error: 'Failed to save audit' }, { status: 500 });
      }
      return NextResponse.json({ success: true, audit: data || null });
    }

    const { data, error } = await db
      .from('sarv_call_audits')
      .insert({
        sarv_call_id: callId,
        audit_status,
        audit_score,
        feedback,
        audited_by_id: auth.user?.id || null,
        audited_at: now,
      })
      .select('id, sarv_call_id, audit_status, audit_score, feedback, audited_by_id, audited_at, updated_at, created_at')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Failed to save audit' }, { status: 500 });
    }

    return NextResponse.json({ success: true, audit: data || null });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}

