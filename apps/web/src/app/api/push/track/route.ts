import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Public (device) endpoint — records open/click for admin broadcasts.
 * Body: { tracking_id, event: 'open'|'click', campaign_id?, customer_id?, variant? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const trackingId = String(body?.tracking_id || '').trim();
    const event = String(body?.event || 'open').trim().toLowerCase();
    const campaignId = String(body?.campaign_id || '').trim() || null;
    const customerId = String(body?.customer_id || '').trim() || null;
    const variant = String(body?.variant || body?.ab_variant || '').trim() || null;
    const deviceToken = String(body?.device_token || '').trim() || null;

    if (!trackingId) {
      return NextResponse.json({ error: 'tracking_id required' }, { status: 400 });
    }
    if (event !== 'open' && event !== 'click') {
      return NextResponse.json({ error: 'event must be open or click' }, { status: 400 });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin not configured' }, { status: 500 });
    }

    const { data: logs } = await supabaseAdmin
      .from('notification_logs')
      .select('id, meta')
      .contains('meta', { tracking_id: trackingId })
      .limit(1);

    const log = (logs || [])[0] as { id: string; meta?: Record<string, unknown> } | undefined;
    const meta = { ...(log?.meta || {}) };
    if (event === 'open') meta.opens = Number(meta.opens || 0) + 1;
    if (event === 'click') meta.clicks = Number(meta.clicks || 0) + 1;

    if (log?.id) {
      await supabaseAdmin.from('notification_logs').update({ meta }).eq('id', log.id);
    }

    await supabaseAdmin.from('push_engagement_events').insert({
      notification_log_id: log?.id || null,
      campaign_id: campaignId,
      event_type: event,
      variant,
      customer_id: customerId,
      device_token: deviceToken,
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
