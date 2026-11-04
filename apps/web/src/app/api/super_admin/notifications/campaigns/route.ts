import { NextRequest, NextResponse } from 'next/server';
import { assertPushAdmin } from '@/lib/push/admin-auth';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { runScheduledPushCampaigns } from '@/lib/push/runScheduledCampaigns';
import { campaignCategory } from '@/lib/push/campaignCategory';

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

  const category = campaignCategory({ name, payload });
  const { data, error } = await supabaseAdmin
    .from('push_scheduled_campaigns')
    .insert({
      name,
      status: 'scheduled',
      scheduled_at: new Date(scheduledAt).toISOString(),
      payload: { ...payload, category },
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

  if (action === 'update') {
    const { data: existing, error: loadError } = await supabaseAdmin
      .from('push_scheduled_campaigns')
      .select('id, status, name, payload, ab_enabled, variant_b')
      .eq('id', id)
      .maybeSingle();
    if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
    if (!existing || existing.status !== 'scheduled') {
      return NextResponse.json({ error: 'Only a scheduled campaign can be edited' }, { status: 400 });
    }

    const payload = {
      ...((existing.payload && typeof existing.payload === 'object' ? existing.payload : {}) as Record<string, unknown>),
    };
    if (typeof body.title === 'string') payload.title = body.title.trim();
    if (typeof body.message === 'string') payload.message = body.message.trim();
    if (!String(payload.title || '').trim() || !String(payload.message || '').trim()) {
      return NextResponse.json({ error: 'Title and message are required' }, { status: 400 });
    }

    const patch: Record<string, unknown> = {
      payload,
      updated_at: new Date().toISOString(),
      error_message: null,
    };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    patch.name = name || String(payload.title);
    if (body.scheduled_at) {
      const when = new Date(String(body.scheduled_at));
      if (Number.isNaN(when.getTime())) {
        return NextResponse.json({ error: 'Valid schedule time is required' }, { status: 400 });
      }
      patch.scheduled_at = when.toISOString();
    }

    if (existing.ab_enabled) {
      const currentB =
        existing.variant_b && typeof existing.variant_b === 'object'
          ? (existing.variant_b as { title?: string; message?: string })
          : {};
      const nextB = body.variant_b && typeof body.variant_b === 'object' ? body.variant_b : {};
      const variantB = {
        title: String(nextB.title ?? currentB.title ?? '').trim(),
        message: String(nextB.message ?? currentB.message ?? '').trim(),
      };
      if (!variantB.title || !variantB.message) {
        return NextResponse.json({ error: 'Variant B title and message are required' }, { status: 400 });
      }
      patch.variant_b = variantB;
    }

    const { data, error } = await supabaseAdmin
      .from('push_scheduled_campaigns')
      .update(patch)
      .eq('id', id)
      .eq('status', 'scheduled')
      .select('id, name, status, scheduled_at, payload, variant_b')
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, campaign: data });
  }

  if (action === 'set_category') {
    const category = String(body?.category || '').toLowerCase();
    if (category !== 'festival' && category !== 'normal') {
      return NextResponse.json({ error: 'category must be festival or normal' }, { status: 400 });
    }
    const { data: existing, error: loadError } = await supabaseAdmin
      .from('push_scheduled_campaigns')
      .select('id, payload')
      .eq('id', id)
      .maybeSingle();
    if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    const payload = {
      ...((existing.payload && typeof existing.payload === 'object' ? existing.payload : {}) as Record<string, unknown>),
      category,
    };
    const { error } = await supabaseAdmin
      .from('push_scheduled_campaigns')
      .update({ payload, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, category });
  }

  if (action === 'send_now') {
    const result = await runScheduledPushCampaigns({ campaignId: id, force: true, limit: 1 });
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Send failed' }, { status: 500 });
    }
    const row = Array.isArray(result.results) ? result.results[0] : undefined;
    if (!row) {
      return NextResponse.json({ error: 'Campaign is not scheduled' }, { status: 400 });
    }
    if (row.status === 'failed') {
      return NextResponse.json({ error: row.error || 'Send failed', result: row }, { status: 502 });
    }
    return NextResponse.json({ ok: true, result: row });
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
}
