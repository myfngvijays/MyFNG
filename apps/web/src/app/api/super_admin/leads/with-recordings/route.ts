import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/super_admin/leads/with-recordings
 * Distinct lead_ids that have at least one Smartflo/telecaller call recording URL.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await resolveUserProfile(supabase, user);
    const roleCode = String((profile?.roles as any)?.role_code || '')
      .trim()
      .toUpperCase();
    const allowed = new Set(['SUPER_ADMIN', 'SUB_ADMIN', 'LEAD_MANAGER']);
    if (!allowed.has(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = supabaseAdmin ?? supabase;
    const ids = new Set<string>();
    const pageSize = 1000;

    let from = 0;
    for (let guard = 0; guard < 50; guard++) {
      const { data, error } = await db
        .from('telecaller_call_logs')
        .select('lead_id')
        .not('call_recording_url', 'is', null)
        .neq('call_recording_url', '')
        .range(from, from + pageSize - 1);
      if (error) {
        return NextResponse.json(
          { error: error.message || 'Failed to load recording leads' },
          { status: 500 },
        );
      }
      const rows = Array.isArray(data) ? data : [];
      for (const row of rows) {
        const id = String((row as any)?.lead_id || '').trim();
        if (id) ids.add(id);
      }
      if (rows.length < pageSize) break;
      from += pageSize;
    }

    // Also include CDR rows matched to a lead even if call log attach lagged
    from = 0;
    for (let guard = 0; guard < 50; guard++) {
      const { data, error } = await db
        .from('smartflo_call_recordings')
        .select('lead_id')
        .not('recording_url', 'is', null)
        .neq('recording_url', '')
        .not('lead_id', 'is', null)
        .range(from, from + pageSize - 1);
      if (error) {
        // Table may not exist yet — ignore
        if (/does not exist|schema cache|PGRST205|42P01/i.test(error.message || '')) break;
        console.warn('[with-recordings] smartflo table:', error.message);
        break;
      }
      const rows = Array.isArray(data) ? data : [];
      for (const row of rows) {
        const id = String((row as any)?.lead_id || '').trim();
        if (id) ids.add(id);
      }
      if (rows.length < pageSize) break;
      from += pageSize;
    }

    return NextResponse.json({
      success: true,
      lead_ids: Array.from(ids),
      total: ids.size,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
