import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function hasAnyDisposition(row: any) {
  return Boolean(String(row?.disposition || row?.disposition_category || '').trim());
}

function deriveDidFromPayload(payload: any): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const candidates = [
    payload?.did,
    payload?.did_number,
    payload?.didNumber,
    payload?.didNo,
    payload?.destinationNumber,
    payload?.masterAgentNumber,
    payload?.masteragentnumber,
  ];
  for (const value of candidates) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return null;
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
    const allowed = new Set(['RSA_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN']);
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
        did,
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
        assigned_role,
        raw_payload
      `,
        { count: 'exact' }
      )
      .eq('assigned_user_id', profile.id)
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: false })
      .range(fromIndex, toIndex);

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
    const numbers = Array.from(
      new Set(
        rows
          .map((row: any) => String(row?.cnumber || '').trim())
          .filter(Boolean)
      )
    );

    const previousByCallId = new Map<string, any>();
    if (numbers.length > 0) {
      const { data: historyRows } = await db
        .from('sarv_calls')
        .select(
          `
          id,
          callid,
          cnumber,
          created_at,
          disposition,
          disposition_category,
          disposition_note,
          summary,
          talkduration,
          recording_url,
          assigned_user_id
        `
        )
        .in('cnumber', numbers)
        .order('created_at', { ascending: false });

      const byCustomer = new Map<string, any[]>();
      for (const row of Array.isArray(historyRows) ? historyRows : []) {
        const customer = String((row as any)?.cnumber || '').trim();
        if (!customer) continue;
        const list = byCustomer.get(customer) || [];
        list.push(row);
        byCustomer.set(customer, list);
      }

      for (const list of byCustomer.values()) {
        for (let i = 0; i < list.length; i += 1) {
          const current = list[i];
          if (!current?.id) continue;
          let previous: any = null;
          for (let j = i + 1; j < list.length; j += 1) {
            const candidate = list[j];
            if (hasAnyDisposition(candidate)) {
              previous = candidate;
              break;
            }
          }
          previousByCallId.set(String(current.id), previous);
        }
      }
    }

    const previousAssigneeIds = Array.from(
      new Set(
        Array.from(previousByCallId.values())
          .map((row: any) => String(row?.assigned_user_id || '').trim())
          .filter(Boolean)
      )
    );
    const previousAssigneeNameById = new Map<string, string>();
    if (previousAssigneeIds.length > 0) {
      const { data: assignees } = await db
        .from('users_login')
        .select('id, full_name')
        .in('id', previousAssigneeIds);
      for (const user of assignees || []) {
        const id = String((user as any)?.id || '').trim();
        const name = String((user as any)?.full_name || '').trim();
        if (id && name) previousAssigneeNameById.set(id, name);
      }
    }

    const enriched = rows.map((row: any) => {
      const prev = previousByCallId.get(String(row?.id || '')) || null;
      const previousAssigneeId = String(prev?.assigned_user_id || '').trim();
      const did = String(row?.did || '').trim() || deriveDidFromPayload(row?.raw_payload) || null;
      return {
        ...row,
        did,
        previous_disposition: prev?.disposition || null,
        previous_disposition_category: prev?.disposition_category || null,
        previous_disposition_note: prev?.disposition_note || null,
        previous_disposition_callid: prev?.callid || null,
        previous_disposition_at: prev?.created_at || null,
        previous_disposition_assigned_user_id: prev?.assigned_user_id || null,
        previous_disposition_summary: prev?.summary || null,
        previous_disposition_talkduration: prev?.talkduration ?? null,
        previous_disposition_recording_url: prev?.recording_url || null,
        previous_disposition_assigned_user_name:
          (previousAssigneeId ? previousAssigneeNameById.get(previousAssigneeId) : '') || null,
      };
    });

    return NextResponse.json({
      calls: enriched,
      pagination: {
        page,
        limit,
        total: count ?? rows.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}
