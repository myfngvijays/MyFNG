import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enumerateYmdRange, resolveReportDateRange, shouldApplyDateRangeFilter } from '@/lib/report-date-range';

const ALLOWED_ADMIN_ROLES = ['SUPER_ADMIN', 'SUB_ADMIN'];
const MAX_DAILY_CHART_DAYS = 30;

type MessageRow = {
  status?: string | null;
  template_name?: string | null;
  created_at?: string | null;
  direction?: string | null;
  message_type?: string | null;
  recipient_phone?: string | null;
  error_message?: string | null;
  meta?: { source?: string; trigger_key?: string } | null;
};

type TriggerLogRow = {
  trigger_key?: string | null;
  template_name?: string | null;
  delivery_status?: string | null;
  sent_at?: string | null;
};

type AutomationSettingRow = {
  trigger_key?: string | null;
  display_name?: string | null;
  template_name?: string | null;
  is_enabled?: boolean | null;
};

function getDateRangeFromRequest(request: NextRequest) {
  const preset = String(request.nextUrl.searchParams.get('preset') || 'last_7_days');
  const customStart = request.nextUrl.searchParams.get('start');
  const customEnd = request.nextUrl.searchParams.get('end');
  return resolveReportDateRange(preset, customStart, customEnd);
}

function normStatus(value: unknown) {
  return String(value || '').trim().toUpperCase();
}

function isOutboundTemplate(row: MessageRow) {
  return normStatus(row.direction) === 'OUTBOUND' && normStatus(row.message_type) === 'TEMPLATE';
}

function isAutomationMessage(row: MessageRow) {
  return String(row.meta?.source || '').trim() === 'whatsapp_automation';
}

function maskPhone(phone: string | null | undefined) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 4) return '—';
  return `****${digits.slice(-4)}`;
}

function dayKey(iso: string | null | undefined) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  } catch {
    return String(iso).slice(0, 10);
  }
}

async function assertAdmin(db: any) {
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (authError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const { data: userProfile } = await db
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .maybeSingle();

  const roleCode = (userProfile as any)?.roles?.role_code;
  if (!userProfile || !ALLOWED_ADMIN_ROLES.includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }
  return { ok: true, status: 200, error: null };
}

export async function GET(request: NextRequest) {
  try {
    const preset = String(request.nextUrl.searchParams.get('preset') || 'last_7_days');
    const customStart = request.nextUrl.searchParams.get('start');
    const customEnd = request.nextUrl.searchParams.get('end');
    const range = getDateRangeFromRequest(request);
    const applyDateFilter = shouldApplyDateRangeFilter(preset);

    const supabase = await createClient();
    const db: any = supabase;
    const auth = await assertAdmin(db);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    let messageQuery = db
      .from('whatsapp_messages')
      .select(
        'status, template_name, created_at, direction, message_type, recipient_phone, error_message, meta'
      )
      .order('created_at', { ascending: false })
      .limit(10000);

    if (applyDateFilter) {
      messageQuery = messageQuery.gte('created_at', range.start).lte('created_at', range.end);
    }

    let webhookQuery = db
      .from('whatsapp_webhook_events')
      .select('id, process_status, process_note, received_at, processed_at')
      .order('received_at', { ascending: false })
      .limit(20);

    if (applyDateFilter) {
      webhookQuery = webhookQuery.gte('received_at', range.start).lte('received_at', range.end);
    }

    let triggerLogQuery = db
      .from('whatsapp_trigger_logs')
      .select('trigger_key, template_name, delivery_status, sent_at')
      .order('sent_at', { ascending: false })
      .limit(5000);

    if (applyDateFilter) {
      triggerLogQuery = triggerLogQuery.gte('sent_at', range.start).lte('sent_at', range.end);
    }

    const [
      { data: messageRows, error: messageError },
      { count: totalTemplates, error: templateError },
      { count: approvedTemplates, error: approvedTemplateError },
      { count: utilityTemplates, error: utilityTemplateError },
      { count: marketingTemplates, error: marketingTemplateError },
      { data: webhookRows, error: webhookError },
      { data: triggerLogs, error: triggerLogError },
      { data: automationSettings, error: automationSettingsError },
    ] = await Promise.all([
      messageQuery,
      db.from('whatsapp_templates').select('*', { count: 'exact', head: true }),
      db.from('whatsapp_templates').select('*', { count: 'exact', head: true }).eq('is_active', true),
      db.from('whatsapp_templates').select('*', { count: 'exact', head: true }).eq('category', 'UTILITY'),
      db.from('whatsapp_templates').select('*', { count: 'exact', head: true }).eq('category', 'MARKETING'),
      webhookQuery,
      triggerLogQuery,
      db
        .from('whatsapp_automation_settings')
        .select('trigger_key, display_name, template_name, is_enabled')
        .order('display_name', { ascending: true }),
    ]);

    if (messageError) {
      return NextResponse.json({ error: messageError.message || 'Failed to fetch messages' }, { status: 500 });
    }
    if (templateError) {
      return NextResponse.json({ error: templateError.message || 'Failed to fetch templates' }, { status: 500 });
    }
    if (approvedTemplateError) {
      return NextResponse.json(
        { error: approvedTemplateError.message || 'Failed to fetch approved templates' },
        { status: 500 }
      );
    }
    if (utilityTemplateError || marketingTemplateError) {
      return NextResponse.json({ error: 'Failed to fetch template categories' }, { status: 500 });
    }
    if (webhookError) {
      return NextResponse.json({ error: webhookError.message || 'Failed to fetch webhook events' }, { status: 500 });
    }
    if (triggerLogError) {
      return NextResponse.json({ error: triggerLogError.message || 'Failed to fetch trigger logs' }, { status: 500 });
    }
    if (automationSettingsError) {
      return NextResponse.json(
        { error: automationSettingsError.message || 'Failed to fetch automation settings' },
        { status: 500 }
      );
    }

    const outboundTemplates = ((messageRows || []) as MessageRow[]).filter(isOutboundTemplate);
    const automationOutbound = outboundTemplates.filter(isAutomationMessage);
    const manualOutbound = outboundTemplates.filter((row) => !isAutomationMessage(row));

    const countByStatus = (rows: MessageRow[]) => {
      const sent = rows.filter((row) => ['SENT', 'DELIVERED', 'VIEWED'].includes(normStatus(row.status))).length;
      const delivered = rows.filter((row) => ['DELIVERED', 'VIEWED'].includes(normStatus(row.status))).length;
      const read = rows.filter((row) => normStatus(row.status) === 'VIEWED').length;
      const failed = rows.filter((row) => normStatus(row.status) === 'FAILED').length;
      const pending = rows.filter((row) => !row.status || normStatus(row.status) === 'SENT').length;
      return { total: rows.length, sent, delivered, read, failed, pending };
    };

    const overall = countByStatus(outboundTemplates);
    const automationStats = countByStatus(automationOutbound);
    const manualStats = countByStatus(manualOutbound);

    const deliveryRate = overall.sent > 0 ? (overall.delivered / overall.sent) * 100 : 0;
    const readRate = overall.delivered > 0 ? (overall.read / overall.delivered) * 100 : 0;
    const failureRate = overall.total > 0 ? (overall.failed / overall.total) * 100 : 0;

    const templateStatsMap = new Map<
      string,
      { name: string; sent: number; delivered: number; read: number; failed: number; automation: number }
    >();

    for (const row of outboundTemplates) {
      const name = String(row.template_name || '').trim();
      if (!name) continue;
      const current = templateStatsMap.get(name) || {
        name,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
        automation: 0,
      };
      const status = normStatus(row.status);
      if (['SENT', 'DELIVERED', 'VIEWED'].includes(status)) current.sent += 1;
      if (['DELIVERED', 'VIEWED'].includes(status)) current.delivered += 1;
      if (status === 'VIEWED') current.read += 1;
      if (status === 'FAILED') current.failed += 1;
      if (isAutomationMessage(row)) current.automation += 1;
      templateStatsMap.set(name, current);
    }

    const templateStats = Array.from(templateStatsMap.values())
      .map((row) => ({
        ...row,
        delivery_rate: row.sent > 0 ? (row.delivered / row.sent) * 100 : 0,
        read_rate: row.delivered > 0 ? (row.read / row.delivered) * 100 : 0,
      }))
      .sort((a, b) => b.sent - a.sent);

    const dailyVolumeMap = new Map<string, { date: string; sent: number; delivered: number; read: number; failed: number }>();
    for (const row of outboundTemplates) {
      const key = dayKey(row.created_at);
      if (!key) continue;
      const current = dailyVolumeMap.get(key) || { date: key, sent: 0, delivered: 0, read: 0, failed: 0 };
      const status = normStatus(row.status);
      if (['SENT', 'DELIVERED', 'VIEWED'].includes(status)) current.sent += 1;
      if (['DELIVERED', 'VIEWED'].includes(status)) current.delivered += 1;
      if (status === 'VIEWED') current.read += 1;
      if (status === 'FAILED') current.failed += 1;
      dailyVolumeMap.set(key, current);
    }

    const fullDailyRange = enumerateYmdRange(range.startYmd, range.endYmd);
    const chartStartYmd =
      fullDailyRange.length > MAX_DAILY_CHART_DAYS
        ? fullDailyRange[fullDailyRange.length - MAX_DAILY_CHART_DAYS]
        : range.startYmd;

    const dailyVolume = enumerateYmdRange(chartStartYmd, range.endYmd).map((date) => {
      const existing = dailyVolumeMap.get(date);
      return existing || { date, sent: 0, delivered: 0, read: 0, failed: 0 };
    });

    const dailyVolumeMeta = {
      max_days: MAX_DAILY_CHART_DAYS,
      shown_days: dailyVolume.length,
      total_range_days: fullDailyRange.length,
      truncated: fullDailyRange.length > MAX_DAILY_CHART_DAYS,
      chart_start_ymd: chartStartYmd,
      chart_end_ymd: range.endYmd,
    };

    const statusBreakdown = {
      read: outboundTemplates.filter((row) => normStatus(row.status) === 'VIEWED').length,
      delivered_only: outboundTemplates.filter((row) => normStatus(row.status) === 'DELIVERED').length,
      sent_pending: outboundTemplates.filter((row) => normStatus(row.status) === 'SENT').length,
      failed: outboundTemplates.filter((row) => normStatus(row.status) === 'FAILED').length,
    };

    const sourceBreakdown = {
      automation: automationStats.sent,
      manual: manualStats.sent,
    };

    const templateShare = templateStats.slice(0, 6).map((row) => ({
      name: row.name,
      value: row.sent,
    }));

    const triggerStatsMap = new Map<
      string,
      { trigger_key: string; sent: number; failed: number; skipped: number; template_name: string | null }
    >();

    for (const row of (triggerLogs || []) as TriggerLogRow[]) {
      const key = String(row.trigger_key || '').trim();
      if (!key) continue;
      const current = triggerStatsMap.get(key) || {
        trigger_key: key,
        sent: 0,
        failed: 0,
        skipped: 0,
        template_name: row.template_name || null,
      };
      const status = normStatus(row.delivery_status);
      if (status === 'SENT') current.sent += 1;
      else if (status === 'FAILED') current.failed += 1;
      else if (status === 'SKIPPED') current.skipped += 1;
      if (row.template_name) current.template_name = row.template_name;
      triggerStatsMap.set(key, current);
    }

    const settingsByKey = new Map(
      ((automationSettings || []) as AutomationSettingRow[]).map((row) => [
        String(row.trigger_key || ''),
        row,
      ])
    );

    const automationTriggers = Array.from(triggerStatsMap.values())
      .map((row) => {
        const setting = settingsByKey.get(row.trigger_key);
        return {
          ...row,
          display_name: setting?.display_name || row.trigger_key,
          is_enabled: Boolean(setting?.is_enabled),
          configured_template: setting?.template_name || row.template_name,
          total_attempts: row.sent + row.failed + row.skipped,
        };
      })
      .sort((a, b) => b.total_attempts - a.total_attempts);

    const enabledAutomationCount = ((automationSettings || []) as AutomationSettingRow[]).filter(
      (row) => row.is_enabled
    ).length;

    const recentMessages = outboundTemplates.slice(0, 25).map((row) => ({
      id: `${row.created_at}-${row.template_name}-${row.recipient_phone}`,
      time: row.created_at,
      template_name: row.template_name,
      phone: maskPhone(row.recipient_phone),
      status: normStatus(row.status) || 'SENT',
      source: isAutomationMessage(row) ? 'automation' : 'manual',
      trigger_key: row.meta?.trigger_key || null,
      error_message: row.error_message || null,
    }));

    const recentFailures = outboundTemplates
      .filter((row) => normStatus(row.status) === 'FAILED')
      .slice(0, 10)
      .map((row) => ({
        time: row.created_at,
        template_name: row.template_name,
        phone: maskPhone(row.recipient_phone),
        error_message: row.error_message || 'Delivery failed',
        source: isAutomationMessage(row) ? 'automation' : 'manual',
      }));

    return NextResponse.json({
      success: true,
      preset,
      range_label: range.label,
      from: range.start,
      to: range.end,
      start_ymd: range.startYmd,
      end_ymd: range.endYmd,
      kpis: {
        outbound_total: overall.total,
        sent: overall.sent,
        delivered: overall.delivered,
        read: overall.read,
        failed: overall.failed,
        pending: overall.pending,
        delivery_rate: deliveryRate,
        read_rate: readRate,
        failure_rate: failureRate,
        automation_sent: automationStats.sent,
        manual_sent: manualStats.sent,
        enabled_automation_triggers: enabledAutomationCount,
        total_automation_triggers: (automationSettings || []).length,
        total_templates: totalTemplates || 0,
        approved_templates: approvedTemplates || 0,
        utility_templates: utilityTemplates || 0,
        marketing_templates: marketingTemplates || 0,
      },
      sources: {
        automation: automationStats,
        manual: manualStats,
      },
      template_stats: templateStats,
      top_templates: templateStats.slice(0, 5).map((row) => ({
        name: row.name,
        count: row.sent,
        delivered: row.delivered,
        delivery_rate: row.delivery_rate,
      })),
      automation_triggers: automationTriggers,
      daily_volume: dailyVolume,
      daily_volume_meta: dailyVolumeMeta,
      status_breakdown: statusBreakdown,
      source_breakdown: sourceBreakdown,
      template_share: templateShare,
      recent_messages: recentMessages,
      recent_failures: recentFailures,
      recent_events: (webhookRows || []).map((event: any) => ({
        id: event.id,
        status: event.process_status,
        note: event.process_note,
        time: event.received_at,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
