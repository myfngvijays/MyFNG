import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getClickToCallConfig, poolDidPhoneSet } from '@/lib/telecaller/clickToCallConfig';
import {
  detachForeignDidRecordingsThrottled,
  healClickToCallRecordingsForAssignedLeads,
} from '@/lib/telecaller/smartfloCdr';
import { normalizePhone10 } from '@/lib/telecaller/initiateClickToCall';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

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

    void detachForeignDidRecordingsThrottled();

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = supabaseAdmin ?? supabase;
    const ids = new Set<string>();
    const pageSize = 1000;
    const pool = poolDidPhoneSet(await getClickToCallConfig());

    // Never block this filter on Tata sync — Bookings must return in <2s.
    // Backfill continues in the background; Refresh picks up newly attached rows.
    void healClickToCallRecordingsForAssignedLeads({ timeBudgetMs: 55_000 })
      .then((heal) => console.warn('[with-recordings] assigned-c2c heal', heal))
      .catch((e: any) => {
        console.warn('[with-recordings] assigned-c2c heal failed', e?.message || e);
      });

    let from = 0;
    for (let guard = 0; guard < 50; guard++) {
      const { data, error } = await db
        .from('smartflo_call_recordings')
        .select('lead_id, did_number')
        .not('lead_id', 'is', null)
        .range(from, from + pageSize - 1);
      if (error) {
        if (/does not exist|schema cache|PGRST205|42P01/i.test(error.message || '')) break;
        return NextResponse.json(
          { error: error.message || 'Failed to load recording leads' },
          { status: 500 },
        );
      }
      const rows = Array.isArray(data) ? data : [];
      for (const row of rows) {
        const did10 = normalizePhone10((row as any).did_number);
        if (pool.size > 0 && did10 && !pool.has(did10)) {
          continue;
        }
        const id = String((row as any)?.lead_id || '').trim();
        if (id) ids.add(id);
      }
      if (rows.length < pageSize) break;
      from += pageSize;
    }

    from = 0;
    for (let guard = 0; guard < 50; guard++) {
      const { data, error } = await db
        .from('telecaller_call_logs')
        .select('lead_id')
        .not('call_recording_url', 'is', null)
        .neq('call_recording_url', '')
        .not('lead_id', 'is', null)
        .range(from, from + pageSize - 1);
      if (error) break;
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
