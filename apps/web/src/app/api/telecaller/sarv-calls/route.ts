import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user || null;
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await resolveUserProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = String((profile.roles as any)?.role_code || '');
    const allowed = new Set(['TELECALLER', 'SUPER_ADMIN', 'SUB_ADMIN']);
    if (!allowed.has(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

    const hasRecording = searchParams.get('has_recording');
    const hasAudit = (searchParams.get('has_audit') || '').trim().toLowerCase();
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
      `
      )
      .eq('assigned_user_id', profile.id)
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: false });

    if (hasRecording === 'true') {
      query = query.not('recording_url', 'is', null);
    }
    if (hasRecording === 'false') {
      query = query.is('recording_url', null);
    }
    if (q) {
      query = query.or(`callid.ilike.%${q}%,cnumber.ilike.%${q}%`);
    }

    const { data: baseCalls, error } = await query;
    if (error) {
      return NextResponse.json({ error: 'Failed to fetch SARV calls' }, { status: 500 });
    }

    const allCalls = Array.isArray(baseCalls) ? baseCalls : [];
    const callIds = allCalls.map((c: any) => String(c?.id || '')).filter(Boolean);
    const auditedCallIds = new Set<string>();
    if (callIds.length > 0) {
      const { data: audits } = await db
        .from('sarv_call_audits')
        .select('sarv_call_id')
        .in('sarv_call_id', Array.from(new Set(callIds)));
      for (const row of audits || []) {
        const id = String((row as any)?.sarv_call_id || '').trim();
        if (id) auditedCallIds.add(id);
      }
    }

    const withAuditFlag = allCalls.map((call: any) => ({
      ...call,
      has_audit: auditedCallIds.has(String(call?.id || '')),
    }));

    let filtered = withAuditFlag;
    if (hasAudit === 'true') {
      filtered = withAuditFlag.filter((call: any) => Boolean(call?.has_audit));
    } else if (hasAudit === 'false') {
      filtered = withAuditFlag.filter((call: any) => !call?.has_audit);
    }

    const total = filtered.length;
    const paged = filtered.slice(fromIndex, toIndex + 1);

    return NextResponse.json({
      calls: paged,
      pagination: {
        page,
        limit,
        total,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}
