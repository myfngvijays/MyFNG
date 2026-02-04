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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const from = searchParams.get('from') || defaultFrom.toISOString();
    const to = searchParams.get('to') || now.toISOString();

    const assigneeRole = (searchParams.get('assignee_role') || '').toUpperCase();
    const assigneeId = searchParams.get('assignee_id') || '';
    const hasRecording = searchParams.get('has_recording');
    const q = (searchParams.get('q') || '').trim();

    const limit = clamp(Number(searchParams.get('limit') || 50), 1, 200);
    const page = clamp(Number(searchParams.get('page') || 1), 1, 100000);
    const fromIndex = (page - 1) * limit;
    const toIndex = fromIndex + limit - 1;

    let query = db
      .from('sarv_calls')
      .select(
        `
        id,
        callid,
        cnumber,
        callstatus,
        ctype,
        ivrstime,
        ivretime,
        ivrduration,
        talkduration,
        agentoncallduration,
        custanswerstime,
        custansweretime,
        custanswerduration,
        recording_url,
        transcription,
        summary,
        disposition,
        disposition_category,
        disposition_note,
        disposition_updated_at,
        sarv_created_at,
        created_at,
        assigned_user_id,
        assigned_role
      `,
        { count: 'exact' }
      )
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: false })
      .range(fromIndex, toIndex);

    if (assigneeRole) {
      if (!['TELECALLER', 'RSA_MANAGER'].includes(assigneeRole)) {
        return NextResponse.json({ error: 'Invalid assignee_role filter' }, { status: 400 });
      }
      query = query.eq('assigned_role', assigneeRole);
    }
    if (assigneeId) {
      query = query.eq('assigned_user_id', assigneeId);
    }
    if (hasRecording === 'true') {
      query = query.not('recording_url', 'is', null);
    }
    if (hasRecording === 'false') {
      query = query.is('recording_url', null);
    }
    if (q) {
      query = query.or(`callid.ilike.%${q}%,cnumber.ilike.%${q}%`);
    }

    const { data: calls, error, count } = await query;
    if (error) {
      return NextResponse.json({ error: 'Failed to fetch SARV calls' }, { status: 500 });
    }

    const rows = Array.isArray(calls) ? calls : [];
    const assigneeIds = Array.from(new Set(rows.map((r: any) => r?.assigned_user_id).filter(Boolean)));
    let assigneeMap = new Map<string, any>();
    if (assigneeIds.length) {
      const { data: users } = await db
        .from('users_login')
        .select('id, full_name, email, phone')
        .in('id', assigneeIds);
      for (const u of users || []) {
        assigneeMap.set(u.id, u);
      }
    }

    const enriched = rows.map((row: any) => {
      const user = row.assigned_user_id ? assigneeMap.get(row.assigned_user_id) : null;
      return {
        ...row,
        assignee_name: user?.full_name || null,
        assignee_email: user?.email || null,
        assignee_phone: user?.phone || null,
      };
    });

    return NextResponse.json({
      calls: enriched,
      pagination: {
        page,
        limit,
        total: count ?? enriched.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}
