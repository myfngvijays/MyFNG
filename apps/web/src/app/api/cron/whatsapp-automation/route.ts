import { NextRequest, NextResponse } from 'next/server';
import {
  runAdminDailySummaryJob,
  runBookingIncompleteReminderJob,
  runMembershipExpiringReminderJob,
  runServiceDueReminderJob,
} from '@/lib/services/whatsappAutomationJobs';
import { runAppUninstallProbeJob } from '@/lib/services/appUninstallDetection';
import { isWhatsAppCronJobEnabled } from '@/lib/services/whatsappCronJobFlags';

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

async function runIfJobEnabled<T>(
  jobId: string,
  runner: () => Promise<T>,
): Promise<T | { skipped: true; reason: string }> {
  if (!(await isWhatsAppCronJobEnabled(jobId))) {
    return { skipped: true, reason: 'job_disabled_in_admin' };
  }
  return runner();
}

export async function GET(request: NextRequest) {
  const authError = assertCronAuth(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const job = String(request.nextUrl.searchParams.get('job') || 'all').trim().toLowerCase();
  const force = request.nextUrl.searchParams.get('force') === '1';

  const results: Record<string, unknown> = {};

  if (job === 'all' || job === 'booking-incomplete') {
    results.bookingIncomplete = await runIfJobEnabled('booking-incomplete', () =>
      runBookingIncompleteReminderJob(),
    );
  }
  if (job === 'all' || job === 'admin-daily-summary') {
    results.adminDailySummary = await runIfJobEnabled('admin-daily-summary', () =>
      runAdminDailySummaryJob(force || job !== 'all'),
    );
  }
  if (job === 'all' || job === 'service-due') {
    const istDay = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
    });
    if (job === 'service-due' || istDay === 'Mon') {
      results.serviceDueReminder = await runIfJobEnabled('service-due', () =>
        runServiceDueReminderJob(),
      );
    } else {
      results.serviceDueReminder = { skipped: true, reason: 'runs_on_monday_ist' };
    }
  }
  if (job === 'all' || job === 'membership-expiring') {
    results.membershipExpiring = await runIfJobEnabled('membership-expiring', () =>
      runMembershipExpiringReminderJob(),
    );
  }
  if (job === 'all' || job === 'app-uninstall-probe') {
    results.appUninstallProbe = await runIfJobEnabled('app-uninstall-probe', () =>
      runAppUninstallProbeJob(),
    );
  }

  return NextResponse.json({
    success: true,
    job,
    force,
    timestamp: new Date().toISOString(),
    results,
  });
}
