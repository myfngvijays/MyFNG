import { NextRequest, NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/cron/assertCronAuth';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { getClickToCallConfig } from '@/lib/telecaller/clickToCallConfig';
import { autoDialFreshLeadIfEnabled } from '@/lib/telecaller/initiateClickToCall';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const FRESH_STATUSES = new Set(['NEW', 'FRESH', 'ASSIGNED']);
const MAX_DIALS = 6;

/**
 * Catch-up: Fresh leads assigned outside calling hours get auto-dial
 * when the telecaller's IST window opens.
 */
async function handle(req: NextRequest) {
  const authError = await assertCronAuth(req);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const cfg = await getClickToCallConfig();
  if (!cfg.enabled || !cfg.auto_dial_on_fresh_assign) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'auto_dial_off',
    });
  }
  if (!cfg.auto_dial_hours_enabled) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'hours_disabled_24x7',
    });
  }

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Admin client unavailable' }, { status: 500 });
  }

  const { data: rows, error } = await supabaseAdmin
    .from('service_leads')
    .select('id, customer_phone, status, assigned_telecaller_id, coupon_meta')
    .not('assigned_telecaller_id', 'is', null)
    .contains('coupon_meta', { auto_dial_pending: true })
    .order('updated_at', { ascending: true })
    .limit(40);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const pending = (rows || []).filter((row: any) => {
    const status = String(row.status || '').toUpperCase();
    return !status || FRESH_STATUSES.has(status) || status.includes('FRESH');
  });

  const results: Array<{ lead_id: string; ok: boolean; skipped?: boolean; reason?: string }> = [];
  let dialed = 0;

  for (const row of pending) {
    if (dialed >= MAX_DIALS) break;
    const leadId = String(row.id);
    const outcome = await autoDialFreshLeadIfEnabled({
      leadId,
      customerPhone: row.customer_phone,
      telecallerId: row.assigned_telecaller_id,
      leadStatus: row.status,
    });
    const skipped = Boolean((outcome as any)?.skipped);
    const ok = Boolean((outcome as any)?.ok);
    results.push({
      lead_id: leadId,
      ok,
      skipped,
      reason: skipped ? String((outcome as any).reason || '') : (outcome as any).error,
    });
    if (ok) dialed += 1;
  }

  return NextResponse.json({
    ok: true,
    pending: pending.length,
    attempted: results.length,
    dialed,
    results,
    timestamp: new Date().toISOString(),
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
