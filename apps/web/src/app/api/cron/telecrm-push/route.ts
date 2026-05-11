import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  pushTelecrmRow,
  TELECRM_API_SELECT_COLUMNS,
  type TelecrmRow,
} from '@/lib/telecrm/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Backfill cron: picks telecrm_api rows that were never successfully pushed to
 * TeleCRM (api_response IS NULL) and are old enough that any RSA-lead enrichment
 * trigger would have already fired. Uses the shared booking-style push helper
 * so the payload is identical to the realtime path used by the Sarv webhook /
 * RSA complaint endpoints.
 */

const HOURS_DELAY = 12;
const BATCH_SIZE = 50;

function assertCronAuth(req: NextRequest): string | null {
  const secret = process.env.CRON_SECRET || process.env.NOTIFICATION_CRON_SECRET;
  if (!secret) return 'CRON secret is not configured on server';

  const auth = req.headers.get('authorization') || '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token || token !== secret) return 'Unauthorized';
  return null;
}

export async function GET(request: NextRequest) {
  const authError = assertCronAuth(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
  }
  const db = supabaseAdmin as any;

  const cutoff = new Date(Date.now() - HOURS_DELAY * 60 * 60 * 1000).toISOString();

  const { data: rows, error: fetchErr } = await db
    .from('telecrm_api')
    .select(TELECRM_API_SELECT_COLUMNS)
    .is('api_response', null)
    .lt('updated_at', cutoff)
    .order('updated_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ success: true, processed: 0, message: 'No pending rows' });
  }

  const results: { id: string; status: 'ok' | 'error' | 'skipped'; error?: string }[] = [];

  for (const row of rows as TelecrmRow[]) {
    const result = await pushTelecrmRow(db, row, 'cron telecrm-push');
    if (result.success) {
      results.push({ id: row.id, status: 'ok' });
    } else if (result.skipped) {
      results.push({ id: row.id, status: 'skipped', error: result.reason });
    } else {
      results.push({ id: row.id, status: 'error', error: result.error });
    }
  }

  const okCount = results.filter((r) => r.status === 'ok').length;
  const skipCount = results.filter((r) => r.status === 'skipped').length;
  return NextResponse.json({
    success: true,
    processed: results.length,
    ok: okCount,
    skipped: skipCount,
    results,
  });
}
