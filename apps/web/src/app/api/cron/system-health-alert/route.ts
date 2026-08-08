import { NextRequest, NextResponse } from 'next/server';
import {
  buildHealthAlertContent,
  sendHealthAlertMessage,
} from '@/lib/services/systemHealthAlertTemplate';
import { getEnabledSystemAlertWhatsAppNumbers } from '@/lib/services/systemAlertWhatsAppNumbers';
import { isWhatsAppCronJobEnabled } from '@/lib/services/whatsappCronJobFlags';
import { runSystemMonitorChecks } from '@/app/api/super_admin/system-monitor/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

  const slot = String(request.nextUrl.searchParams.get('slot') || '').trim().toLowerCase();
  const jobId =
    slot === 'evening'
      ? 'system-health-evening'
      : slot === 'morning'
        ? 'system-health-morning'
        : null;

  if (jobId && !(await isWhatsAppCronJobEnabled(jobId))) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: 'job_disabled_in_admin',
      slot: slot || null,
      jobId,
    });
  }

  const adminNumbers = await getEnabledSystemAlertWhatsAppNumbers();
  if (adminNumbers.length === 0) {
    return NextResponse.json(
      {
        error:
          'No enabled alert WhatsApp numbers. Configure on WhatsApp Cron page or SYSTEM_ALERT_WHATSAPP_NUMBERS.',
      },
      { status: 400 },
    );
  }

  const checks = await runSystemMonitorChecks();
  const downServices = checks.filter((c) => c.status === 'down');
  const degradedServices = checks.filter((c) => c.status === 'degraded');
  const healthyServices = checks.filter((c) => c.status === 'healthy');
  const total = checks.length;

  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const summary = {
    timestamp,
    total,
    healthy: healthyServices.length,
    degraded: degradedServices.length,
    down: downServices.length,
    services: checks.map((service) => ({
      name: service.name,
      status: service.status,
      message: service.message,
    })),
    downServices: downServices.map((service) => ({ name: service.name, message: service.message })),
    degradedServices: degradedServices.map((service) => ({ name: service.name })),
  };
  const alertContent = buildHealthAlertContent(summary);

  const sendResults = [];
  for (const number of adminNumbers) {
    const result = await sendHealthAlertMessage(number.trim(), summary);
    sendResults.push({ number: number.trim(), ...result, preview: alertContent.statusLabel });
  }

  return NextResponse.json({
    success: true,
    timestamp,
    slot: slot || null,
    jobId,
    summary: {
      total,
      healthy: healthyServices.length,
      degraded: degradedServices.length,
      down: downServices.length,
    },
    checks: checks.map((c) => ({ name: c.name, status: c.status, message: c.message })),
    alertsSent: sendResults,
  });
}
