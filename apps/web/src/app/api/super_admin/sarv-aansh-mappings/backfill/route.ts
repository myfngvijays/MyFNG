import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function assertSuperAdmin(supabase: any) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
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

function parseJsonSafe<T = any>(input: unknown, fallback: T): T {
  if (input == null) return fallback;
  if (typeof input === 'object') return input as T;
  const raw = String(input).trim();
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function parseAansh(payload: Record<string, any>) {
  const raw = parseJsonSafe<any[]>(payload?.aAnsH ?? payload?.aansh ?? payload?.aH, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value)) as number[];
}

function isTimeInWindow(timeValue: string, from: string | null, to: string | null) {
  if (!from || !to) return true;
  if (from <= to) {
    return timeValue >= from && timeValue <= to;
  }
  return timeValue >= from || timeValue <= to;
}

function parseSarvTimestamp(input: string | null) {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const hasTz = raw.endsWith('Z') || /[+\-]\d{2}:?\d{2}$/.test(raw);
  const hasT = raw.includes('T');

  if (hasTz) {
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) return null;
    const iso = dt.toISOString();
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(dt);
    const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
    const weekday = get('weekday');
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const day = dayMap[weekday] ?? 0;
    const timeValue = `${get('hour')}:${get('minute')}:${get('second')}`;
    return { iso, day, timeValue };
  }

  // Assume SARV timestamps are local IST if no timezone provided.
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const [, y, mo, d, hh, mm, ss = '00'] = match;
  const utcMs = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(hh) - 5,
    Number(mm) - 30,
    Number(ss)
  );
  const dt = new Date(utcMs);
  const iso = dt.toISOString();
  const day = dt.getUTCDay();
  const timeValue = `${hh}:${mm}:${ss}`;
  return { iso, day, timeValue };
}

async function resolveAssignee(db: any, aanshIds: number[], custAnswerSTime: string | null) {
  if (!aanshIds.length || !custAnswerSTime) return null;
  const stamp = parseSarvTimestamp(custAnswerSTime);
  if (!stamp) return null;
  const { day, timeValue, iso } = stamp;

  for (const aanshId of aanshIds) {
    const { data: mapping } = await db
      .from('sarv_aansh_mappings')
      .select('assignee_id, assignee_role, telecaller_id, day_of_week, time_from, time_to')
      .eq('aansh_id', aanshId)
      .lte('effective_from', iso)
      .or(`effective_to.is.null,effective_to.gte.${iso}`)
      .order('effective_from', { ascending: false })
      .limit(10);

    const rows = Array.isArray(mapping) ? mapping : mapping ? [mapping] : [];
    for (const row of rows) {
      const days = Array.isArray(row.day_of_week) ? row.day_of_week : null;
      const dayMatch = !days || days.length === 0 || days.includes(day);
      if (!dayMatch) continue;

      const from = row.time_from ? String(row.time_from).slice(0, 8) : null;
      const to = row.time_to ? String(row.time_to).slice(0, 8) : null;
      if (!isTimeInWindow(timeValue, from, to)) continue;

      if (row?.assignee_id && row?.assignee_role) {
        return { id: row.assignee_id, role: row.assignee_role };
      }
      if (row?.telecaller_id) {
        return { id: row.telecaller_id, role: 'TELECALLER' };
      }
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await assertSuperAdmin(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body?.limit || 200), 1), 1000);

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }
    const db = supabaseAdmin as any;

    const { data: calls, error } = await db
      .from('sarv_calls')
      .select('id, masteragent, custanswerstime, raw_payload')
      .is('assigned_user_id', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: 'Failed to load SARV calls' }, { status: 500 });
    }

    let updated = 0;
    for (const call of calls || []) {
      const payload = (call.raw_payload || {}) as Record<string, any>;
      const custAnswerSTime =
        call.custanswerstime ||
        payload?.custAnswerSTime ||
        payload?.custanswerstime ||
        payload?.custAnswerSTime;
      const aanshIds = parseAansh(payload);

      if (aanshIds.length === 0 && call.masteragent) {
        aanshIds.push(Number(call.masteragent));
      }

      const assignee = await resolveAssignee(db, aanshIds, custAnswerSTime);
      if (!assignee) continue;

      await db
        .from('sarv_calls')
        .update({
          assigned_user_id: assignee.id,
          assigned_role: assignee.role,
          telecaller_id: assignee.role === 'TELECALLER' ? assignee.id : null,
        })
        .eq('id', call.id);

      updated += 1;
    }

    return NextResponse.json({ success: true, scanned: calls?.length || 0, updated }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}
