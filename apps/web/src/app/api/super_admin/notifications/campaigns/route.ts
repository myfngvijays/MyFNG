import { NextRequest, NextResponse } from 'next/server';
import { assertPushAdmin } from '@/lib/push/admin-auth';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const auth = await assertPushAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from('push_scheduled_campaigns')
    .select(
      'id, name, status, scheduled_at, sent_at, payload, ab_enabled, variant_b, result, error_message, notification_log_id, created_at, updated_at',
    )
    .order('scheduled_at', { ascending: false })
    .limit(100);

  if (error) {
    if (String(error.message || '').includes('push_scheduled_campaigns')) {
      return NextResponse.json({
        campaigns: [],
        missing_table: true,
        hint: 'Run database/294_push_campaigns_segments_schedule.sql',
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const campaignIds = (data || []).map((c: any) => c.id);
  let engagementByCampaign: Record<string, { opens: number; clicks: number }> = {};
  if (campaignIds.length > 0) {
    const { data: events } = await supabaseAdmin
      .from('push_engagement_events')
      .select('campaign_id, event_type')
      .in('campaign_id', campaignIds);
    for (const ev of events || []) {
      const cid = String((ev as any).campaign_id || '');
      if (!cid) continue;
      if (!engagementByCampaign[cid]) engagementByCampaign[cid] = { opens: 0, clicks: 0 };
      if ((ev as any).event_type === 'open') engagementByCampaign[cid].opens += 1;
      if ((ev as any).event_type === 'click') engagementByCampaign[cid].clicks += 1;
    }
  }

  return NextResponse.json({
    campaigns: (data || []).map((c: any) => ({
      ...c,
      engagement: engagementByCampaign[c.id] || { opens: 0, clicks: 0 },
    })),
  });
}

/** Schedule a campaign (immediate send uses /send; this is for future + A/B). */
export async function POST(request: NextRequest) {
  const auth = await assertPushAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body?.name || body?.payload?.title || 'Scheduled push').trim();
  const scheduledAt = String(body?.scheduled_at || '').trim();
  const payload = body?.payload && typeof body.payload === 'object' ? body.payload : null;
  const abEnabled = Boolean(body?.ab_enabled);
  const variantB = body?.variant_b && typeof body.variant_b === 'object' ? body.variant_b : null;

  if (!payload?.title || !payload?.message) {
    return NextResponse.json({ error: 'payload.title and payload.message required' }, { status: 400 });
  }
  if (!scheduledAt || Number.isNaN(Date.parse(scheduledAt))) {
    return NextResponse.json({ error: 'valid scheduled_at required' }, { status: 400 });
  }
  if (abEnabled && (!variantB?.title || !variantB?.message)) {
    return NextResponse.json({ error: 'variant_b.title and variant_b.message required for A/B' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('push_scheduled_campaigns')
    .insert({
      name,
      status: 'scheduled',
      scheduled_at: new Date(scheduledAt).toISOString(),
      payload,
      ab_enabled: abEnabled,
      variant_b: abEnabled ? variantB : null,
      created_by: auth.userId,
      updated_at: new Date().toISOString(),
    })
    .select('id, name, status, scheduled_at, ab_enabled')
    .maybeSingle();

  if (error) {
    if (String(error.message || '').includes('push_scheduled_campaigns')) {
      return NextResponse.json(
        { error: 'Missing table. Run database/294_push_campaigns_segments_schedule.sql' },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ campaign: data });
}

export async function PATCH(request: NextRequest) {
  const auth = await assertPushAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 });

  const body = await request.json().catch(() => ({}));
  const id = String(body?.id || '').trim();
  const action = String(body?.action || '').trim();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  if (action === 'cancel') {
    const { error } = await supabaseAdmin
      .from('push_scheduled_campaigns')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'scheduled');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
}
