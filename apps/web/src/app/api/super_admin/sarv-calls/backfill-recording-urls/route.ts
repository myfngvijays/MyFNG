import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { fetchDeepcallRecordingUrl } from '@/lib/sarv/deepcall';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Bulk-refresh saved recording URLs for sarv_calls rows whose URL is missing
 * or pointing at the legacy s-ct3.sarv.com host (which 404s after the
 * DeepCall migration). Calls DeepCall's CallReport/detail per row to fetch
 * a fresh signed directstream URL.
 *
 * POST body (all optional):
 *   {
 *     limit:         number  // default 100, max 500 — kitne calls ek run me handle ho
 *     scope:         "missing" | "legacy" | "all"  // default "legacy"
 *     dry_run:       boolean // default false — sirf preview, DB me update nahi
 *   }
 *
 * "missing" → recording_url IS NULL
 * "legacy"  → recording_url IS NULL or NOT LIKE '%/directstream/%'
 * "all"     → har row (re-sign even if already directstream)
 *
 * Auth: SUPER_ADMIN / SUB_ADMIN.
 */

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;

async function assertAdmin(supabase: any) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false as const, status: 401, error: 'Unauthorized' };
  }
  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();
  if (roleError || !userData) {
    return { ok: false as const, status: 403, error: 'Forbidden - Role check failed' };
  }
  const roleCode = String((userData as any).roles?.role_code || '');
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden - Not super admin' };
  }
  return { ok: true as const, user };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await assertAdmin(supabase);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }
    const db = supabaseAdmin as any;

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // empty body is fine, fall back to defaults
    }

    const limit = Math.min(
      Math.max(1, Number(body?.limit) || DEFAULT_LIMIT),
      MAX_LIMIT
    );
    const scope = ['missing', 'legacy', 'all'].includes(String(body?.scope))
      ? (String(body.scope) as 'missing' | 'legacy' | 'all')
      : 'legacy';
    const dryRun = Boolean(body?.dry_run);

    let query = db
      .from('sarv_calls')
      .select('id, callid, recording_url')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (scope === 'missing') {
      query = query.is('recording_url', null);
    } else if (scope === 'legacy') {
      // Either null OR doesn't have /directstream/ in it (legacy s-ct3 + relative paths)
      query = query.or('recording_url.is.null,recording_url.not.ilike.%/directstream/%');
    }

    const { data: rows, error: fetchErr } = await query;
    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    const now = new Date().toISOString();
    const results: Array<{
      id: string;
      callid: string;
      previous_url: string | null;
      recording_url?: string;
      status: 'updated' | 'unchanged' | 'failed' | 'dry_run';
      error?: string;
    }> = [];

    for (const row of rows || []) {
      if (!row?.callid) {
        results.push({
          id: String(row?.id || ''),
          callid: '',
          previous_url: row?.recording_url || null,
          status: 'failed',
          error: 'Missing callid',
        });
        continue;
      }

      const fetchResult = await fetchDeepcallRecordingUrl(String(row.callid));
      if (!fetchResult.url) {
        results.push({
          id: String(row.id),
          callid: String(row.callid),
          previous_url: row.recording_url || null,
          status: 'failed',
          error: fetchResult.error || 'No URL returned',
        });
        continue;
      }

      if (fetchResult.url === row.recording_url) {
        results.push({
          id: String(row.id),
          callid: String(row.callid),
          previous_url: row.recording_url,
          recording_url: fetchResult.url,
          status: 'unchanged',
        });
        continue;
      }

      if (dryRun) {
        results.push({
          id: String(row.id),
          callid: String(row.callid),
          previous_url: row.recording_url || null,
          recording_url: fetchResult.url,
          status: 'dry_run',
        });
        continue;
      }

      const { error: updateErr } = await db
        .from('sarv_calls')
        .update({ recording_url: fetchResult.url, updated_at: now })
        .eq('id', row.id);
      if (updateErr) {
        results.push({
          id: String(row.id),
          callid: String(row.callid),
          previous_url: row.recording_url || null,
          status: 'failed',
          error: updateErr.message,
        });
        continue;
      }

      results.push({
        id: String(row.id),
        callid: String(row.callid),
        previous_url: row.recording_url || null,
        recording_url: fetchResult.url,
        status: 'updated',
      });
    }

    const summary = {
      processed: results.length,
      updated: results.filter((r) => r.status === 'updated').length,
      unchanged: results.filter((r) => r.status === 'unchanged').length,
      failed: results.filter((r) => r.status === 'failed').length,
      dry_run: results.filter((r) => r.status === 'dry_run').length,
    };

    return NextResponse.json({ success: true, scope, limit, dry_run: dryRun, summary, results });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: e?.message },
      { status: 500 }
    );
  }
}
