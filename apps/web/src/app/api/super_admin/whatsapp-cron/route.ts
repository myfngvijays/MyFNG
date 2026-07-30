import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  WHATSAPP_CRON_JOBS,
  buildWhatsAppCronUrl,
  type WhatsAppCronJobDef,
} from '@/lib/whatsapp/cronSchedules';
import {
  isWhatsAppAutomationCronMasterEnabled,
  listAutomationSettings,
} from '@/lib/services/whatsappAutomation';
import { getResolvedWhatsAppAgentsCredentials } from '@/lib/whatsappAgents/shared/envConfigStore';
import {
  addSystemAlertWhatsAppNumber,
  listSystemAlertWhatsAppNumbers,
  removeSystemAlertWhatsAppNumber,
  setSystemAlertWhatsAppNumberEnabled,
} from '@/lib/services/systemAlertWhatsAppNumbers';
import {
  getWhatsAppCronJobEnabledMap,
  setWhatsAppCronJobEnabled,
} from '@/lib/services/whatsappCronJobFlags';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  const role = (profile as { roles?: { role_code?: string } } | null)?.roles?.role_code || '';
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(role)) {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }
  return { ok: true as const, role, userId: user.id };
}

function publicBaseUrl(req: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    `${req.nextUrl.protocol}//${req.nextUrl.host}`
  ).replace(/\/$/, '');
}

export async function GET(request: NextRequest) {
  try {
    const auth = await assertAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const [cronMasterEnabled, settings, jobEnabledMap, alertNumbers] = await Promise.all([
      isWhatsAppAutomationCronMasterEnabled(),
      listAutomationSettings(),
      getWhatsAppCronJobEnabledMap(),
      listSystemAlertWhatsAppNumbers(),
    ]);

    const byKey = new Map(settings.map((s) => [s.trigger_key, s]));
    const baseUrl = publicBaseUrl(request);
    const enabledAlertCount = alertNumbers.filter((n) => n.enabled).length;

    const jobs = WHATSAPP_CRON_JOBS.map((job) => {
      const jobOn = jobEnabledMap[job.id] !== false;
      const triggers = job.triggerKeys.map((key) => {
        const row = byKey.get(key);
        return {
          trigger_key: key,
          display_name: row?.display_name || key,
          is_enabled: Boolean(row?.is_enabled),
          cron_enabled: Boolean(row?.cron_enabled),
        };
      });

      if (job.category === 'system_health') {
        const willSend = jobOn && enabledAlertCount > 0;
        return {
          ...job,
          job_enabled: jobOn,
          endpoint_url: buildWhatsAppCronUrl(baseUrl, job),
          triggers: [],
          effective: {
            master_on: true,
            triggers_cron_on: true,
            triggers_active: enabledAlertCount > 0,
            will_send: willSend,
            block_reason: !jobOn
              ? 'This job is OFF'
              : enabledAlertCount === 0
                ? 'No alert numbers enabled'
                : null,
          },
        };
      }

      const allCronOn = triggers.length === 0 || triggers.every((t) => t.cron_enabled);
      const anyTriggerOn = triggers.length === 0 || triggers.some((t) => t.is_enabled);
      const willSend = jobOn && cronMasterEnabled && allCronOn && anyTriggerOn;

      return {
        ...job,
        job_enabled: jobOn,
        endpoint_url: buildWhatsAppCronUrl(baseUrl, job),
        triggers,
        effective: {
          master_on: cronMasterEnabled,
          triggers_cron_on: allCronOn,
          triggers_active: anyTriggerOn,
          will_send: willSend,
          block_reason: !jobOn
            ? 'This job is OFF'
            : !cronMasterEnabled
              ? 'Master switch is OFF'
              : !allCronOn
                ? 'One or more linked triggers have Cron OFF'
                : !anyTriggerOn
                  ? 'Linked trigger Active is OFF'
                  : null,
        },
      };
    });

    return NextResponse.json({
      success: true,
      provider: 'Supabase pg_cron → pg_net → MyFNG',
      base_url: baseUrl,
      cron_master_enabled: cronMasterEnabled,
      alert_numbers: alertNumbers,
      alert_numbers_enabled_count: enabledAlertCount,
      sql_source: 'database/scripts/supabase_cron_whatsapp_automation.sql',
      timezone_note: 'Schedules stored in UTC on Supabase. IST labels are Asia/Kolkata (+5:30).',
      jobs,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await assertAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || 'run').trim();

    if (action === 'toggle-job') {
      const jobId = String(body?.jobId || '').trim();
      const enabled = Boolean(body?.enabled);
      const result = await setWhatsAppCronJobEnabled(jobId, enabled, auth.userId);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ success: true, jobId, enabled, map: result.map });
    }

    if (action === 'toggle-alert-number') {
      const phone = String(body?.phone || '').trim();
      const enabled = Boolean(body?.enabled);
      const result = await setSystemAlertWhatsAppNumberEnabled(phone, enabled, auth.userId);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ success: true, numbers: result.numbers });
    }

    if (action === 'add-alert-number') {
      const phone = String(body?.phone || '').trim();
      const result = await addSystemAlertWhatsAppNumber(phone, auth.userId);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ success: true, numbers: result.numbers });
    }

    if (action === 'remove-alert-number') {
      const phone = String(body?.phone || '').trim();
      const result = await removeSystemAlertWhatsAppNumber(phone, auth.userId);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ success: true, numbers: result.numbers });
    }

    // Default: run now
    if (auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only Super Admin can run cron jobs' }, { status: 403 });
    }

    const jobId = String(body?.jobId || '').trim();
    const job: WhatsAppCronJobDef | undefined = WHATSAPP_CRON_JOBS.find((j) => j.id === jobId);
    if (!job) {
      return NextResponse.json({ error: 'Unknown jobId' }, { status: 400 });
    }

    const creds = await getResolvedWhatsAppAgentsCredentials();
    const secret =
      creds.cron_secret || process.env.CRON_SECRET || process.env.NOTIFICATION_CRON_SECRET || '';
    if (!secret) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    }

    const url = buildWhatsAppCronUrl(publicBaseUrl(request), job);
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${secret}` },
      cache: 'no-store',
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 500) };
    }

    return NextResponse.json({
      success: res.ok,
      status: res.status,
      job: {
        id: job.id,
        jobName: job.jobName,
        jobParam: job.jobParam || null,
        category: job.category,
      },
      endpoint_url: url,
      result: json,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
