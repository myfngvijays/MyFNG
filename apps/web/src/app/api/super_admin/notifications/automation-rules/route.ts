import { assertPushAdmin } from '@/lib/push/admin-auth';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TRIGGERS = new Set([
  'welcome_bonus_expiry',
  'membership_expiry',
  'inactive_customer',
  'booking_completed_followup',
]);
const MODES = new Set(['once_at_days', 'daily_range']);

export async function GET(request: NextRequest) {
  try {
    const auth = await assertPushAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const templateId = new URL(request.url).searchParams.get('template_id')?.trim() || '';

    let q = supabaseAdmin
      .from('push_automation_rules')
      .select(
        'id, template_id, trigger_type, schedule_mode, days_min, days_max, is_active, updated_at, push_notification_templates(id, name, title, category, is_active)',
      )
      .order('days_max', { ascending: false });

    if (templateId) q = q.eq('template_id', templateId);

    const { data, error } = await q;
    if (error) {
      if (String(error.message || '').includes('push_automation_rules')) {
        return NextResponse.json({
          rules: [],
          missing_table: true,
          hint: 'Run database/293_push_automation_rules.sql',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rules: data || [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Upsert automation schedule for a template (also sets category=automation). */
export async function PUT(request: NextRequest) {
  try {
    const auth = await assertPushAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const templateId = String(body?.template_id || '').trim();
    const triggerType = String(body?.trigger_type || 'welcome_bonus_expiry').trim();
    const scheduleMode = String(body?.schedule_mode || '').trim();
    let daysMin = Number(body?.days_min);
    let daysMax = Number(body?.days_max);
    const isActive = body?.is_active == null ? true : Boolean(body.is_active);

    if (!templateId) {
      return NextResponse.json({ error: 'template_id required' }, { status: 400 });
    }
    if (!TRIGGERS.has(triggerType)) {
      return NextResponse.json({ error: 'Unsupported trigger_type' }, { status: 400 });
    }
    if (!MODES.has(scheduleMode)) {
      return NextResponse.json({ error: 'schedule_mode must be once_at_days or daily_range' }, { status: 400 });
    }

    if (scheduleMode === 'once_at_days') {
      const d = Number.isFinite(daysMin) ? daysMin : daysMax;
      if (!Number.isFinite(d) || d < 0 || d > 365) {
        return NextResponse.json({ error: 'days value must be 0–365' }, { status: 400 });
      }
      daysMin = d;
      daysMax = d;
    } else {
      if (!Number.isFinite(daysMin) || !Number.isFinite(daysMax) || daysMin < 0 || daysMax > 365 || daysMin > daysMax) {
        return NextResponse.json(
          { error: 'daily_range needs days_min ≤ days_max (0–365)' },
          { status: 400 },
        );
      }
    }

    const { data: tpl, error: tplErr } = await supabaseAdmin
      .from('push_notification_templates')
      .select('id, name')
      .eq('id', templateId)
      .maybeSingle();
    if (tplErr || !tpl) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    await supabaseAdmin
      .from('push_notification_templates')
      .update({ category: 'automation', updated_at: new Date().toISOString() })
      .eq('id', templateId);

    const row = {
      template_id: templateId,
      trigger_type: triggerType,
      schedule_mode: scheduleMode,
      days_min: daysMin,
      days_max: daysMax,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabaseAdmin
      .from('push_automation_rules')
      .select('id')
      .eq('template_id', templateId)
      .maybeSingle();

    let rule;
    if (existing?.id) {
      const { data, error } = await supabaseAdmin
        .from('push_automation_rules')
        .update(row)
        .eq('id', existing.id)
        .select('*')
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      rule = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from('push_automation_rules')
        .insert(row)
        .select('*')
        .maybeSingle();
      if (error) {
        if (String(error.message || '').includes('push_automation_rules')) {
          return NextResponse.json(
            { error: 'Run database/293_push_automation_rules.sql first', details: error.message },
            { status: 500 },
          );
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      rule = data;
    }

    return NextResponse.json({ success: true, rule });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Remove automation rule and move template back to Manual (general). */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await assertPushAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const templateId =
      new URL(request.url).searchParams.get('template_id')?.trim() ||
      String((await request.json().catch(() => ({})))?.template_id || '').trim();

    if (!templateId) {
      return NextResponse.json({ error: 'template_id required' }, { status: 400 });
    }

    await supabaseAdmin.from('push_automation_rules').delete().eq('template_id', templateId);
    await supabaseAdmin
      .from('push_notification_templates')
      .update({ category: 'general', updated_at: new Date().toISOString() })
      .eq('id', templateId);

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
